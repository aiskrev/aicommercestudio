<#
.SYNOPSIS
  Creates .env from .env.example with freshly generated local secrets.
.DESCRIPTION
  Generates POSTGRES_PASSWORD, SECRET_KEY and a development admin password.
  Existing .env files are never overwritten unless -Force is given.
  Works in Windows PowerShell 5.1 and PowerShell 7+.
#>
param([switch]$Force)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
$example = Join-Path $root ".env.example"

if ((Test-Path $envFile) -and -not $Force) {
    Write-Host ".env already exists - leaving it unchanged (use -Force to regenerate)." -ForegroundColor Yellow
    exit 0
}

function New-HexSecret([int]$bytes) {
    $buffer = New-Object byte[] $bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($buffer)
    $rng.Dispose()
    return -join ($buffer | ForEach-Object { $_.ToString("x2") })
}

$utf8 = New-Object System.Text.UTF8Encoding $false
$content = [System.IO.File]::ReadAllText($example, $utf8)

$dbPassword = New-HexSecret 18
$secretKey = New-HexSecret 32
$adminPassword = "Adm-" + (New-HexSecret 10) + "-X9"

$content = $content -replace "(?m)^POSTGRES_PASSWORD=.*$", "POSTGRES_PASSWORD=$dbPassword"
$content = $content -replace "(?m)^SECRET_KEY=.*$", "SECRET_KEY=$secretKey"
$content = $content -replace "(?m)^ADMIN_BOOTSTRAP_PASSWORD=.*$", "ADMIN_BOOTSTRAP_PASSWORD=$adminPassword"

[System.IO.File]::WriteAllText($envFile, $content, $utf8)

$adminEmail = ([regex]::Match($content, "(?m)^ADMIN_BOOTSTRAP_EMAIL=(.*)$")).Groups[1].Value.Trim()
Write-Host ""
Write-Host "Created .env with generated local secrets." -ForegroundColor Green
Write-Host "Development admin login (stored in .env, change it any time):"
Write-Host "  E-mail:   $adminEmail"
Write-Host "  Password: $adminPassword"
Write-Host ""
Write-Host "Next: .\scripts\start.ps1"
