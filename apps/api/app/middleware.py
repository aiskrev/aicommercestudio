"""HTTP middleware: request IDs, access logging, security headers, origin checks and body limits."""

from __future__ import annotations

import logging
import re
import time
import uuid
from urllib.parse import urlsplit

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import Settings
from app.errors import error_body
from app.i18n import error_message, parse_locale, request_locale
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
            content=error_body(
                403, error_message("origin_rejected", request_locale(request), ""), "origin_rejected", request_id
            ),
        )


class _BodyTooLarge(Exception):
    pass


_UUID = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
# The only routes that take a file: POST of the raw body (never JSON, never multipart) for a new document or a new
# version of one, by the customer's side or by staff. Everything else keeps the small cap.
UPLOAD_PATH = re.compile(rf"^/api/(?:admin/)?projects/{_UUID}/documents(?:/{_UUID}/versions)?$")


def upload_limit(scope: Scope, settings: Settings) -> int | None:
    """The upload size limit when this request is a document upload that the API would read, else None.

    The guard has to agree with the upload routes (`read_body`, `PROJECT_UPLOAD_MAX_BYTES`): a limit that is
    lower than theirs refuses every real document before they can look at it. The allowance needs all of: a POST,
    one of the two upload paths, an `application/octet-stream` body and uploads switched on. The routes still
    authenticate first and enforce the exact limit, content checks and rate limits themselves.
    """
    if scope.get("method") != "POST" or not settings.project_uploads_enabled:
        return None
    if not UPLOAD_PATH.fullmatch(scope.get("path", "")):
        return None
    for name, value in scope.get("headers", []):
        if name == b"content-type":
            media_type = value.decode("latin-1").split(";")[0].strip().lower()
            return settings.project_upload_max_bytes if media_type == "application/octet-stream" else None
    return None


class BodySizeLimitMiddleware:
    """Pure ASGI middleware that caps request bodies, with or without Content-Length.

    `max_bytes` applies everywhere; `settings` lets the document upload routes (see `upload_limit`) have their own,
    larger limit, read per request so a changed setting takes effect without a new middleware.
    """

    def __init__(self, app: ASGIApp, max_bytes: int, settings: Settings | None = None) -> None:
        self.app = app
        self.max_bytes = max_bytes
        self.settings = settings

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        limit = self.max_bytes
        if self.settings is not None:
            # Never below the general cap: a file between the two limits then gets the route's own, clearer answer.
            limit = max(limit, upload_limit(scope, self.settings) or 0)
        for name, value in scope.get("headers", []):
            if name == b"content-length" and (not value.isdigit() or int(value) > limit):
                await self._reject(scope, receive, send)
                return

        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
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
        headers = dict(scope.get("headers") or [])
        locale = parse_locale(headers.get(b"accept-language", b"").decode("latin-1"))
        body = error_body(413, error_message("payload_too_large", locale, ""), "payload_too_large")
        response = JSONResponse(status_code=413, content=body)
        await response(scope, receive, send)
