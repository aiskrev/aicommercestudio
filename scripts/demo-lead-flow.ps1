<#
.SYNOPSIS
  Demonstrates the full lead lifecycle against the running local stack and verifies each step in PostgreSQL:
  visitor submits form -> API validates -> PostgreSQL persists lead -> admin logs in -> admin views lead
  -> admin changes status -> audit event is recorded.
.DESCRIPTION
  Uses only the public website origin (http://localhost:3000), exactly like a browser. Admin credentials are
  read from .env (ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD) and are never printed.
  Requires PowerShell 7+ and a running stack (.\scripts\start.ps1).
#>
param([string]$BaseUrl = "http://localhost:3000")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Read-EnvValue([string]$name) {
    $line = Get-Content (Join-Path $root ".env") | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
    if (-not $line) { throw "$name is missing in .env" }
    return $line.Substring($name.Length + 1)
}
function Step([string]$text) { Write-Host "`n▶ $text" -ForegroundColor Cyan }
function Ok([string]$text) { Write-Host "  ✔ $text" -ForegroundColor Green }
function Fail([string]$text) { Write-Host "  ✘ $text" -ForegroundColor Red; exit 1 }
function Sql([string]$query) {
    docker compose exec -T db sh -c "psql -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" -v ON_ERROR_STOP=1 -c `"$query`"" | Out-Host
}
function Call([string]$method, [string]$path, $body = $null, $session = $null, [hashtable]$headers = @{}) {
    $params = @{ Method = $method; Uri = "$BaseUrl$path"; SkipHttpErrorCheck = $true; Headers = $headers }
    if ($session) { $params.WebSession = $session }
    if ($null -ne $body) { $params.ContentType = "application/json"; $params.Body = ($body | ConvertTo-Json -Depth 5) }
    $response = Invoke-WebRequest @params
    $json = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
    return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $json }
}

# A distinct client address per run so repeated demos do not hit the per-client rate limit locally.
$client = @{ "X-Forwarded-For" = "10.77.$(Get-Random -Minimum 1 -Maximum 250).$(Get-Random -Minimum 1 -Maximum 250)" }
$company = "Демо Поток $(Get-Date -Format 'HHmmss') ООД"

Step "1. Visitor: invalid submission is rejected by server-side validation"
$invalid = Call POST "/api/public/leads" @{ service = "seo"; name = "X"; email = "not-an-email"; message = "кратко"; privacy_acknowledged = $false } -headers $client
if ($invalid.Status -ne 422) { Fail "expected 422, got $($invalid.Status)" }
Ok "422 $($invalid.Body.code): $(($invalid.Body.errors | ForEach-Object field) -join ', ')"

Step "2. Visitor: valid submission (anti-bot timing token + 3.5 s like a human)"
$token = (Call GET "/api/public/form-token" -headers $client).Body.token
Start-Sleep -Milliseconds 3500
$created = Call POST "/api/public/leads" @{
    service = "automation"; name = "Демо Посетител"; company = $company; email = "demo.visitor@example.com"
    message = "Демонстрация: искаме автоматизация на обработката на входящите поръчки."
    privacy_acknowledged = $true; marketing_consent = $false; website = ""; form_token = $token
} -headers $client
if ($created.Status -ne 201) { Fail "expected 201, got $($created.Status): $($created.Body.detail)" }
$reference = $created.Body.reference
Ok "201 received, reference $reference"

Step "3. PostgreSQL: the lead is persisted"
Sql "SELECT upper(substr(replace(id::text,'-',''),1,8)) AS reference, status, service, inquiry_type, company, created_at FROM leads WHERE company = '$company';"

Step "4. Admin API is closed to anonymous users"
$anon = Call GET "/api/admin/leads"
if ($anon.Status -ne 401) { Fail "expected 401, got $($anon.Status)" }
Ok "401 $($anon.Body.code)"

Step "5. Admin logs in (HTTP-only session cookie + CSRF token)"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login = Call POST "/api/admin/auth/login" @{ email = (Read-EnvValue "ADMIN_BOOTSTRAP_EMAIL"); password = (Read-EnvValue "ADMIN_BOOTSTRAP_PASSWORD") } $session $client
if ($login.Status -ne 200) { Fail "login failed: $($login.Status) $($login.Body.detail)" }
$cookies = $session.Cookies.GetCookies($BaseUrl)
$csrf = ($cookies | Where-Object Name -eq "acs_csrf").Value
$sessionCookie = $cookies | Where-Object Name -eq "acs_session"
Ok "logged in as $($login.Body.user.email); session cookie HttpOnly=$($sessionCookie.HttpOnly)"

Step "6. Admin finds and views the lead"
$list = Call GET "/api/admin/leads?q=$([uri]::EscapeDataString($company))" -session $session
$leadId = $list.Body.items[0].id
$detail = Call GET "/api/admin/leads/$leadId" -session $session
Ok "found $($list.Body.total) lead: #$($detail.Body.reference) · $($detail.Body.company) · status $($detail.Body.status)"

Step "7. Admin changes the status — without CSRF token it is refused"
$noCsrf = Call PATCH "/api/admin/leads/$leadId" @{ status = "QUALIFIED" } $session
if ($noCsrf.Status -ne 403) { Fail "expected 403 without CSRF, got $($noCsrf.Status)" }
Ok "403 $($noCsrf.Body.code)"
$changed = Call PATCH "/api/admin/leads/$leadId" @{ status = "QUALIFIED"; expected_status = "NEW" } $session @{ "X-CSRF-Token" = $csrf }
if ($changed.Status -ne 200) { Fail "status change failed: $($changed.Status)" }
Ok "200 status is now $($changed.Body.status)"
$stale = Call PATCH "/api/admin/leads/$leadId" @{ status = "LOST"; expected_status = "NEW" } $session @{ "X-CSRF-Token" = $csrf }
Ok "stale concurrent update rejected: $($stale.Status) $($stale.Body.code)"

Step "8. Audit trail via the admin API"
$audit = Call GET "/api/admin/audit?entity_id=$leadId" -session $session
$audit.Body.items | Sort-Object id | ForEach-Object { Write-Host ("  {0,-22} {1,-24} {2}" -f $_.action, $_.actor_label, ($_.details | ConvertTo-Json -Compress)) }

Step "9. PostgreSQL: lead status and audit events"
Sql "SELECT status, status_changed_at IS NOT NULL AS status_changed FROM leads WHERE id = '$leadId';"
Sql "SELECT id, created_at, action, actor_label, details FROM audit_logs WHERE entity_id = '$leadId' ORDER BY id;"

$null = Call POST "/api/admin/auth/logout" -session $session -headers @{ "X-CSRF-Token" = $csrf }
Write-Host "`nDemo completed successfully." -ForegroundColor Green
