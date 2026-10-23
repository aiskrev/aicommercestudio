<#
.SYNOPSIS
  Restores the local database from a backup created by backup-db.ps1. DESTRUCTIVE.
.DESCRIPTION
  Stops the api and web services, drops and recreates the database, restores the dump, then starts
  the services again (the API applies any newer migrations on start). All data written after the
  backup is lost. You are asked to type RESTORE unless -Force is given.
.PARAMETER File
  Path to an acs-*.dump file.
.EXAMPLE
  .\scripts\restore-db.ps1 -File .\backups\acs-20261023-120000.dump
#>
param([Parameter(Mandatory = $true)][string]$File, [switch]$Force)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$path = Resolve-Path $File

if (-not $Force) {
    Write-Host "This replaces ALL data in the local database with $path." -ForegroundColor Yellow
    if ((Read-Host "Type RESTORE to continue") -ne "RESTORE") { Write-Host "Cancelled."; exit 1 }
}

docker compose up -d db | Out-Null
docker compose stop web api | Out-Null
docker compose cp "$path" "db:/tmp/restore.dump" *> $null
# One line on purpose: this file has CRLF endings on Windows, which a multi-line sh script would inherit.
$restore = 'dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB" && ' +
    'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error /tmp/restore.dump && rm -f /tmp/restore.dump'
docker compose exec -T db sh -c $restore
if ($LASTEXITCODE -ne 0) { Write-Host "Restore failed — the database may be empty. Restore another backup." -ForegroundColor Red; exit 1 }

docker compose up -d api web | Out-Null
Write-Host "Database restored from $path. Services are starting (check: docker compose ps)." -ForegroundColor Green
