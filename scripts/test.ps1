<#
.SYNOPSIS
  Runs the test suites inside Docker (no local Python/Node required).
.PARAMETER Suite
  api | web | e2e | portal | audit | all (default: all except portal and audit)
  legal: browser tests of the legal workflows on a test-only stack with accounts and billing routes on (no Stripe)
  portal: the client portal browser e2e on a stack started with the portal switched ON
  (docker-compose.portal-e2e.yml, test only); the stack is switched back to the default afterwards.
#>
param([ValidateSet("api", "web", "e2e", "portal", "legal", "audit", "all")][string]$Suite = "all")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$failed = @()

function Invoke-Suite([string]$name, [scriptblock]$block) {
    Write-Host "`n=== $name ===" -ForegroundColor Cyan
    & $block
    if ($LASTEXITCODE -ne 0) { $script:failed += $name }
}

if ($Suite -in @("api", "web", "all")) {
    # Both apps test their readiness scoring against the same golden vectors; each container only sees its own copy.
    Invoke-Suite "Readiness scoring vectors (API = web copy)" {
        $api = (Get-FileHash "apps/api/tests/fixtures/readiness_vectors.json").Hash
        $web = (Get-FileHash "apps/web/src/lib/readiness.vectors.json").Hash
        if ($api -ne $web) { Write-Host "readiness vectors differ between apps/api and apps/web" -ForegroundColor Red }
        $global:LASTEXITCODE = [int]($api -ne $web)
    }
    # The AI team model and its PDF texts are shared the same way (vectors + texts snapshot).
    Invoke-Suite "AI team and solution builder vectors and texts (API = web copy)" {
        $pairs = @(
            @("apps/api/tests/fixtures/team_vectors.json", "apps/web/src/lib/team.vectors.json"),
            @("apps/api/app/team/texts.json", "apps/web/src/lib/team-texts.json"),
            @("apps/api/tests/fixtures/solution_vectors.json", "apps/web/src/lib/solution.vectors.json")
        )
        $diff = $pairs | Where-Object { (Get-FileHash $_[0]).Hash -ne (Get-FileHash $_[1]).Hash }
        foreach ($pair in $diff) { Write-Host "$($pair[0]) differs from $($pair[1])" -ForegroundColor Red }
        $global:LASTEXITCODE = [int]([bool]$diff)
    }
    # The service catalogue seed is generated from the web content (catalogue-seed.test.ts) and seeded by the API.
    Invoke-Suite "Catalogue seed (API = web copy)" {
        $api = (Get-FileHash "apps/api/app/catalogue/seed_v1.json").Hash
        $web = (Get-FileHash "apps/web/src/lib/catalogue-seed.json").Hash
        if ($api -ne $web) { Write-Host "catalogue seed differs between apps/api and apps/web (copy the web file)" -ForegroundColor Red }
        $global:LASTEXITCODE = [int]($api -ne $web)
    }
    # Legal document versions: the web shows them, the API validates and stores them (lib/legal-versions.test.ts hashes the texts).
    Invoke-Suite "Legal document versions (API = web copy)" {
        $api = (Get-FileHash "apps/api/app/legal_versions.json").Hash
        $web = (Get-FileHash "apps/web/src/lib/legal-versions.json").Hash
        if ($api -ne $web) { Write-Host "legal versions differ between apps/api and apps/web (copy the web file)" -ForegroundColor Red }
        $global:LASTEXITCODE = [int]($api -ne $web)
    }
    # Workshop keys and titles: the API accepts them on enquiries and uses the titles in proposal drafts.
    Invoke-Suite "Workshop keys (API = web copy)" {
        $api = (Get-FileHash "apps/api/app/workshop_keys.json").Hash
        $web = (Get-FileHash "apps/web/src/lib/workshop-keys.json").Hash
        if ($api -ne $web) { Write-Host "workshop keys differ between apps/api and apps/web (copy the web file)" -ForegroundColor Red }
        $global:LASTEXITCODE = [int]($api -ne $web)
    }
}
if ($Suite -in @("api", "all")) {
    Invoke-Suite "API tests (pytest)" { docker compose --profile test run --rm --build api-tests }
    Invoke-Suite "API lint (ruff)" { docker compose --profile test run --rm api-tests ruff check --no-cache . }
    Invoke-Suite "API formatting (ruff format --check)" { docker compose --profile test run --rm api-tests ruff format --check . }
    # docs/openapi.json, the route list in docs/API_REFERENCE.md and the README's document index must match the code.
    Invoke-Suite "API docs in sync" { docker compose --profile test run --rm --no-deps -v "${root}:/repo:ro" api-tests python scripts/docs_sync.py }
}
if ($Suite -in @("web", "all")) {
    Invoke-Suite "Web typecheck + lint + unit tests" { docker compose --profile test run --rm --build web-tests }
}
if ($Suite -in @("e2e", "all")) {
    Invoke-Suite "End-to-end tests (Playwright)" {
        # The catalogue e2e flow regenerates the public pages on demand; web and e2e share a per-run secret.
        if (-not $env:CATALOGUE_REVALIDATE_SECRET) {
            $env:CATALOGUE_REVALIDATE_SECRET = [guid]::NewGuid().ToString("N")
        }
        docker compose up --build -d --wait
        # Throwaway editor and viewer accounts for the role-based admin flows; the password is generated per run.
        $staffPassword = "E2e-" + [guid]::NewGuid().ToString("N").Substring(0, 20) + "Aa9"
        # e2e.mfa@example.com (viewer) is the staff TOTP flow's account; its second factor is reset every run.
        foreach ($account in @(@("e2e.editor@example.com", "editor"), @("e2e.viewer@example.com", "viewer"), @("e2e.mfa@example.com", "viewer"))) {
            docker compose exec -T -e ADMIN_PASSWORD=$staffPassword api python -m app.cli create-admin --email $account[0] --name "E2E $($account[1])" | Out-Null
            docker compose exec -T -e ADMIN_PASSWORD=$staffPassword api python -m app.cli set-password --email $account[0] | Out-Null
            docker compose exec -T api python -m app.cli set-role --email $account[0] --role $account[1] | Out-Null
        }
        docker compose exec -T api python -m app.cli reset-mfa --email e2e.mfa@example.com | Out-Null
        # Labelled demo organisation (sample registry data) owned by the bootstrap admin, for the Ops platform flows.
        docker compose exec -T api sh -c 'python -m app.cli ops-seed-demo --owner-email "$ADMIN_BOOTSTRAP_EMAIL"' | Out-Null
        docker compose --profile test run --rm --build -e E2E_STAFF_PASSWORD=$staffPassword e2e
    }
}
if ($Suite -eq "legal") {
    Invoke-Suite "Legal workflows e2e (accounts and billing routes on, no Stripe; test stack only)" { & "$PSScriptRoot/test-legal-e2e.ps1" }
}
if ($Suite -eq "portal") {
    Invoke-Suite "Client portal e2e (portal switched on, test stack only)" {
        $portal = @("-f", "docker-compose.yml", "-f", "docker-compose.portal-e2e.yml")
        docker compose @portal up --build -d --wait
        docker compose @portal exec -T api sh -c 'python -m app.cli ops-seed-demo --owner-email "$ADMIN_BOOTSTRAP_EMAIL"' | Out-Null
        # A non-demo organisation for the invitation (demo organisations have no client access); exists after a first run.
        docker compose @portal exec -T api sh -c 'python -m app.cli ops-create-org --slug e2e-portal --name "E2E Portal Organisation" --owner-email "$ADMIN_BOOTSTRAP_EMAIL"' | Out-Null
        # --no-deps: running against the default file alone would recreate the API with the portal off.
        docker compose @portal --profile test run --rm --build --no-deps -e E2E_REQUIRE_PORTAL=1 e2e npx playwright test tests/portal.spec.ts
        $result = $LASTEXITCODE
        docker compose up -d --wait | Out-Null  # back to the default configuration (portal off)
        $global:LASTEXITCODE = $result
    }
}
if ($Suite -eq "audit") {
    Invoke-Suite "Python dependency audit (pip-audit)" { docker compose --profile test run --rm api-tests pip-audit -r requirements.txt }
    Invoke-Suite "npm dependency audit" { docker compose --profile test run --rm web-tests npm audit --omit=dev }
}

if ($failed.Count -gt 0) {
    Write-Host "`nFAILED: $($failed -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "`nAll selected suites passed." -ForegroundColor Green
