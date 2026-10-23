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

if ($Suite -in @("api", "all")) {
    Invoke-Suite "API tests (pytest)" { docker compose --profile test run --rm --build api-tests }
    Invoke-Suite "API lint (ruff)" { docker compose --profile test run --rm api-tests ruff check --no-cache . }
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
