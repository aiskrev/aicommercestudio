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
from app.logging_config import configure_logging
from app.middleware import BodySizeLimitMiddleware, RequestContextMiddleware
from app.routers import admin, admin_auth, advisor, health, public

logger = logging.getLogger(__name__)

_GENERIC_MESSAGES = {
    "missing": "Полето е задължително.",
    "enum": "Изберете валидна стойност.",
    "literal_error": "Изберете валидна стойност.",
    "extra_forbidden": "Непознато поле.",
    "json_invalid": "Невалиден формат на заявката.",
    "uuid_parsing": "Невалиден идентификатор.",
    "bool_parsing": "Невалидна стойност.",
    "bool_type": "Невалидна стойност.",
    "string_type": "Очаква се текст.",
    "datetime_from_date_parsing": "Невалидна дата.",
    "datetime_parsing": "Невалидна дата.",
}


def _translate_error(error: dict[str, Any]) -> dict[str, str | None]:
    loc = error.get("loc", ())
    field = str(loc[-1]) if len(loc) > 1 and loc[0] in ("body", "query", "path") else None
    err_type = error.get("type", "")
    ctx = error.get("ctx") or {}
    if err_type == "string_too_short":
        message = f"Въведете поне {ctx.get('min_length')} символа."
    elif err_type == "string_too_long":
        message = f"Допустими са най-много {ctx.get('max_length')} символа."
    elif err_type == "value_error" and field == "email":
        message = "Въведете валиден имейл адрес."
    elif err_type == "value_error":
        message = str(ctx.get("error") or "Невалидна стойност.")
    else:
        message = _GENERIC_MESSAGES.get(err_type, "Невалидна стойност.")
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
        return JSONResponse(status_code=exc.status_code, content=body, headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        body = error_body(422, "Моля, коригирайте маркираните полета.", "validation_error", _request_id(request))
        body["errors"] = [_translate_error(e) for e in exc.errors()]
        return JSONResponse(status_code=422, content=body)

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", exc_info=exc)
        message = "Възникна вътрешна грешка. Моля, опитайте отново."
        body = error_body(500, message, "internal_error", _request_id(request))
        return JSONResponse(status_code=500, content=body)

    app.include_router(health.router)
    app.include_router(public.router)
    app.include_router(advisor.router)
    app.include_router(admin_auth.router)
    app.include_router(admin.router)
    return app


app = create_app()
