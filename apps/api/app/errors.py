"""Uniform API error envelope.

Every error response has the shape
    {"detail": "<human readable, Bulgarian>", "code": "<machine_readable>", "request_id": "<id>"}
plus `errors` for validation failures. Clients branch on `code`, show `detail`, and quote
`request_id` when reporting a problem (it matches the X-Request-ID header and the API logs).
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

DEFAULT_CODES: dict[int, str] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "payload_too_large",
    422: "validation_error",
    429: "rate_limited",
    500: "internal_error",
    502: "upstream_error",
    503: "unavailable",
}


class ApiError(HTTPException):
    """HTTPException with a stable machine-readable error code."""

    def __init__(self, status_code: int, detail: str, code: str, headers: dict[str, str] | None = None) -> None:
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.code = code


def error_body(status_code: int, detail: Any, code: str | None = None, request_id: str | None = None) -> dict[str, Any]:
    return {
        "detail": detail,
        "code": code or DEFAULT_CODES.get(status_code, "error"),
        "request_id": request_id,
    }
