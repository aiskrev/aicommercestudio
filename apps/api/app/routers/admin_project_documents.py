"""Documents of a commercial project, for staff (docs/PROJECT_DOCUMENTS.md). Off with `PROJECT_DOCUMENTS_ENABLED`.

Every route needs the `admin` role (editors and viewers reach only the catalogue, never customer data).
Uploading also needs `PROJECT_UPLOADS_ENABLED`. A draft version is visible to staff only until an
administrator publishes it; the customer sees nothing before that.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.deps import Admin, DbSession, client_ip_hash
from app.errors import ApiError
from app.projects import documents, service
from app.projects.doc_schemas import ApprovalRequestIn, CommentIn, ScanIn, StaffDocumentsOut
from app.routers.project_documents import attachment, raise_for, read_body, read_meta


def _enabled() -> None:
    settings = get_settings()
    if not (settings.project_documents_enabled and settings.commercial_projects_enabled):
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _uploads_enabled() -> None:
    if not get_settings().project_uploads_enabled:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(
    prefix="/api/admin/projects/{project_id}",
    tags=["admin-project-documents"],
    dependencies=[Depends(_enabled), Depends(_no_store)],
)


def _project(db: DbSession, project_id: uuid.UUID, *, lock: bool = False):
    project = service.get(db, project_id, lock=lock)
    if project is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Project not found.", "project_not_found")
    return project


def _view(db: DbSession, project) -> StaffDocumentsOut:
    settings = get_settings()
    return documents.staff_documents(
        db,
        project,
        upload=settings.project_uploads_enabled,
        client_upload=settings.project_uploads_enabled and settings.project_client_uploads_enabled,
    )


@router.get("/documents", response_model=StaffDocumentsOut, summary="Every document of the project, drafts included")
def list_documents(project_id: uuid.UUID, request: Request, ctx: Admin, db: DbSession) -> StaffDocumentsOut:
    project = _project(db, project_id)
    service.record_view(db, project, ctx.user, client_ip_hash(request), action="project_document.listed")
    return _view(db, project)


@router.post(
    "/documents",
    status_code=status.HTTP_201_CREATED,
    response_model=StaffDocumentsOut,
    dependencies=[Depends(_uploads_enabled)],
    summary="Upload a file as a new draft document (the raw body; details in X- headers)",
)
async def upload_document(
    project_id: uuid.UUID, request: Request, response: Response, ctx: Admin, db: DbSession
) -> StaffDocumentsOut:
    meta = read_meta(request)
    chunks = await read_body(request)

    def work() -> StaffDocumentsOut:
        project = _project(db, project_id, lock=True)
        try:
            _doc, _version, created = documents.upload(
                db,
                project,
                origin="staff",
                admin=ctx.user,
                account=None,
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
        return _view(db, project)

    return await run_in_threadpool(work)


@router.post(
    "/documents/{document_id}/versions",
    status_code=status.HTTP_201_CREATED,
    response_model=StaffDocumentsOut,
    dependencies=[Depends(_uploads_enabled)],
    summary="Upload a new version of a team document (X-Expected-Version required)",
)
async def upload_version(
    project_id: uuid.UUID, document_id: uuid.UUID, request: Request, response: Response, ctx: Admin, db: DbSession
) -> StaffDocumentsOut:
    meta = read_meta(request)
    chunks = await read_body(request)

    def work() -> StaffDocumentsOut:
        project = _project(db, project_id, lock=True)
        try:
            document = documents.document_of(db, project, document_id, lock=True)
            _doc, _version, created = documents.upload(
                db,
                project,
                origin="staff",
                admin=ctx.user,
                account=None,
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
        return _view(db, project)

    return await run_in_threadpool(work)


@router.get(
    "/documents/{document_id}/versions/{number}/download",
    response_class=StreamingResponse,
    summary="Download any version that was not found infected (an attachment; logged)",
)
def download(project_id: uuid.UUID, document_id: uuid.UUID, number: int, request: Request, ctx: Admin, db: DbSession):
    project = _project(db, project_id)
    try:
        document = documents.document_of(db, project, document_id)
        version, stream = documents.open_download(
            db, project, document, number, staff=True, label=f"admin:{ctx.user.id}", ip_hash=client_ip_hash(request)
        )
    except documents.ProjectError as exc:
        raise raise_for(exc) from exc
    return attachment(version, stream)


def _act(db: DbSession, project_id: uuid.UUID, document_id: uuid.UUID, action):
    project = _project(db, project_id, lock=True)
    try:
        document = documents.document_of(db, project, document_id, lock=True)
        action(project, document)
    except documents.ProjectError as exc:
        db.rollback()
        raise raise_for(exc) from exc
    return _view(db, project)


@router.post(
    "/documents/{document_id}/versions/{number}/publish",
    response_model=StaffDocumentsOut,
    summary="Publish a draft version to the customer (a repeat changes nothing)",
)
def publish(project_id: uuid.UUID, document_id: uuid.UUID, number: int, request: Request, ctx: Admin, db: DbSession):
    return _act(
        db,
        project_id,
        document_id,
        lambda project, document: documents.publish(
            db, project, document, documents.version_of(db, document, number), ctx.user, client_ip_hash(request)
        ),
    )


@router.post(
    "/documents/{document_id}/versions/{number}/withdraw",
    response_model=StaffDocumentsOut,
    summary="Take a version back from the customer (closes its open approval request)",
)
def withdraw(project_id: uuid.UUID, document_id: uuid.UUID, number: int, request: Request, ctx: Admin, db: DbSession):
    return _act(
        db,
        project_id,
        document_id,
        lambda project, document: documents.withdraw(
            db, project, document, documents.version_of(db, document, number), ctx.user, client_ip_hash(request)
        ),
    )


@router.post(
    "/documents/{document_id}/versions/{number}/scan",
    response_model=StaffDocumentsOut,
    summary="Record the result of a malware scan or a manual check (the system runs no scanner itself)",
)
def scan(
    project_id: uuid.UUID,
    document_id: uuid.UUID,
    number: int,
    payload: ScanIn,
    request: Request,
    ctx: Admin,
    db: DbSession,
):
    return _act(
        db,
        project_id,
        document_id,
        lambda project, document: documents.record_scan(
            db,
            project,
            document,
            documents.version_of(db, document, number),
            payload.result,
            ctx.user,
            client_ip_hash(request),
        ),
    )


@router.post(
    "/documents/{document_id}/versions/{number}/approvals",
    status_code=status.HTTP_201_CREATED,
    response_model=StaffDocumentsOut,
    summary="Ask the customer to approve or reject the latest published version (a repeat returns the open request)",
)
def request_approval(
    project_id: uuid.UUID,
    document_id: uuid.UUID,
    number: int,
    payload: ApprovalRequestIn,
    request: Request,
    response: Response,
    ctx: Admin,
    db: DbSession,
):
    created: list[bool] = []

    def action(project, document):
        _approval, was_new = documents.request_approval(
            db,
            project,
            document,
            documents.version_of(db, document, number),
            ctx.user,
            payload.message,
            client_ip_hash(request),
        )
        created.append(was_new)

    result = _act(db, project_id, document_id, action)
    if created and not created[0]:
        response.status_code = status.HTTP_200_OK
    return result


@router.post(
    "/approvals/{approval_id}/withdraw", response_model=StaffDocumentsOut, summary="Withdraw an open approval request"
)
def withdraw_approval(project_id: uuid.UUID, approval_id: uuid.UUID, request: Request, ctx: Admin, db: DbSession):
    project = _project(db, project_id, lock=True)
    try:
        approval = documents.approval_of(db, project, approval_id, lock=True)
        documents.withdraw_approval(db, project, approval, ctx.user, client_ip_hash(request))
    except documents.ProjectError as exc:
        db.rollback()
        raise raise_for(exc) from exc
    return _view(db, project)


@router.post(
    "/documents/{document_id}/archive",
    response_model=StaffDocumentsOut,
    summary="Archive a document (hidden from the customer)",
)
def archive(project_id: uuid.UUID, document_id: uuid.UUID, request: Request, ctx: Admin, db: DbSession):
    return _act(
        db,
        project_id,
        document_id,
        lambda project, document: documents.archive(db, project, document, ctx.user, client_ip_hash(request)),
    )


@router.post(
    "/documents/{document_id}/comments",
    status_code=status.HTTP_201_CREATED,
    response_model=StaffDocumentsOut,
    summary="Answer or add a comment on a published version",
)
def comment(
    project_id: uuid.UUID, document_id: uuid.UUID, payload: CommentIn, request: Request, ctx: Admin, db: DbSession
):
    return _act(
        db,
        project_id,
        document_id,
        lambda project, document: documents.add_comment(
            db,
            project,
            document,
            payload.version,
            payload.body,
            admin=ctx.user,
            account=None,
            ip_hash=client_ip_hash(request),
        ),
    )
