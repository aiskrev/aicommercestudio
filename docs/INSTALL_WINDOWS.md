# Installation on Windows 11

These steps were executed on Windows 11 Pro with Docker Desktop 29 and PowerShell 7.
Node.js and Python are **not** required on the host — everything builds and runs in containers.

## 1. Prerequisites

| Tool | Notes |
| --- | --- |
| Docker Desktop (WSL 2 backend) | Must be running (whale icon steady). `docker info` should succeed. |
| PowerShell 7+ (or Windows PowerShell 5.1) | All helper scripts support both. |
| Git | Optional, for version control. |
| VS Code | Optional. Recommended extensions: Python, ESLint, Tailwind CSS IntelliSense, Docker. |

Free ports needed on `127.0.0.1`: **3000** (web), **8000** (API), **5433** (PostgreSQL; configurable via `POSTGRES_HOST_PORT`).

If PowerShell refuses to run scripts, allow local scripts for your user once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 2. Project location

The project was generated in `D:\Projects\Site`. To use the preferred location, stop the stack,
then move the folder (the Docker project name is fixed, so the database volume is kept):

```powershell
.\scripts\stop.ps1
Move-Item D:\Projects\Site D:\Projects\AI-Commerce-Studio
cd D:\Projects\AI-Commerce-Studio
```

## 3. First run

```powershell
.\scripts\setup.ps1     # creates .env from .env.example with random secrets; prints the dev admin login
.\scripts\start.ps1     # docker compose up --build -d, then waits until http://localhost:3000 is healthy
```

The first build downloads base images and dependencies (several minutes). On start the API
container automatically:

1. runs database migrations (`alembic upgrade head`),
2. creates the administrator from `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` (only if it does not exist),
3. in development (`SEED_SAMPLE_DATA=true`) loads 7 clearly synthetic demo leads and one pending AI action.

Open:

- http://localhost:3000 — website
- http://localhost:3000/admin — admin panel (log in with the values from `.env`)
- http://localhost:8000/api/docs — Swagger UI (disabled in production)

## 4. Daily commands

```powershell
docker compose ps                     # status
docker compose logs -f api            # API logs (structured JSON)
docker compose logs -f web            # web logs
.\scripts\stop.ps1                    # stop (data is kept)
.\scripts\stop.ps1 -RemoveData        # stop AND delete the database volume (irreversible)
.\scripts\start.ps1 -Dev              # hot-reload mode: sources bind-mounted, file polling enabled
```

Administration commands (inside the API container):

```powershell
# create another administrator (password is prompted, min. 12 chars, mixed case + digits)
docker compose exec api python -m app.cli create-admin --email someone@example.com --name "Име Фамилия"

# GDPR retention: preview, then apply (delete leads untouched > LEAD_RETENTION_DAYS, old audit entries, expired sessions)
docker compose exec api python -m app.cli maintenance --dry-run
docker compose exec api python -m app.cli maintenance
```

To run retention daily, create a Windows Task Scheduler task (or a cron job on the server) that runs
`docker compose -f <path>\docker-compose.yml exec -T api python -m app.cli maintenance`.

Connect to PostgreSQL with any client at `127.0.0.1:5433`, database/user from `.env`.

## 5. Tests

```powershell
.\scripts\test.ps1               # all suites (starts the stack for e2e)
.\scripts\test.ps1 -Suite api    # pytest + ruff
.\scripts\test.ps1 -Suite web    # tsc + eslint + vitest
.\scripts\test.ps1 -Suite e2e    # Playwright against the running stack
.\scripts\test.ps1 -Suite audit  # pip-audit + npm audit
```

See [TESTING.md](TESTING.md).

## 6. Working without Docker for the apps (optional)

Requires Node.js 24 LTS and Python 3.12+ installed locally; PostgreSQL still runs in Docker.

```powershell
docker compose up -d db

# API
cd apps\api
py -3.13 -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
$env:SECRET_KEY = "<value from .env>"; $env:DATABASE_URL = "postgresql+psycopg://acs:<POSTGRES_PASSWORD>@localhost:5433/acs"
alembic upgrade head; python -m app.cli seed
uvicorn app.main:app --reload --port 8000

# Web (second terminal)
cd apps\web
npm ci
$env:API_INTERNAL_URL = "http://localhost:8000"
npm run dev
```

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `failed to connect to the docker API` | Start Docker Desktop and wait until it is running. |
| `Set POSTGRES_PASSWORD in .env` | Run `.\scripts\setup.ps1`. |
| Port already in use | Change the host port mapping in `docker-compose.yml` or `POSTGRES_HOST_PORT` in `.env`. |
| Admin login says invalid credentials after changing `.env` | The admin is only created once. Create a new one with `create-admin`, or reset the DB with `.\scripts\stop.ps1 -RemoveData`. |
| Contact form says it was sent too fast | Anti-bot timing check: wait a few seconds after the page loads (`FORM_TOKEN_MIN_SECONDS`). |
| HTTP 429 on the contact form | Rate limit (5 per 10 minutes per client by default). Restarting the API clears the in-memory counters. |
| Changed `SITE_URL` or public contact details | They are baked into the web build: `docker compose up --build -d web`. |
