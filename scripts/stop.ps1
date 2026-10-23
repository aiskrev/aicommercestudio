<#
.SYNOPSIS
  Stops the local stack. Use -RemoveData to also delete the PostgreSQL volume (irreversible).
#>
param([switch]$RemoveData)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if ($RemoveData) {
    docker compose --profile test down -v
} else {
    docker compose --profile test down
}
