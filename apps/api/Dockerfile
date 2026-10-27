# syntax=docker/dockerfile:1
FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
# DejaVu fonts: Latin + Cyrillic glyphs for the PDF readiness report (reportlab).
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
RUN groupadd --system app && useradd --system --gid app --home-dir /app app && chown app:app /app
COPY requirements.txt ./
RUN pip install -r requirements.txt

# --- development / test image (includes pytest, ruff, pip-audit) ---------------
FROM base AS dev
COPY requirements-dev.txt ./
RUN pip install -r requirements-dev.txt
COPY --chown=app:app . .
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# --- runtime image ------------------------------------------------------------------
FROM base AS runtime
COPY --chown=app:app . .
USER app
EXPOSE 8000
# Migrations + idempotent seed run before the server starts (single-instance V1 setup).
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS_ON_START\" = \"true\" ]; then alembic upgrade head && python -m app.cli seed; fi && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*' --no-server-header"]
