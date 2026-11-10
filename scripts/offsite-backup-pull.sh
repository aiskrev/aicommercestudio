#!/usr/bin/env bash
# Daily copy of the encrypted database dumps from the server into OneDrive (owner's laptop, Git Bash).
# Installed by scripts/install-offsite-backup.ps1 as ~/.acs-backup/offsite-backup-pull.sh and run by the
# Windows task "ACS off-site backup". The key it uses can only list and read the encrypted files on
# the server (infra/deploy/acs-backup-pull). Files stay encrypted; decrypting needs the private key in
# ~/.acs-backup/gnupg (see docs/DEPLOYMENT.md, section 6).
set -euo pipefail

SERVER=${SERVER:-acsbackup@2.31.101.225}
KEY=${KEY:-$HOME/.ssh/acs_backup_pull}
ONEDRIVE_DIR=$(cygpath -u "${OneDrive:-$USERPROFILE\\OneDrive}")
TARGET=${TARGET:-$ONEDRIVE_DIR/ACS-backups}
KEEP=${KEEP:-30}

remote() {
  # -n: never read the loop's stdin; BatchMode: never prompt (a scheduled task has no one to answer).
  ssh -n -i "$KEY" -o IdentitiesOnly=yes -o IdentityAgent=none -o BatchMode=yes -o ConnectTimeout=20 "$SERVER" "$1"
}

mkdir -p "$TARGET"
exec >> "$TARGET/pull.log" 2>&1

listing=$(remote list) || { echo "$(date -u +%FT%TZ) FAILED: server not reachable"; exit 1; }
fetched=0
while read -r name size; do
  [[ $name =~ ^acs-[0-9]{8}-[0-9]{6}\.dump\.gpg$ ]] || continue
  if [ -f "$TARGET/$name" ] && [ "$(stat -c %s "$TARGET/$name")" = "$size" ]; then
    continue
  fi
  part="$TARGET/.$name.part"
  remote "get $name" > "$part"
  if [ "$(stat -c %s "$part")" != "$size" ]; then
    rm -f "$part"
    echo "$(date -u +%FT%TZ) FAILED: incomplete download of $name"
    exit 1
  fi
  mv -f "$part" "$TARGET/$name"
  fetched=$((fetched + 1))
done <<< "$listing"

remote done
ls -1t "$TARGET"/acs-*.dump.gpg 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "$(date -u +%FT%TZ) ok: $fetched new, $(ls -1 "$TARGET"/acs-*.dump.gpg 2>/dev/null | wc -l) kept"
