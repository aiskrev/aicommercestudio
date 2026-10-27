"""FastAPI application factory."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import Settings, get_settings
from app.errors import error_body
from app.i18n import Locale, error_message, request_locale, validation_message
from app.logging_config import configure_logging
from app.middleware import BodySizeLimitMiddleware, RequestContextMiddleware
from app.routers import admin, admin_auth, advisor, health, ops, public, readiness, team

logger = logging.getLogger(__name__)

def _error_field(loc: tuple[Any, ...]) -> str | None:
    """Form field name for an error location. Nested AI Managed Services fields map to the form's
    `ai_<name>` fields; list indexes (e.g. tools.1) map to the list field."""
    if len(loc) < 2 or loc[0] not in ("body", "query", "path"):
        return None
    names = [str(part) for part in loc[1:] if isinstance(part, str)]
    if not names:
        return None
    field = names[-1]
    if "ai_managed" in names[:-1]:
        return field if field.startswith("ai_") else f"ai_{field}"
    return field


def _translate_error(error: dict[str, Any], locale: Locale = "bg") -> dict[str, str | None]:
    field = _error_field(tuple(error.get("loc", ())))
    err_type = error.get("type", "")
    ctx = error.get("ctx") or {}
    if err_type == "value_error" and field == "email":
        message = validation_message("email", locale)
    elif err_type == "value_error" and locale == "bg" and ctx.get("error"):
        message = str(ctx["error"])
    else:
        message = validation_message(err_type, locale, ctx) or validation_message("value_error", locale)
    return {"field": field, "message": message, "type": err_type}


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Backend API for the A.I. Commerce Studio website and admin panel.",
        docs_url="/api/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.docs_enabled else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID"],
        max_age=600,
    )
    app.add_middleware(RequestContextMiddleware, settings=settings)
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_body_bytes)

    def _request_id(request: Request) -> str | None:
        return getattr(request.state, "request_id", None)

    @app.exception_handler(StarletteHTTPException)
    async def _http_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        body = error_body(exc.status_code, exc.detail, getattr(exc, "code", None), _request_id(request))
        # Localize the human-readable message by stable error code (Accept-Language: bg | en).
        if isinstance(body["detail"], str):
            body["detail"] = error_message(body["code"], request_locale(request), body["detail"])
        return JSONResponse(status_code=exc.status_code, content=body, headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        locale = request_locale(request)
        body = error_body(422, error_message("validation_error", locale, ""), "validation_error", _request_id(request))
        body["errors"] = [_translate_error(e, locale) for e in exc.errors()]
        return JSONResponse(status_code=422, content=body)

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", exc_info=exc)
        message = error_message("internal_error", request_locale(request), "")
        body = error_body(500, message, "internal_error", _request_id(request))
        return JSONResponse(status_code=500, content=body)

    app.include_router(health.router)
    app.include_router(public.router)
    app.include_router(advisor.router)
    app.include_router(readiness.router)
    app.include_router(team.router)
    app.include_router(admin_auth.router)
    app.include_router(admin.router)
    app.include_router(ops.router)
    return app


app = create_app()
