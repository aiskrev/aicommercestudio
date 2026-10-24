<#
.SYNOPSIS
  Lab performance baseline: Lighthouse (mobile + desktop presets, median of 3 runs) against the
  production build, inside the Playwright container. Results: apps/web/e2e/perf-results/<Label>/.
.PARAMETER Label
  Name of the result folder (default: baseline).
.PARAMETER Routes
  Comma-separated routes (default: /bg,/en,/bg/uslugi,/bg/uslugi/ai-managed-services,/bg/kontakti,/bg/ai-automation-advisor).
.PARAMETER Runs
  Runs per route and preset (default: 3).
#>
param(
    [string]$Label = "baseline",
    [string]$Routes = "",
    [int]$Runs = 3
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Production build of the web app (the e2e service depends on it being healthy).
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { exit 1 }
docker compose --profile test build e2e
if ($LASTEXITCODE -ne 0) { exit 1 }

$results = Join-Path $root "apps/web/e2e/perf-results"
New-Item -ItemType Directory -Force $results | Out-Null
$envArgs = @("-e", "LH_LABEL=$Label", "-e", "LH_RUNS=$Runs")
if ($Routes) { $envArgs += @("-e", "LH_ROUTES=$Routes") }

docker compose --profile test run --rm @envArgs -v "${results}:/e2e/perf-results" e2e `
    sh -c "npm install --global --no-audit --no-fund lighthouse@13.5.0 >/dev/null && node perf/lighthouse.mjs"
exit $LASTEXITCODE
