<#
.SYNOPSIS
  One-time set-up of the encrypted off-site database copy on the owner's laptop (docs/DEPLOYMENT.md §6).
.DESCRIPTION
  * ~/.acs-backup/gnupg: a GnuPG key pair for the backups. The server gets only the public key
    (~/.acs-backup/offsite.pub.asc); the private key never leaves this laptop. A copy of it is exported
    to ~/.acs-backup/PRIVATE-KEY-BACKUP.asc: store that copy offline (USB stick or password manager)
    and delete the file, because without it the copies in OneDrive cannot be decrypted if the laptop is lost.
  * ~/.ssh/acs_backup_pull: an SSH key without a passphrase that the server accepts only for
    acs-backup-pull (list and read the encrypted files). Its public half goes to the server.
  * ~/.acs-backup/offsite-backup-pull.sh and the Windows task "ACS off-site backup": daily at 09:30 and
    10 minutes after sign-in; missed runs start when the laptop is next on.
  Idempotent: existing keys are kept. Needs Git for Windows (bash, ssh, gpg).
#>
$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git"
$bash = Join-Path $git "bin\bash.exe"
$dir = Join-Path $env:USERPROFILE ".acs-backup"
New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item (Join-Path $PSScriptRoot "offsite-backup-pull.sh") (Join-Path $dir "offsite-backup-pull.sh") -Force

# Keys are made in Git Bash so that the server and restore steps use the same tools.
& $bash -lc @'
set -euo pipefail
dir="$HOME/.acs-backup"
export GNUPGHOME="$dir/gnupg"
mkdir -p "$GNUPGHOME" && chmod 700 "$GNUPGHOME"
if ! gpg --batch --list-secret-keys "ACS off-site backup" >/dev/null 2>&1; then
  gpg --batch --pinentry-mode loopback --passphrase '' --quick-gen-key "ACS off-site backup" ed25519 cert never
  fpr=$(gpg --batch --with-colons --list-keys "ACS off-site backup" | awk -F: '/^fpr/ {print $10; exit}')
  gpg --batch --pinentry-mode loopback --passphrase '' --quick-add-key "$fpr" cv25519 encr never
  gpg --batch --armor --export-secret-keys "ACS off-site backup" > "$dir/PRIVATE-KEY-BACKUP.asc"
fi
gpg --batch --armor --export "ACS off-site backup" > "$dir/offsite.pub.asc"
[ -f "$HOME/.ssh/acs_backup_pull" ] || ssh-keygen -q -t ed25519 -N '' -C acs-offsite-pull -f "$HOME/.ssh/acs_backup_pull"
chmod +x "$dir/offsite-backup-pull.sh"
'@
if ($LASTEXITCODE -ne 0) { throw "key set-up failed" }

$action = New-ScheduledTaskAction -Execute $bash -Argument '-lc "$HOME/.acs-backup/offsite-backup-pull.sh"'
$daily = New-ScheduledTaskTrigger -Daily -At 09:30
$logon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$logon.Delay = "PT10M"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "ACS off-site backup" -Action $action -Trigger @($daily, $logon) -Settings $settings `
  -Description "Copies the encrypted A.I. Commerce Studio database dumps from the server into OneDrive\ACS-backups." -Force | Out-Null

Write-Host "Done. Server needs: $dir\offsite.pub.asc and $env:USERPROFILE\.ssh\acs_backup_pull.pub"
if (Test-Path (Join-Path $dir "PRIVATE-KEY-BACKUP.asc")) {
  Write-Host "Store $dir\PRIVATE-KEY-BACKUP.asc offline (USB or password manager), then delete the file." -ForegroundColor Yellow
}
