# Installation on Windows 11

Verified on 2026-10-23 on Windows 11 Pro with Docker Desktop 29.3.1 (Compose v5.1.1) and PowerShell 7:
a clean copy of the repository (no `.env`, separate Docker project) was set up with the commands
below, a lead was submitted, stored, viewed and updated through the admin API, and all test suites
passed (see [VERIFICATION_REPORT.md](VERIFICATION_REPORT.md)).

Node.js and Python are **not** required on the host — everything builds and runs in containers.
Run all commands in **PowerShell 7** (`pwsh`). Windows PowerShell 5.1 works for `setup.ps1`,
`start.ps1`, `stop.ps1` and `test.ps1`; the demo, backup and restore scripts need PowerShell 7.

## 1. Prerequisites (once)

```powershell
winget install -e --id Microsoft.PowerShell
winget install -e --id Git.Git
winget install -e --id Docker.DockerDesktop
```

Restart Windows after installing Docker Desktop, open it once and accept its terms yourself. WSL 2 is
installed by Docker Desktop if it is missing. Then, in a new PowerShell 7 window:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned   # allow the local helper scripts
docker --version; docker compose version; git --version
```

Free ports on `127.0.0.1`: **3000** (web), **8000** (API), **5433** (PostgreSQL, configurable via
`POSTGRES_HOST_PORT`). Check: `Get-NetTCPConnection -LocalPort 3000,8000,5433 -State Listen -ErrorAction SilentlyContinue`
(no output means the ports are free).

## 2. Prepare `D:\Projects\AI-Commerce-Studio`

**A — fresh clone (recommended):**

```powershell
New-Item -ItemType Directory -Force D:\Projects | Out-Null
git clone https://github.com/aiskrev/aicommercestudio.git D:\Projects\AI-Commerce-Studio
Set-Location D:\Projects\AI-Commerce-Studio
```

**B — move the existing folder `D:\Projects\Site`** (keeps `.env` and the local database):

```powershell
Set-Location D:\Projects\Site
.\scripts\stop.ps1
Set-Location D:\Projects
Move-Item D:\Projects\Site D:\Projects\AI-Commerce-Studio
Set-Location D:\Projects\AI-Commerce-Studio
```

> **Important — one database per machine.** The Docker project name is fixed (`ai-commerce-studio`),
> so every checkout uses the same database volume. If you clone fresh (A) while an older stack from
> `D:\Projects\Site` still has its volume, the new `.env` has a different `POSTGRES_PASSWORD` and the API
> fails with `password authentication failed` (`start.ps1` prints this hint). Either copy the old `.env`
> into the new folder (`Copy-Item D:\Projects\Site\.env D:\Projects\AI-Commerce-Studio\.env`) **before**
> the first start, or back up and remove the old data (section 10, then `.\scripts\stop.ps1 -RemoveData`).

## 3. Configure environment variables

```powershell
.\scripts\setup.ps1        # creates .env from .env.example with random SECRET_KEY, POSTGRES_PASSWORD and dev admin password
notepad .env               # optional: review/change values
```

`setup.ps1` never overwrites an existing `.env` (use `-Force` to regenerate — not after the database
exists, see the note above). `.env` is git-ignored; never commit it.

| Variable | Default | Notes |
| --- | --- | --- |
| `SECRET_KEY`, `POSTGRES_PASSWORD` | generated | required |
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` | `admin@example.com` / generated | first admin for local development (section 7) |
| `SEED_SAMPLE_DATA` | `true` | 7 clearly synthetic leads in development; forced off in production |
| `AI_PROVIDER` / `ANTHROPIC_API_KEY` | `mock` / empty | optional real AI; the key stays in the API container |
| `SMTP_*` | empty | e-mail notifications are off unless configured |
| `CATALOGUE_REVALIDATE_SECRET` | empty | web runtime: enables `POST /api/catalogue-revalidate` (≥ 16 characters); empty = pages refresh every 300 s |
| `SITE_URL`, `PUBLIC_CONTACT_*` | localhost / empty | baked into the web build — rebuild after changing. Empty `PUBLIC_CONTACT_*` means the approved values in `apps/web/src/lib/company.ts` |
| `POSTGRES_HOST_PORT` | `5433` | host port for database tools |

All variables are listed with comments in `.env.example`.

## 4. Start Docker Desktop

```powershell
Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
do { Start-Sleep 3; docker info *> $null } until ($LASTEXITCODE -eq 0)
"Docker is running"
```

## 5. Start everything (one command)

```powershell
.\scripts\start.ps1        # builds images, starts db + api + web, waits until healthy (first build: several minutes)
```

The API container runs `alembic upgrade head`, creates the bootstrap admin (if missing) and, in
development, the synthetic demo data before it starts serving.

### Or step by step

```powershell
docker compose up -d db                                   # PostgreSQL 17 (127.0.0.1:5433)
docker compose ps db                                      # wait for "(healthy)"
docker compose build api web
docker compose run --rm --no-deps api alembic upgrade head    # migrations (also run automatically on API start)
docker compose run --rm --no-deps api alembic current         # should print 0003 (head)
docker compose up -d api                                  # backend on 127.0.0.1:8000
Invoke-RestMethod http://localhost:8000/api/health/ready  # status ok, database ok
docker compose up -d web                                  # frontend on 127.0.0.1:3000
Invoke-RestMethod http://localhost:3000/api/health        # through the same-origin proxy
```

Hot-reload development (sources bind-mounted): `.\scripts\start.ps1 -Dev`.

## 6. Local URLs

| URL | What |
| --- | --- |
| http://localhost:3000 | website (redirects to `/bg`, or to `/en` after choosing English) |
| http://localhost:3000/bg | website in Bulgarian |
| http://localhost:3000/en | website in English |
| http://localhost:3000/bg/kontakti · http://localhost:3000/en/contact | contact / quote form |
| http://localhost:3000/bg/uslugi/ai-managed-services · http://localhost:3000/en/services/ai-managed-services | AI Managed Services page and intake form |
| http://localhost:3000/bg/ai-automation-advisor · http://localhost:3000/en/ai-automation-advisor | AI automation advisor (demo mode without API key) |
| http://localhost:3000/admin | admin panel (redirects to `/admin/login`) |
| http://localhost:8000/api/docs | Swagger UI (development only; off in production). Note: the path is `/api/docs`, not `/docs`. |
| http://localhost:8000/api/health/ready | API + database readiness |
| `127.0.0.1:5433` | PostgreSQL (database/user/password from `.env`) |

## 7. Administrator accounts

**Local development:** `setup.ps1` puts a generated password into `ADMIN_BOOTSTRAP_PASSWORD`; the API
creates `admin@example.com` with it on first start. Read it from `.env` when you need it.

**Create a personal administrator securely** (password typed twice, hidden, never stored in a file):

```powershell
docker compose exec api python -m app.cli create-admin --email you@your-company.bg --name "Име Фамилия"
```

Requirements: ≥ 12 characters, upper and lower case letters and digits. Then remove the bootstrap
credentials (they are only used to create the first account) and restart the API:

```powershell
(Get-Content .env) -replace '^ADMIN_BOOTSTRAP_PASSWORD=.*', 'ADMIN_BOOTSTRAP_PASSWORD=' | Set-Content .env
docker compose up -d api
```

Forgotten password or locked account (clears the lockout and logs out all sessions; audited):

```powershell
docker compose exec api python -m app.cli set-password --email you@your-company.bg
```

Use `docker compose exec` **without** `-T` so the prompt is hidden. Avoid passing passwords on the
command line (`-e ADMIN_PASSWORD=…`) — they end up in the shell history.

## 8. Tests

```powershell
.\scripts\test.ps1                 # pytest + ruff, tsc + eslint + vitest, Playwright (starts the stack)
.\scripts\test.ps1 -Suite api      # backend only
.\scripts\test.ps1 -Suite web      # frontend static checks + unit tests
.\scripts\test.ps1 -Suite e2e      # end-to-end against the running stack
.\scripts\test.ps1 -Suite audit    # pip-audit + npm audit
pwsh .\scripts\demo-lead-flow.ps1  # acceptance path: visitor → PostgreSQL → admin login → view → status change → audit
pwsh .\scripts\demo-advisor.ps1    # AI advisor end to end with synthetic data
```

Pytest uses a separate database `<POSTGRES_DB>_test`. The e2e suite writes a few test leads
(`@example.com`) into the local development database.
Playwright HTML report: `apps\web\e2e\playwright-report\index.html`.

## 9. Daily operation and stopping

```powershell
docker compose ps                         # status
docker compose logs -f api                # structured JSON logs (rotated: 5 × 10 MB per container)
docker compose logs -f web
docker compose restart api
.\scripts\stop.ps1                        # stop and remove containers; data is kept
docker compose stop                       # alternative: stop without removing containers
.\scripts\stop.ps1 -RemoveData            # ALSO deletes the database volume (irreversible — back up first)
```

GDPR retention (leads, audit log, AI advisor assessments, expired sessions):

```powershell
docker compose exec -T api python -m app.cli maintenance --dry-run
docker compose exec -T api python -m app.cli maintenance
```

## 10. Back up and restore the local database

```powershell
pwsh .\scripts\backup-db.ps1                     # -> backups\acs-<timestamp>.dump (pg_dump custom format, verified; keeps 14)
pwsh .\scripts\restore-db.ps1 -File .\backups\acs-20261023-120000.dump   # DESTRUCTIVE: asks you to type RESTORE
```

Backups contain the personal data of leads: the `backups\` folder is git-ignored; keep copies on an
encrypted drive (BitLocker) and delete old ones.

Optional daily schedule (Task Scheduler, current user; adjust the path):

```powershell
$dir = "D:\Projects\AI-Commerce-Studio"
$backup = New-ScheduledTaskAction -Execute "pwsh.exe" -Argument "-NoProfile -File `"$dir\scripts\backup-db.ps1`"" -WorkingDirectory $dir
$maint  = New-ScheduledTaskAction -Execute "docker" -Argument "compose exec -T api python -m app.cli maintenance" -WorkingDirectory $dir
Register-ScheduledTask -TaskName "ACS backup" -Action $backup -Trigger (New-ScheduledTaskTrigger -Daily -At 19:00)
Register-ScheduledTask -TaskName "ACS retention" -Action $maint -Trigger (New-ScheduledTaskTrigger -Daily -At 19:15)
```

(The tasks only run while Docker Desktop is running. Remove them with `Unregister-ScheduledTask -TaskName "ACS backup"`.)

## 11. Working without Docker for the apps (optional, not verified here)

Requires Node.js 24 LTS and Python 3.13 on the host; PostgreSQL still runs in Docker. This path was
**not executed** during verification (the verification machine has neither installed).

```powershell
docker compose up -d db
# API (terminal 1)
Set-Location apps\api
py -3.13 -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
$env:SECRET_KEY = "<SECRET_KEY from .env>"
$env:DATABASE_URL = "postgresql+psycopg://acs:<POSTGRES_PASSWORD from .env>@localhost:5433/acs"
alembic upgrade head; python -m app.cli seed
uvicorn app.main:app --reload --port 8000
# Web (terminal 2)
Set-Location apps\web
npm ci
$env:API_INTERNAL_URL = "http://localhost:8000"
npm run dev
```

## 12. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `failed to connect to the docker API` / `docker info` fails | Start Docker Desktop (section 4) and wait until it is running. |
| `Set POSTGRES_PASSWORD in .env` | Run `.\scripts\setup.ps1`. |
| API keeps restarting, log shows `password authentication failed` | `.env` does not match the existing volume — see the note in section 2. |
| Port already in use | Free the port, or change `POSTGRES_HOST_PORT` / the port mapping in `docker-compose.yml`. |
| Admin login says invalid credentials | Bootstrap admins are created once; changing `.env` later does not change the password. Use `set-password` (section 7). |
| Login answers "Твърде много заявки…" (HTTP 429) | 5 failed logins lock the account for 15 minutes; wait, or clear it with `set-password`. |
| Contact form: "изпратен твърде бързо" | Anti-bot timing check: wait a few seconds after the page loads (`FORM_TOKEN_MIN_SECONDS`). |
| HTTP 429 | Rate limit (contact: 5 per 10 min, advisor: 5 per hour per client). Restarting the API clears the in-memory counters. |
| Changed `SITE_URL` or public contact details | Baked into the web build: `docker compose up --build -d web`. |
| Docker Desktop "unable to start" / WSL errors | Restart Docker Desktop; if needed `wsl --shutdown` and start it again. |
