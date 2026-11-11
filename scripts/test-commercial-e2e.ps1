<#
.SYNOPSIS
  Browser tests of the commercial expansion features on a TEST-ONLY stack with their feature flags switched on
  (docker-compose.commercial-e2e.yml). No payment, no accounts, no real mail. The default configuration
  (every new flag off) is restored afterwards.

  Two passes: first with every flag on (the configurator hands over to the quote basket), then with the quote
  basket off (the configurator ends in its own quote form). The second pass runs only with the default specs.
.PARAMETER Specs
  Playwright spec files to run (default: the project configurator and the quote basket).
#>
param([string[]]$Specs)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$files = @("-f", "docker-compose.yml", "-f", "docker-compose.commercial-e2e.yml")
if (-not $env:CATALOGUE_REVALIDATE_SECRET) { $env:CATALOGUE_REVALIDATE_SECRET = [guid]::NewGuid().ToString("N") }
$default = -not $Specs
if ($default) { $Specs = @("tests/configurator.spec.ts", "tests/quote-basket.spec.ts", "tests/quotation.spec.ts") }
$result = 1

try {
    $env:E2E_QUOTE_BASKET = "true"
    docker compose @files up --build -d --wait
    docker compose @files --profile test run --rm --build -e E2E_COMMERCIAL_STACK=1 e2e npx playwright test @Specs
    $result = $LASTEXITCODE
    if ($default -and $result -eq 0) {
        $env:E2E_QUOTE_BASKET = "false"
        docker compose @files up -d --wait  # same images, the basket switched off
        docker compose @files --profile test run --rm -e E2E_COMMERCIAL_STACK=1 -e E2E_QUOTE_BASKET=0 e2e npx playwright test tests/configurator.spec.ts
        $result = $LASTEXITCODE
    }
}
finally {
    Remove-Item Env:E2E_QUOTE_BASKET -ErrorAction SilentlyContinue
    docker compose up -d --wait | Out-Null  # back to the default configuration: the new flags off
}
exit $result
