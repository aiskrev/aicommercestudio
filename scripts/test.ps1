<#
.SYNOPSIS
  Runs the test suites inside Docker (no local Python/Node required).
.PARAMETER Suite
  api | web | e2e | audit | all (default: all except audit)
#>
param([ValidateSet("api", "web", "e2e", "audit", "all")][string]$Suite = "all")

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
    Invoke-Suite "AI team vectors and texts (API = web copy)" {
        $pairs = @(
            @("apps/api/tests/fixtures/team_vectors.json", "apps/web/src/lib/team.vectors.json"),
            @("apps/api/app/team/texts.json", "apps/web/src/lib/team-texts.json")
        )
        $diff = $pairs | Where-Object { (Get-FileHash $_[0]).Hash -ne (Get-FileHash $_[1]).Hash }
        foreach ($pair in $diff) { Write-Host "$($pair[0]) differs from $($pair[1])" -ForegroundColor Red }
        $global:LASTEXITCODE = [int]([bool]$diff)
    }
}
if ($Suite -in @("api", "all")) {
    Invoke-Suite "API tests (pytest)" { docker compose --profile test run --rm --build api-tests }
    Invoke-Suite "API lint (ruff)" { docker compose --profile test run --rm api-tests ruff check --no-cache . }
    # docs/openapi.json, the route list in docs/API_REFERENCE.md and the README's document index must match the code.
    Invoke-Suite "API docs in sync" { docker compose --profile test run --rm --no-deps -v "${root}:/repo:ro" api-tests python scripts/docs_sync.py }
}
if ($Suite -in @("web", "all")) {
    Invoke-Suite "Web typecheck + lint + unit tests" { docker compose --profile test run --rm --build web-tests }
}
if ($Suite -in @("e2e", "all")) {
    Invoke-Suite "End-to-end tests (Playwright)" {
        docker compose up --build -d
        docker compose --profile test run --rm --build e2e
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
