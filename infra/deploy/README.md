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

## Rehearsal record

`compose.yml`, `acs-deploy` and the gate were exercised locally on 2026-11-04 against production-built
images through a local registry, in an isolated Compose project: refusal with pending migrations, all
15 migrations on an empty database, deploy, upgrade, automatic rollback from a broken release, manual
rollback, migration with backup, gate refusals. The header chain was tested through Caddy and the real
Next.js proxy with a stand-in for the API. None of this ran on the VPS.
