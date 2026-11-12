<#
.SYNOPSIS
  Browser tests of the legal workflows on a TEST-ONLY stack with customer accounts and the Stripe-shaped billing
  routes switched on (docker-compose.legal-e2e.yml). No Stripe call is made, no payment is possible, mail goes to files.
  Every run uses a throwaway database (acs_legal_e2e), created empty at the start and dropped at the end, so nothing
  from an earlier run (accounts, withdrawals, data requests) carries over and the default database is never touched.
  The default configuration (everything off) is restored afterwards.
.PARAMETER Specs
  Playwright spec files to run (default: the legal workflows, accessibility, cookie audit, account requests, delivery projects and project documents).
#>
param([string[]]$Specs = @("tests/legal-workflows.spec.ts", "tests/accessibility.spec.ts", "tests/cookie-audit.spec.ts", "tests/account-requests.spec.ts", "tests/delivery-projects.spec.ts", "tests/project-documents.spec.ts"))

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$files = @("-f", "docker-compose.yml", "-f", "docker-compose.legal-e2e.yml")
if (-not $env:CATALOGUE_REVALIDATE_SECRET) { $env:CATALOGUE_REVALIDATE_SECRET = [guid]::NewGuid().ToString("N") }
$accountPassword = "Legal-" + [guid]::NewGuid().ToString("N").Substring(0, 18) + "Aa9"

# The statements go to psql through stdin, inside the db container, as the container's own POSTGRES_USER. Nothing is
# quoted on the command line, so Windows PowerShell and PowerShell 7 behave the same.
function Invoke-Sql([string]$statements) {
    $statements | docker compose @files exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d postgres' | Out-Host
    return $LASTEXITCODE
}

$result = 1
try {
    docker compose @files up -d --wait db
    # A fresh, empty database for this run; the API migrates it when it starts.
    if ((Invoke-Sql "DROP DATABASE IF EXISTS acs_legal_e2e WITH (FORCE);
CREATE DATABASE acs_legal_e2e;") -ne 0) {
        throw "could not create the throwaway database"
    }
    docker compose @files up --build -d --wait
    docker compose @files exec -T -e E2E_ACCOUNT_PASSWORD=$accountPassword api python -m app.cli legal-e2e-seed
    docker compose @files --profile test run --rm --build `
        -e E2E_LEGAL_STACK=1 -e E2E_ACCOUNT_PASSWORD=$accountPassword e2e npx playwright test @Specs
    $result = $LASTEXITCODE
}
finally {
    docker compose up -d --wait | Out-Null  # back to the default configuration: accounts, workspace and billing off
    Invoke-Sql "DROP DATABASE IF EXISTS acs_legal_e2e WITH (FORCE);" | Out-Null
}
exit $result
