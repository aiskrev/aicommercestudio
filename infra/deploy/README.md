# VPS deployment runbook

Target: Hetzner `acs-test-01` (Ubuntu 26.04, 2 vCPU, 4 GB RAM), domain `ai-commercestudio.com` behind
Cloudflare. The server runs images built by GitHub Actions and builds nothing itself.

```
Visitor ─► Cloudflare ─► Caddy (host, 443) ─► 127.0.0.1:3000 web ─► api ─► db
                                                   (app network)   (internal data network)
```

| File | Installed as |
| --- | --- |
| `compose.yml` | `/opt/ai-commerce-studio/compose.yml` |
| `production.env.example` | template for `/opt/ai-commerce-studio/.env` (root, `chmod 600`) |
| `acs-deploy` | `/usr/local/sbin/acs-deploy` (root, `0750`) |
| `acs-deploy-gate` | `/usr/local/sbin/acs-deploy-gate` (root, `0755`) |
| `../backup-db.sh` | `/opt/ai-commerce-studio/backup-db.sh` |
| `acs-selfcheck` | `/usr/local/sbin/acs-selfcheck` (root, `0755`) |
| `acs-backup-encrypt` | `/usr/local/sbin/acs-backup-encrypt` (root, `0755`) |
| `acs-backup-pull` | `/usr/local/sbin/acs-backup-pull` (root, `0755`) |
| `systemd/acs-backup.service.d/offsite.conf` | `/etc/systemd/system/acs-backup.service.d/offsite.conf` |
| `../reverse-proxy/Caddyfile.cloudflare` | `/etc/caddy/Caddyfile` |

## Releases

1. `Release` workflow (`.github/workflows/release.yml`), started by hand on `main`: all quality gates,
   then `ghcr.io/aiskrev/aicommercestudio-{api,web}:sha-<commit>`. A push never releases anything.
2. On the server: `acs-deploy deploy sha-<commit>`. It pulls the images, compares the schema in the
   database with the head in the image and **refuses if migrations are pending** (exit 3, nothing changed).
3. Migrations are a separate approved step: `acs-deploy migrate sha-<commit>` takes a verified backup
   when the database has tables, then runs `alembic upgrade head` and the idempotent seed.
4. A failed health check returns to the previous release by itself. `acs-deploy rollback` does it by hand.
   Neither touches the database: after a migration, restore the backup (`docs/DEPLOYMENT.md`, section 9).

## Deploy credentials

The `acsdeploy` user has no shell access, is not in the `docker` group and has no root:

```
# ~acsdeploy/.ssh/authorized_keys
restrict,command="/usr/local/sbin/acs-deploy-gate" ssh-ed25519 AAAA... github-actions-deploy

# /etc/sudoers.d/91-acsdeploy
acsdeploy ALL=(root) NOPASSWD: /usr/local/sbin/acs-deploy
```

The gate accepts only `deploy <release>`, `migrate <release>`, `rollback` and `status`.

GitHub Actions reaches the server through Cloudflare Tunnel: `cloudflared` on the server makes an
outbound connection, `deploy-ssh.ai-commercestudio.com` is protected by Cloudflare Access with a
service token, and the runner connects with `cloudflared access ssh`. No inbound port is opened for
GitHub, and the Hetzner firewall keeps SSH limited to the owner's address. The deployment job needs
the approval of the reviewer in the `production` environment and runs only from `main`.

## Client address behind Cloudflare

The API trusts the right-most `X-Forwarded-For` entry, so Caddy sends exactly one value. It honours
`CF-Connecting-IP` only from Cloudflare ranges and otherwise uses the socket address, so a spoofed
header from the Internet has no effect. Review the ranges against https://www.cloudflare.com/ips/.

## TLS

Cloudflare SSL mode **Full (strict)** with a Cloudflare Origin CA certificate. Generate the key and a
CSR on the server, so the private key never leaves it, then paste the CSR into Cloudflare
(SSL/TLS → Origin Server → Create Certificate → Use my private key and CSR) and install the returned
certificate as `/etc/caddy/origin/origin.crt`. The key stays in `/etc/caddy/origin/origin.key`
(owner `caddy`, `chmod 600`).

An Origin CA certificate is trusted only by Cloudflare, so the DNS records must stay proxied.

## Network access

| Layer | Rule |
| --- | --- |
| Hetzner Cloud Firewall | 22 from the owner's address only; 80, 443 and ICMP open |
| UFW on the host | 22; 443 only from the Cloudflare ranges; 80 closed |
| Cloudflare | SSL Full (strict), Always Use HTTPS, root and `www` proxied |

Port 80 is closed, so Always Use HTTPS must stay on: without it `http://` requests fail with 522.
When Cloudflare publishes new ranges, update UFW as well as the Caddyfile.

The Access application for `deploy-ssh` must use a policy with the action **Service Auth**. With
**Allow**, a service token is refused (`websocket: bad handshake`). With the tunnel stopped, the
hostname answers 530 before Access is evaluated, so test Access while the tunnel is running.

Mail: `contact@ai-commercestudio.com` is Cloudflare Email Routing, receive only. A test sent from the
destination provider itself can bounce, so test from a different provider.

## Backups

`systemd/` holds the timers, installed in `/etc/systemd/system`: database backup at 02:15 UTC and the
retention job at 02:30 UTC. Dumps stay in `/var/backups/ai-commerce-studio` (14 kept). A restore into
an isolated container was verified on 2026-11-04.

Off-site copy (encrypted, to the owner's laptop and OneDrive):

1. On the laptop: `scripts/install-offsite-backup.ps1` (GnuPG key pair, pull key, daily task).
2. On the server, as root:
   ```
   apt-get install -y gnupg
   install -d -m 0755 /etc/acs-backup && install -m 0644 offsite.pub.asc /etc/acs-backup/offsite.pub.asc
   # A real shell is needed for the forced command to run; the key can still run only acs-backup-pull.
   useradd --system --create-home --shell /bin/sh acsbackup
   chgrp acsbackup /var/backups/ai-commerce-studio && chmod 0710 /var/backups/ai-commerce-studio
   install -d -m 0750 -o root -g acsbackup /var/backups/ai-commerce-studio/offsite
   install -d -m 0755 -o acsbackup -g acsbackup /var/lib/acs-offsite
   install -d -m 0700 -o acsbackup -g acsbackup ~acsbackup/.ssh
   echo 'restrict,command="/usr/local/sbin/acs-backup-pull" <acs_backup_pull.pub>' > ~acsbackup/.ssh/authorized_keys
   chown acsbackup:acsbackup ~acsbackup/.ssh/authorized_keys && chmod 0600 ~acsbackup/.ssh/authorized_keys
   ```
   then install the two scripts and the drop-in, `systemctl daemon-reload`, and run
   `systemctl start acs-backup` once to produce the first encrypted copy.
3. `/var/backups/ai-commerce-studio` is `0710 root:acsbackup`: `acsbackup` can pass through it but not
   list it, and the plain dumps stay `0600 root`. It reaches only the `offsite` directory.
4. Installed on the server on 2026-11-10; the first copy was fetched and decrypted on the laptop.

## Monitoring

`acs-selfcheck.timer` (every 15 minutes) runs `/usr/local/sbin/acs-selfcheck`: disk, age of the newest
backup, failed `acs-*` jobs and container health. It writes `/var/lib/acs-selfcheck/status.json`, which
the API reads through a read-only mount and reports as `"host"` in `/api/health/ready`. The GitHub
workflow `Uptime` checks that answer from outside every 10 minutes and alerts (e-mail and an `uptime`
issue). Install: copy the script and both units, then
`systemctl daemon-reload && systemctl enable --now acs-selfcheck.timer`. Details:
`journalctl -u acs-selfcheck -n 50`.

## Rehearsal record

`compose.yml`, `acs-deploy` and the gate were exercised locally on 2026-11-04 against production-built
images through a local registry, in an isolated Compose project: refusal with pending migrations, all
15 migrations on an empty database, deploy, upgrade, automatic rollback from a broken release, manual
rollback, migration with backup, gate refusals. The header chain was tested through Caddy and the real
Next.js proxy with a stand-in for the API.

The first production release ran on 2026-11-04: `sha-4d846c5`, migrated to revision 0015.

## Restricted API database login (H-1)

The API can connect as `acs_app_api`, a role that owns nothing, cannot bypass row-level security and has
no privilege on tenant tables. Migrations and the maintenance timer keep using the schema owner. Until
this is switched on the API connects as the owner, as before. Production refuses to start with customer
accounts or the client portal on and the owner connection.

Switching on is a production change: it needs the owner's approval and a backup first.

1. Release with `migrate-and-deploy`, so that migration 0018 exists on the server.
2. Install the updated `systemd/acs-maintenance.service`, then `systemctl daemon-reload`. The retention
   job needs the owner connection, so it runs in the `migrate` image, not inside the API container.
3. In `/opt/ai-commerce-studio/.env`, add `API_DB_USER=acs_app_api` and `API_DB_PASSWORD=<openssl rand -hex 24>`.
4. Run `acs-deploy migrate` (it runs `db-api-role`, which lets the role log in), then restart the API.
5. Check: `/health/ready` answers, staff sign-in works, and
   `select usename from pg_stat_activity where application_name = '' and usename = 'acs_app_api'` shows the API.

To go back: remove the two lines from `.env` and restart the API. Nothing else changes.

`python -m app.cli` commands that manage data run as the owner: use
`docker compose --profile migrate run --rm -T migrate python -m app.cli <command>`, not `exec api`.
