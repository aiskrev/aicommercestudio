# Production deployment (prepared, not executed)

Nothing in this document has been executed: no server, domain, DNS record, certificate or paid
resource was created. It describes how to deploy the existing Docker setup to one Linux server
behind a TLS-terminating reverse proxy. Decisions marked **(owner)** need the business owner.

## 1. Target architecture

```
Internet ──443──► Caddy (host, automatic HTTPS, HSTS, X-Forwarded-For)
                     │ 127.0.0.1:3000
                     ▼
                 web (Next.js, standalone, non-root) ── same-origin /api/* proxy ──► api (FastAPI, non-root)
                                                                                     │ docker network only
                                                                                     ▼
                                                                                 db (PostgreSQL 17, volume)
```

* Only Caddy listens publicly (80/443). The web container is bound to `127.0.0.1:3000`; API and
  database have **no** published ports (`infra/docker-compose.prod.yml`).
* One API instance (rate limits and lockout counters are in memory + DB). Horizontal scaling needs
  Redis for the limiter first (see ROADMAP).

Minimum server: 2 vCPU, 4 GB RAM, 40 GB SSD, Ubuntu 24.04 LTS or Debian 12, Docker Engine + Compose
plugin, EU region **(owner: provider choice, DPA)**.

## 2. Production Docker configuration

`docker-compose.yml` + `infra/docker-compose.prod.yml`:

| Service | Production behaviour |
| --- | --- |
| db | no host port; data in volume `ai-commerce-studio_pgdata`; log rotation 5 × 10 MB |
| api | no host port; `APP_ENV=production`, `ENABLE_API_DOCS=false`, `SEED_SAMPLE_DATA=false`; runs `alembic upgrade head` + admin bootstrap on start; `--proxy-headers`; non-root |
| web | `127.0.0.1:3000` only; `SITE_URL` / public contact details baked in at build time; non-root |

The API refuses to start in production with: a placeholder or short `SECRET_KEY`, `CORS_ORIGINS`
containing `*` or any non-`https://` origin, `SITE_URL` not on `https://`, `COOKIE_SECURE=false`, or
`SEED_SAMPLE_DATA=true` (tests in `test_security.py`).

Commands (on the server, in the project directory):

```bash
docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml config --quiet   # validate
docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml build
docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml ps
```

Tip: `export COMPOSE_FILE=docker-compose.yml:infra/docker-compose.prod.yml` once, then plain
`docker compose …` uses both files.

## 3. Domain and DNS **(owner: domain name)**

1. Register/choose the domain (e.g. `example.bg`).
2. DNS at the registrar: `A example.bg → <server IPv4>`, `AAAA example.bg → <server IPv6>` (if any),
   `CNAME www → example.bg`. TTL 300 during the launch, raise later.
3. Wait until `dig +short example.bg` returns the server address, **then** start Caddy (it requests
   the Let's Encrypt certificate on first start; ports 80 and 443 must be reachable).
4. Optional: CAA record `0 issue "letsencrypt.org"`.
5. Set `SITE_URL=https://example.bg` and `CORS_ORIGINS=https://example.bg` and rebuild `web`.

## 4. Reverse proxy and HTTPS

Install Caddy from the official repository, copy `infra/reverse-proxy/Caddyfile.example` to
`/etc/caddy/Caddyfile`, replace `example.com`, then `sudo systemctl reload caddy`. The example:

* obtains and renews certificates automatically,
* redirects `www` and HTTP to `https://example.bg`,
* sets HSTS and removes the `Server` header,
* replaces any client-supplied `X-Forwarded-For` with the real client address (Caddy ≥ 2.5 default) — required, because the API's rate
  limits trust that header. Never expose port 3000 publicly.

Firewall: `ufw default deny incoming; ufw allow OpenSSH; ufw allow 80,443/tcp; ufw enable`.
SSH: keys only (`PasswordAuthentication no`), unattended security upgrades on.

Verify after go-live: `curl -I https://example.bg` (HSTS, CSP, `X-Frame-Options: DENY`),
`curl https://example.bg/api/health/ready`, SSL Labs grade A, `https://example.bg/api/docs` → 404.

## 5. Secrets handling

* The production `.env` lives only on the server: `/opt/ai-commerce-studio/.env`, owner root,
  `chmod 600`. It is never committed (git-ignored) and never copied into images (`.dockerignore`).
* Generate fresh values on the server — never reuse development values:
  ```bash
  openssl rand -hex 32   # SECRET_KEY
  openssl rand -hex 24   # POSTGRES_PASSWORD
  ```
* `ANTHROPIC_API_KEY`, `SMTP_PASSWORD` and integration tokens are read only by the API container; the
  web container receives no secrets (verified: no secret-like variables in the web container, no
  secret names in the client bundle).
* First administrator: leave `ADMIN_BOOTSTRAP_PASSWORD` empty and run
  `docker compose exec api python -m app.cli create-admin --email <you>` (hidden prompt). If you do use
  the bootstrap variables, the API prints a warning — remove them after the first start.
* Keep an offline copy of the `.env` in the owner's password manager (needed for disaster recovery).
* Rotation: changing `SECRET_KEY` invalidates open form tokens and changes the keyed IP hashes (old and
  new rows can no longer be correlated); admin sessions are stored as SHA-256 token hashes and stay
  valid — use **logout-all** in the admin account page after a suspected compromise. Changing
  `POSTGRES_PASSWORD` requires `ALTER USER` in PostgreSQL first.

## 6. Database backup and recovery plan

| Item | Plan |
| --- | --- |
| Method | `infra/backup-db.sh`: `pg_dump --format=custom`, verified with `pg_restore --list`, private directory (`umask 077`) |
| Schedule | daily 02:15 UTC via cron (`15 2 * * * cd /opt/ai-commerce-studio && ./infra/backup-db.sh >> /var/log/acs-backup.log 2>&1`) and before every deployment |
| Retention | 14 daily dumps on the server (`KEEP=14`); encrypted off-site copy (`OFFSITE_CMD`, e.g. restic/rclone to an EU object store) with 30 daily + 6 monthly **(owner: storage provider)** |
| RPO / RTO | up to 24 h of data loss / about 1 h to restore on a fresh server |
| Restore | `docker compose stop web api` → copy the dump into the db container → `dropdb --force` + `createdb` + `pg_restore --no-owner --exit-on-error` → `docker compose up -d api web` (the same steps as `scripts/restore-db.ps1`, verified locally) |
| Test | restore the latest dump into a staging copy once a month and record the result |
| GDPR | dumps contain lead data; deleted leads disappear from backups only when the dump expires — state the backup retention in the privacy policy **(owner)** |

## 7. Monitoring and log retention

| What | How |
| --- | --- |
| Uptime | external monitor (e.g. UptimeRobot, Better Stack) on `https://example.bg/api/health/ready` every 1–5 min; alert by e-mail **(owner: account)** |
| Container health | built-in healthchecks; `docker compose ps` shows `(healthy)`; `restart: unless-stopped` |
| Application logs | structured JSON on stdout with request IDs; no request bodies, prompts or personal data; Docker log rotation 5 × 10 MB per container |
| Proxy logs | Caddy access log with `roll_size 50mb`, `roll_keep 10`, `roll_keep_for 720h` (30 days) |
| Audit trail | `audit_logs` table, `AUDIT_RETENTION_DAYS=1095` |
| Retention job | daily `docker compose exec -T api python -m app.cli maintenance` (cron 02:30) |
| Disk | alert at 80 % (`df -h`); Docker images: `docker image prune -f` monthly |
| Security | `pip-audit` / `npm audit` before every release (`scripts/test.ps1 -Suite audit`); subscribe to Next.js, FastAPI and PostgreSQL security advisories |

## 8. Deployment checklist

Before the first deployment:

- [ ] Legal texts reviewed; `LEGAL_TEXTS_ARE_DRAFTS = false`; company details and contact data filled in **(owner)**
- [ ] Privacy policy lists processors (hosting, e-mail, AI provider if enabled) and backup retention **(owner)**
- [ ] DPA signed with the hosting provider (and Anthropic / SMTP provider if enabled) **(owner)**
- [ ] Server hardened (SSH keys, firewall 22/80/443, automatic security updates)
- [ ] Domain DNS points to the server; Caddyfile has the real domain
- [ ] Production `.env` created on the server with fresh secrets, `chmod 600`
- [ ] `APP_ENV=production`, `SITE_URL=https://…`, `CORS_ORIGINS=https://…`, `COOKIE_SECURE=true`, `SEED_SAMPLE_DATA=false`, `TRUST_PROXY_HEADERS=true`
- [ ] `AI_PROVIDER=mock` unless the AI provider is contractually approved
- [ ] `docker compose … config --quiet` passes; images built

Each release:

- [ ] All suites green locally (`.\scripts\test.ps1`, `-Suite audit`)
- [ ] Release tagged in Git (`git tag v1.x.y`) and the tag noted in the change log
- [ ] Backup taken immediately before (`./infra/backup-db.sh`) and its file name noted
- [ ] `git fetch --tags && git checkout v1.x.y` on the server; `docker compose … build`
- [ ] `docker compose … up -d`; API log shows `alembic upgrade` without errors
- [ ] Smoke test: `/`, `/kontakti` (submit a test inquiry), `/admin` login, the test lead visible, `/api/health/ready`
- [ ] Delete the test lead in the admin UI; check the uptime monitor is green

## 9. Rollback procedure

1. **Application only (no migration in the release):**
   `git checkout <previous tag>` → `docker compose … build` → `docker compose … up -d`.
2. **Release contained a migration:** prefer restoring the pre-deployment backup over
   `alembic downgrade` (downgrades drop columns/tables and therefore data):
   ```bash
   docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml stop web api
   git checkout <previous tag>
   # restore the dump taken just before the deployment (section 6, "Restore")
   docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml up -d --build
   ```
   Data written between the deployment and the rollback is lost — export new leads from the admin UI
   first if needed.
3. Verify with the smoke test above; record the incident (what, when, data impact).

## 10. Not covered / to decide

* Hosting provider, domain, uptime-monitor and off-site storage accounts **(owner)**.
* Real e-mail sending (SMTP) and the Anthropic provider remain disabled until configured and approved.
* No CDN/WAF; add one if traffic or abuse requires it.
* No container image registry or CI/CD pipeline; images are built on the server from a Git tag.
