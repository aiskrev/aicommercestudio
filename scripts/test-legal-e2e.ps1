<#
.SYNOPSIS
  Browser tests of the legal workflows on a TEST-ONLY stack with customer accounts and the Stripe-shaped billing
  routes switched on (docker-compose.legal-e2e.yml). No Stripe call is made, no payment is possible, mail goes to files.
  The default configuration (everything off) is restored afterwards.
.PARAMETER Specs
  Playwright spec files to run (default: the legal workflows, accessibility and cookie audit).
#>
param([string[]]$Specs = @("tests/legal-workflows.spec.ts", "tests/accessibility.spec.ts", "tests/cookie-audit.spec.ts"))

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$files = @("-f", "docker-compose.yml", "-f", "docker-compose.legal-e2e.yml")
if (-not $env:CATALOGUE_REVALIDATE_SECRET) { $env:CATALOGUE_REVALIDATE_SECRET = [guid]::NewGuid().ToString("N") }
$accountPassword = "Legal-" + [guid]::NewGuid().ToString("N").Substring(0, 18) + "Aa9"

try {
    docker compose @files up --build -d --wait
    docker compose @files exec -T -e E2E_ACCOUNT_PASSWORD=$accountPassword api python -m app.cli legal-e2e-seed
    docker compose @files --profile test run --rm --build `
        -e E2E_LEGAL_STACK=1 -e E2E_ACCOUNT_PASSWORD=$accountPassword e2e npx playwright test @Specs
    $result = $LASTEXITCODE
}
finally {
    docker compose up -d --wait | Out-Null  # back to the default configuration: accounts, workspace and billing off
}
exit $result
