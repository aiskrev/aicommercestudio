<#
.SYNOPSIS
  Builds and starts the local stack (PostgreSQL, API, web) and waits until it is healthy.
.PARAMETER Dev
  Use the hot-reload development override (bind-mounted sources).
#>
param([switch]$Dev)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path (Join-Path $root ".env"))) {
    & (Join-Path $PSScriptRoot "setup.ps1")
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not running. Start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

$files = @("-f", "docker-compose.yml")
if ($Dev) { $files += @("-f", "docker-compose.dev.yml") }

docker compose @files up --build -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Waiting for services to become healthy..."
$deadline = (Get-Date).AddMinutes(5)
do {
    Start-Sleep -Seconds 3
    $ok = $true
    try { $null = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 http://localhost:3000/api/health } catch { $ok = $false }
} until ($ok -or (Get-Date) -gt $deadline)

if (-not $ok) {
    Write-Host "Services did not become healthy in time. Check: docker compose logs" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "A.I. Commerce Studio is running:" -ForegroundColor Green
Write-Host "  Website:      http://localhost:3000"
Write-Host "  Admin:        http://localhost:3000/admin  (credentials in .env)"
Write-Host "  API docs:     http://localhost:8000/api/docs"
