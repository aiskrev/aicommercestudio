"""HTTP middleware: request IDs, access logging, security headers, origin checks and body limits."""

from __future__ import annotations

import logging
import time
import uuid
from urllib.parse import urlsplit

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import Settings
from app.errors import error_body
from app.logging_config import request_id_ctx

logger = logging.getLogger("app.request")

UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns a request ID, logs one structured line per request and adds security headers."""

    def __init__(self, app: ASGIApp, settings: Settings) -> None:
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get("x-request-id", "")
        request_id = incoming if 8 <= len(incoming) <= 64 and incoming.isalnum() else uuid.uuid4().hex
        token = request_id_ctx.set(request_id)
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            rejection = self._check_origin(request, request_id)
            response = rejection or await call_next(request)
        finally:
            request_id_ctx.reset(token)
        duration_ms = round((time.perf_counter() - started) * 1000, 1)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        if not request.url.path.startswith(("/api/docs", "/api/redoc")):
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if self.settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        if request.url.path.startswith("/api/admin"):
            response.headers.setdefault("Cache-Control", "no-store")

        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response

    def _check_origin(self, request: Request, request_id: str) -> Response | None:
        """Reject cross-site state-changing requests (defence in depth on top of CSRF tokens)."""
        if request.method not in UNSAFE_METHODS or not request.url.path.startswith("/api/"):
            return None
        origin = request.headers.get("origin")
        if not origin:
            return None  # non-browser clients; admin writes still need the CSRF token
        origin = origin.rstrip("/")
        if origin in self.settings.cors_origin_list:
            return None
        origin_host = urlsplit(origin).netloc
        forwarded_host = request.headers.get("x-forwarded-host") if self.settings.trust_proxy_headers else None
        if origin_host and origin_host in {forwarded_host, request.headers.get("host")}:
            return None
        logger.warning("origin_rejected", extra={"origin": origin[:100], "path": request.url.path})
        return JSONResponse(
            status_code=403,
            content=error_body(403, "Заявката е отхвърлена (невалиден произход).", "origin_rejected", request_id),
        )


class _BodyTooLarge(Exception):
    pass


class BodySizeLimitMiddleware:
    """Pure ASGI middleware that caps request bodies, with or without Content-Length."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        for name, value in scope.get("headers", []):
            if name == b"content-length" and (not value.isdigit() or int(value) > self.max_bytes):
                await self._reject(scope, receive, send)
                return

        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _BodyTooLarge
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _BodyTooLarge:
            if not response_started:
                await self._reject(scope, receive, send)

    @staticmethod
    async def _reject(scope: Scope, receive: Receive, send: Send) -> None:
        body = error_body(413, "Заявката е твърде голяма.", "payload_too_large")
        response = JSONResponse(status_code=413, content=body)
        await response(scope, receive, send)
