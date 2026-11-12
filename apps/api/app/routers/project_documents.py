"""Documents of a customer's commercial project (docs/PROJECT_DOCUMENTS.md). Off with `PROJECT_DOCUMENTS_ENABLED`.

Same rules as the projects routes: a customer session, the caller's own workspace (never an id from the request), a
project looked up inside that workspace only, `no-store` answers. A file is the raw body of an upload (see
`app/projects/doc_schemas.py`); a download is a streamed attachment sent only after the server has authorized it.

Uploading by a customer needs `PROJECT_UPLOADS_ENABLED` and `PROJECT_CLIENT_UPLOADS_ENABLED`; both are off by
default and production refuses them until the review gate is recorded.
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Iterator
from typing import Annotated
from urllib.parse import quote, unquote

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import AfterValidator, Field, ValidationError

from app.accounts import limits
from app.config import get_settings
from app.deps import AppSettings, DbSession, client_ip_hash
from app.errors import ApiError
from app.ops.workflows import sanitize
from app.projects import documents, service
from app.projects.doc_schemas import CommentIn, DecisionIn, DocumentsOut
from app.routers.accounts import Account
from app.routers.projects import Workspace
from app.schemas import StrictModel


def _enabled() -> None:
    settings = get_settings()
    if not (
        settings.project_documents_enabled
        and settings.commercial_projects_enabled
        and settings.customer_accounts_enabled
    ):
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _client_uploads_enabled() -> None:
    settings = get_settings()
    if not (settings.project_uploads_enabled and settings.project_client_uploads_enabled):
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(
    prefix="/api/projects/{project_id}",
    tags=["project-documents"],
    dependencies=[Depends(_enabled), Depends(_no_store)],
)


def raise_for(exc: documents.ProjectError) -> ApiError:
    return ApiError(exc.status, exc.message, exc.code)


# --------------------------------------------------------------------------- upload plumbing (shared with staff)


class UploadMeta(StrictModel):
    filename: Annotated[str, Field(min_length=1, max_length=300)]
    title: Annotated[str, Field(max_length=200), AfterValidator(sanitize)] | None = None
    category: Annotated[str, Field(max_length=16, pattern=r"^[a-z_]+$")] | None = None
    note: Annotated[str, Field(max_length=300), AfterValidator(sanitize)] | None = None
    expected_version: int | None = Field(default=None, ge=0, le=10_000)


def read_meta(request: Request) -> UploadMeta:
    """The upload's metadata from URL-encoded headers (a file name can hold any character)."""

    def header(name: str) -> str | None:
        raw = request.headers.get(name)
        return unquote(raw) if raw else None

    expected = request.headers.get("x-expected-version")
    try:
        return UploadMeta(
            filename=header("x-file-name") or "",
            title=header("x-document-title"),
            category=header("x-document-category"),
            note=header("x-version-note"),
            expected_version=int(expected) if expected and expected.isdigit() else None,
        )
    except ValidationError as exc:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "The upload details are not valid.", "invalid_upload"
        ) from exc


async def read_body(request: Request) -> list[bytes]:
    """The raw body, refused as soon as it is larger than the limit (the header is checked first, then the stream)."""
    limit = get_settings().project_upload_max_bytes
    if (request.headers.get("content-type") or "").split(";")[0].strip().lower() != "application/octet-stream":
        raise ApiError(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Send the file as application/octet-stream.", "unsupported_media"
        )
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise ApiError(status.HTTP_413_CONTENT_TOO_LARGE, "The file is too large.", "file_too_large")
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > limit:
            raise ApiError(status.HTTP_413_CONTENT_TOO_LARGE, "The file is too large.", "file_too_large")
        chunks.append(chunk)
    return chunks


def attachment(version, stream: Iterator[bytes]) -> StreamingResponse:
    """Always an attachment, never sniffed, never cached, never framed or scripted."""
    ascii_name = re.sub(r"[^A-Za-z0-9._-]", "_", version.filename) or "document"
    return StreamingResponse(
        stream,
        media_type=version.content_type,
        headers={
            "Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(version.filename)}",
            "Content-Length": str(version.size_bytes),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )


def _read_limit(account: Account, settings: AppSettings) -> None:
    limits.hit(
        "project-read:account",
        str(account.account.id),
        settings.project_read_rate_limit,
        settings.project_rate_window_seconds,
    )


def _write_limit(account: Account, settings: AppSettings) -> None:
    limits.hit(
        "project-write:account",
        str(account.account.id),
        settings.project_action_rate_limit,
        settings.project_rate_window_seconds,
    )


def _upload_limit(account: Account, settings: AppSettings) -> None:
    limits.hit(
        "project-upload:account",
        str(account.account.id),
        settings.project_upload_rate_limit,
        settings.project_rate_window_seconds,
    )


def _download_limit(account: Account, settings: AppSettings) -> None:
    limits.hit(
        "project-download:account",
        str(account.account.id),
        settings.project_download_rate_limit,
        settings.project_rate_window_seconds,
    )


def _view(db, ctx, account, project) -> DocumentsOut:
    settings = get_settings()
    return documents.client_documents(
        db,
        project,
        account.account.id,
        ctx.role,
        upload=settings.project_uploads_enabled,
        client_upload=settings.project_uploads_enabled and settings.project_client_uploads_enabled,
    )


def _project(db, ctx, project_id, *, lock: bool = False):
    try:
        return service.project_of(db, ctx.workspace.id, project_id, lock=lock)
    except service.ProjectError as exc:
        raise raise_for(exc) from exc


# --------------------------------------------------------------------------- routes


@router.get("/documents", response_model=DocumentsOut, summary="The published documents of the project")
def list_documents(
    project_id: uuid.UUID, account: Account, ctx: Workspace, db: DbSession, settings: AppSettings
) -> DocumentsOut:
    _read_limit(account, settings)
    return _view(db, ctx, account, _project(db, ctx, project_id))


@router.post(
    "/documents",
    status_code=status.HTTP_201_CREATED,
    response_model=DocumentsOut,
    dependencies=[Depends(_client_uploads_enabled)],
    summary="Upload a file as a new document (the raw body; details in X- headers)",
)
async def upload_document(
    project_id: uuid.UUID,
    request: Request,
    response: Response,
    account: Account,
    ctx: Workspace,
    db: DbSession,
    settings: AppSettings,
) -> DocumentsOut:
    _upload_limit(account, settings)
    meta = read_meta(request)
    chunks = await read_body(request)

    def work() -> DocumentsOut:
        project = _project(db, ctx, project_id, lock=True)
        try:
            _doc, _version, created = documents.upload(
                db,
                project,
                origin="client",
                admin=None,
                account=account.account,
                filename=meta.filename,
                chunks=chunks,
                title=meta.title,
                category=meta.category,
                note=meta.note,
                ip_hash=client_ip_hash(request),
            )
        except documents.ProjectError as exc:
            raise raise_for(exc) from exc
        if not created:
            response.status_code = status.HTTP_200_OK
        return _view(db, ctx, account, project)

    return await run_in_threadpool(work)


@router.post(
    "/documents/{document_id}/versions",
    status_code=status.HTTP_201_CREATED,
    response_model=DocumentsOut,
    dependencies=[Depends(_client_uploads_enabled)],
    summary="Upload a new version of a document the customer's side started (X-Expected-Version required)",
)
async def upload_version(
    project_id: uuid.UUID,
    document_id: uuid.UUID,
    request: Request,
    response: Response,
    account: Account,
    ctx: Workspace,
    db: DbSession,
    settings: AppSettings,
) -> DocumentsOut:
    _upload_limit(account, settings)
    meta = read_meta(request)
    chunks = await read_body(request)

    def work() -> DocumentsOut:
        project = _project(db, ctx, project_id, lock=True)
        try:
            document = documents.document_of(db, project, document_id, lock=True)
            documents.require_visible_to_customer(db, document)
            _doc, _version, created = documents.upload(
                db,
                project,
                origin="client",
                admin=None,
                account=account.account,
                filename=meta.filename,
                chunks=chunks,
                note=meta.note,
                document=document,
                expected_version=meta.expected_version,
                ip_hash=client_ip_hash(request),
            )
        except documents.ProjectError as exc:
            raise raise_for(exc) from exc
        if not created:
            response.status_code = status.HTTP_200_OK
        return _view(db, ctx, account, project)

    return await run_in_threadpool(work)


@router.get(
    "/documents/{document_id}/versions/{number}/download",
    response_class=StreamingResponse,
    summary="Download one published version (an attachment; authorized and logged)",
)
def download(
    project_id: uuid.UUID,
    document_id: uuid.UUID,
    number: int,
    request: Request,
    account: Account,
    ctx: Workspace,
    db: DbSession,
    settings: AppSettings,
) -> StreamingResponse:
    _download_limit(account, settings)
    project = _project(db, ctx, project_id)
    try:
        document = documents.document_of(db, project, document_id)
        version, stream = documents.open_download(
            db,
            project,
            document,
            number,
            staff=False,
            label=f"account:{account.account.id}",
            ip_hash=client_ip_hash(request),
        )
    except documents.ProjectError as exc:
        raise raise_for(exc) from exc
    return attachment(version, stream)


@router.post(
    "/documents/{document_id}/comments",
    status_code=status.HTTP_201_CREATED,
    response_model=DocumentsOut,
    summary="Leave feedback on a published version of a document",
)
def comment(
    project_id: uuid.UUID,
    document_id: uuid.UUID,
    payload: CommentIn,
    request: Request,
    account: Account,
    ctx: Workspace,
    db: DbSession,
    settings: AppSettings,
) -> DocumentsOut:
    _write_limit(account, settings)
    project = _project(db, ctx, project_id)
    try:
        document = documents.document_of(db, project, document_id)
        documents.add_comment(
            db,
            project,
            document,
            payload.version,
            payload.body,
            admin=None,
            account=account.account,
            ip_hash=client_ip_hash(request),
        )
    except documents.ProjectError as exc:
        db.rollback()
        raise raise_for(exc) from exc
    return _view(db, ctx, account, project)


@router.post(
    "/approvals/{approval_id}/decision",
    response_model=DocumentsOut,
    summary="Approve or reject the version a request asks about (owner or billing member; once)",
)
def decide(
    project_id: uuid.UUID,
    approval_id: uuid.UUID,
    payload: DecisionIn,
    request: Request,
    account: Account,
    ctx: Workspace,
    db: DbSession,
    settings: AppSettings,
) -> DocumentsOut:
    _write_limit(account, settings)
    project = _project(db, ctx, project_id)
    try:
        # The row lock makes two simultaneous decisions wait; the second finds the first one recorded.
        approval = documents.approval_of(db, project, approval_id, lock=True)
        documents.decide(db, project, approval, payload, account.account, ctx.role, client_ip_hash(request))
    except documents.ProjectError as exc:
        db.rollback()
        raise raise_for(exc) from exc
    return _view(db, ctx, account, project)
