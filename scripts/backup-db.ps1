<#
.SYNOPSIS
  Creates a compressed PostgreSQL backup (pg_dump custom format) of the local database.
.DESCRIPTION
  The dump is written inside the db container and copied out with `docker compose cp`, so the binary
  file is never passed through a PowerShell pipeline (which would corrupt it). The backup is verified
  with `pg_restore --list`. Backups contain personal data from leads: keep them out of Git (the
  backups\ folder is ignored), store them encrypted and delete them according to the retention policy.
.PARAMETER OutDir
  Target folder (default: <project>\backups).
.PARAMETER Keep
  Keep only the newest N backups in OutDir (default 14; 0 = keep all).
.EXAMPLE
  .\scripts\backup-db.ps1
#>
param([string]$OutDir = "", [int]$Keep = 14)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not $OutDir) { $OutDir = Join-Path $root "backups" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$state = docker compose ps db --format "{{.State}}" 2>$null
if ($state -ne "running") { Write-Host "The db service is not running. Start it with: docker compose up -d db" -ForegroundColor Red; exit 1 }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$name = "acs-$stamp.dump"
$target = Join-Path $OutDir $name

docker compose exec -T db sh -c "pg_dump -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" --format=custom --no-owner --file=/tmp/$name"
if ($LASTEXITCODE -ne 0) { Write-Host "pg_dump failed" -ForegroundColor Red; exit 1 }
docker compose cp "db:/tmp/$name" "$target" *> $null
docker compose exec -T db rm -f "/tmp/$name" | Out-Null

docker compose cp "$target" "db:/tmp/verify.dump" *> $null
$tables = docker compose exec -T db sh -c "pg_restore --list /tmp/verify.dump | grep -c 'TABLE DATA'; rm -f /tmp/verify.dump"
if ($LASTEXITCODE -ne 0 -or [int]$tables -lt 1) { Write-Host "Backup verification failed" -ForegroundColor Red; exit 1 }

$size = [math]::Round((Get-Item $target).Length / 1KB, 1)
Write-Host "Backup created: $target ($size KB, $tables tables with data)" -ForegroundColor Green

if ($Keep -gt 0) {
    Get-ChildItem $OutDir -Filter "acs-*.dump" | Sort-Object Name -Descending | Select-Object -Skip $Keep |
        ForEach-Object { Remove-Item $_.FullName; Write-Host "Removed old backup $($_.Name)" }
}
