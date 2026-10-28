"""Admin service catalogue: list, edit the working copy, preview, publish, archive, restore.

Authentication and CSRF are the existing staff session (`app/deps.py`). Roles are enforced here:
viewer reads; editor also creates and edits drafts; admin also publishes, archives and restores.
Every write is audited (`catalogue.*`). Writes need `If-Match: "<revision>"` (optimistic locking).
"""

from __future__ import annotations

import re
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Header, Query, Request, Response, status
from sqlalchemy.exc import IntegrityError

from app import audit
from app.catalogue import admin as service
from app.catalogue import api_schemas as schemas
from app.catalogue import documents, public
from app.catalogue.api_schemas import KEY_PATTERN
from app.deps import CatalogueEditor, CataloguePublisher, CatalogueReader, DbSession
from app.errors import ApiError
from app.i18n import Locale, request_locale
from app.models import CatalogueEntity, CatalogueEntityType

router = APIRouter(prefix="/api/admin/catalogue", tags=["admin-catalogue"])

TRANSITION_AUDIT = {
    "publish": "catalogue.entity_published",
    "archive": "catalogue.entity_archived",
    "restore": "catalogue.entity_restored",
}

IfMatch = Annotated[str | None, Header(description='Current revision as an ETag, e.g. "3".')]


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _entity(db: DbSession, entity_id: uuid.UUID) -> CatalogueEntity:
    entity = service.editable_entity(db, entity_id)
    if entity is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "catalogue_entity_not_found")
    return entity


def _check_revision(entity: CatalogueEntity, if_match: str | None) -> None:
    if not if_match:
        raise ApiError(status.HTTP_428_PRECONDITION_REQUIRED, "If-Match required.", "precondition_required")
    match = re.fullmatch(r'\s*(?:W/)?"?(\d+)"?\s*', if_match)
    if match is None or int(match.group(1)) != entity.revision:
        raise ApiError(
            status.HTTP_412_PRECONDITION_FAILED,
            "Revision conflict.",
            "revision_conflict",
            headers={"ETag": f'"{entity.revision}"'},
        )


def _field_errors(problems: list[documents.Problem], locale: Locale, code: str = "validation_error") -> ApiError:
    return ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid.", code, errors=service.localize(problems, locale))


def _out(db: DbSession, entity: CatalogueEntity, role: str, response: Response) -> schemas.EntityOut:
    _no_store(response)
    response.headers["ETag"] = f'"{entity.revision}"'
    return service.entity_out(db, entity, role)


def _audit(db: DbSession, ctx, action: str, entity: CatalogueEntity, **details) -> None:
    audit.record(
        db,
        action,
        actor=ctx.user,
        entity_type=f"catalogue.{entity.entity_type}",
        entity_id=str(entity.id),
        details={"key": entity.key, "revision": entity.revision, **details},
        ip_hash=ctx.ip_hash,
    )


@router.get("/entities", response_model=schemas.EntityPage)
def list_entities(
    ctx: CatalogueReader,
    db: DbSession,
    response: Response,
    type_filter: Annotated[Literal["domain", "service"] | None, Query(alias="type")] = None,
    status_filter: Annotated[schemas.Status | None, Query(alias="status")] = None,
    offering_type: schemas.Offering | None = None,
    domain: Annotated[str | None, Query(pattern=KEY_PATTERN)] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1, le=1000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> schemas.EntityPage:
    _no_store(response)
    filters = service.EntityFilters(
        type=type_filter, status=status_filter, q=q or None, domain=domain, offering_type=offering_type
    )
    items, total = service.list_entities(db, filters, page, page_size)
    return schemas.EntityPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/options", response_model=schemas.OptionsOut)
def options(ctx: CatalogueReader, db: DbSession, response: Response) -> schemas.OptionsOut:
    _no_store(response)
    return service.options(db, ctx.user.role)


@router.post("/entities", response_model=schemas.EntityOut, status_code=status.HTTP_201_CREATED)
def create_entity(
    payload: schemas.EntityCreate, ctx: CatalogueEditor, db: DbSession, request: Request, response: Response
) -> schemas.EntityOut:
    """Create a draft service, assessment or workshop (domains are fixed by the taxonomy)."""
    try:
        entity = service.create_service(db, payload, ctx.user.id)
    except service.KeyTaken as exc:
        raise ApiError(status.HTTP_409_CONFLICT, "Key taken.", "key_taken") from exc
    except service.FieldErrors as exc:
        raise _field_errors(exc.problems, request_locale(request)) from exc
    _audit(db, ctx, "catalogue.entity_created", entity, offering_type=payload.offering_type)
    db.commit()
    return _out(db, entity, ctx.user.role, response)


@router.get("/entities/{entity_id}", response_model=schemas.EntityOut)
def get_entity(entity_id: uuid.UUID, ctx: CatalogueReader, db: DbSession, response: Response) -> schemas.EntityOut:
    return _out(db, _entity(db, entity_id), ctx.user.role, response)


@router.patch("/entities/{entity_id}", response_model=schemas.EntityOut)
def update_entity(
    entity_id: uuid.UUID,
    payload: schemas.EntityUpdate,
    ctx: CatalogueEditor,
    db: DbSession,
    request: Request,
    response: Response,
    if_match: IfMatch = None,
) -> schemas.EntityOut:
    """Save the working copy (draft). The public API is unaffected until the entry is published."""
    entity = _entity(db, entity_id)
    _check_revision(entity, if_match)
    if entity.status == "archived":
        raise ApiError(status.HTTP_409_CONFLICT, "Archived.", "invalid_transition")
    try:
        changed = service.update_entity(db, entity, payload, ctx.user.id)
    except service.FieldErrors as exc:
        db.rollback()
        raise _field_errors(exc.problems, request_locale(request)) from exc
    if changed:
        _audit(db, ctx, "catalogue.entity_updated", entity, fields=changed)
    try:
        db.commit()
    except IntegrityError as exc:  # a concurrent write took the same slug
        db.rollback()
        raise ApiError(status.HTTP_409_CONFLICT, "Conflict.", "slug_taken") from exc
    return _out(db, entity, ctx.user.role, response)


@router.get("/entities/{entity_id}/checks", response_model=schemas.ChecksOut)
def entity_checks(
    entity_id: uuid.UUID, ctx: CatalogueReader, db: DbSession, request: Request, response: Response
) -> schemas.ChecksOut:
    """What would block publishing right now (both locales)."""
    _no_store(response)
    entity = _entity(db, entity_id)
    problems = documents.publication_problems(db, entity, documents.build_document(db, entity))
    errors = [schemas.FieldProblem(**e) for e in service.localize(problems, request_locale(request))]
    return schemas.ChecksOut(publishable=not problems and entity.status != "archived", errors=errors)


@router.get("/entities/{entity_id}/preview", response_model=schemas.ServiceDetail | schemas.DomainDetail)
def preview_entity(
    entity_id: uuid.UUID,
    ctx: CatalogueReader,
    db: DbSession,
    request: Request,
    response: Response,
    locale: Literal["bg", "en"] | None = None,
):
    """The public representation the working copy would have once published (staff only, never cached)."""
    _no_store(response)
    entity = _entity(db, entity_id)
    loc: Locale = locale or request_locale(request)
    document = documents.build_document(db, entity)
    problems = documents.publication_problems(db, entity, document)
    if problems:
        raise _field_errors(problems, request_locale(request), "catalogue_incomplete")
    catalogue = public.published_catalogue(db).with_document(document)
    if entity.entity_type == CatalogueEntityType.DOMAIN:
        return public.domain_detail(catalogue, document, loc)
    return public.service_detail(catalogue, document, loc)


def _transition(
    entity_id: uuid.UUID, action: str, ctx, db: DbSession, request: Request, response: Response, if_match: str | None
) -> schemas.EntityOut:
    entity = _entity(db, entity_id)
    _check_revision(entity, if_match)
    try:
        if action == "publish":
            problems = documents.publish(db, entity, actor_id=ctx.user.id)
            if problems:
                raise _field_errors(problems, request_locale(request), "catalogue_incomplete")
        elif action == "archive":
            documents.archive(entity)
        else:
            documents.restore(entity)
    except documents.TransitionError as exc:
        raise ApiError(status.HTTP_409_CONFLICT, "Not possible.", exc.code) from exc
    entity.updated_by_id = ctx.user.id
    _audit(db, ctx, TRANSITION_AUDIT[action], entity)
    db.commit()
    return _out(db, entity, ctx.user.role, response)


@router.post("/entities/{entity_id}/publish", response_model=schemas.EntityOut)
def publish_entity(
    entity_id: uuid.UUID,
    ctx: CataloguePublisher,
    db: DbSession,
    request: Request,
    response: Response,
    if_match: IfMatch = None,
) -> schemas.EntityOut:
    """Publish the current working copy (both locales must be complete)."""
    return _transition(entity_id, "publish", ctx, db, request, response, if_match)


@router.post("/entities/{entity_id}/archive", response_model=schemas.EntityOut)
def archive_entity(
    entity_id: uuid.UUID,
    ctx: CataloguePublisher,
    db: DbSession,
    request: Request,
    response: Response,
    if_match: IfMatch = None,
) -> schemas.EntityOut:
    """Withdraw a service from the public API (domains are fixed and cannot be archived)."""
    return _transition(entity_id, "archive", ctx, db, request, response, if_match)


@router.post("/entities/{entity_id}/restore", response_model=schemas.EntityOut)
def restore_entity(
    entity_id: uuid.UUID,
    ctx: CataloguePublisher,
    db: DbSession,
    request: Request,
    response: Response,
    if_match: IfMatch = None,
) -> schemas.EntityOut:
    """Archived → draft; publish again to make it public."""
    return _transition(entity_id, "restore", ctx, db, request, response, if_match)


@router.delete("/entities/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entity(
    entity_id: uuid.UUID, ctx: CataloguePublisher, db: DbSession, if_match: IfMatch = None
) -> Response:
    """Delete a draft that was never published and that nothing links to; otherwise archive it."""
    entity = _entity(db, entity_id)
    _check_revision(entity, if_match)
    _audit(db, ctx, "catalogue.entity_deleted", entity)
    try:
        service.delete_draft(db, entity)
    except service.DeleteError as exc:
        db.rollback()
        raise ApiError(status.HTTP_409_CONFLICT, "Not possible.", exc.code) from exc
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers={"Cache-Control": "no-store"})


@router.get("/entities/{entity_id}/history", response_model=list[schemas.HistoryEntry])
def entity_history(
    entity_id: uuid.UUID, ctx: CatalogueReader, db: DbSession, response: Response
) -> list[schemas.HistoryEntry]:
    _no_store(response)
    return service.history(db, _entity(db, entity_id))
