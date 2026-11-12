"""Project documents: upload, versions, publication, download, approval and feedback (docs/PROJECT_DOCUMENTS.md).

Rules, all enforced here and tested:

* A document belongs to one project and so to one workspace. Every function receives the project the caller already
  resolved for *their own* workspace (or staff's explicit project); a document id is only ever looked up inside it.
* The team uploads drafts; a draft is invisible to the customer until an administrator **publishes** that version
  (staff publication approval). A customer's own upload is visible to the team and to the customer's workspace at once.
* Versions are numbered and immutable. A new file is a new version and must name the version the uploader saw
  (`expected_version`); the same bytes again changes nothing.
* A customer can download only a published, scanned (when scanning is required) version of a document of their own
  project. Every download is authorized on the server and logged.
* An approval request asks for a decision on the *latest published* version. Publishing a newer version supersedes an
  open request; withdrawing or archiving closes it. A decision is made once, by the owner or a `billing` member, and
  records who, which project, which version, what and when; repeating it changes nothing, contradicting it is refused.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable, Iterator
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import audit
from app.accounts.models import CustomerAccount, OutboxKind
from app.config import get_settings
from app.models import AdminUser, utcnow
from app.projects import filecheck, notify, storage
from app.projects.doc_models import (
    CATEGORIES,
    CLIENT_CATEGORIES,
    DocumentApproval,
    DocumentComment,
    ProjectDocument,
    ProjectDocumentVersion,
)
from app.projects.doc_schemas import (
    ApprovalOut,
    CommentOut,
    DecisionIn,
    DocumentOut,
    DocumentsOut,
    LimitsOut,
    StaffDocumentOut,
    StaffDocumentsOut,
    StaffVersionOut,
    VersionOut,
)
from app.projects.models import CommercialProject
from app.projects.service import APPROVER_ROLES, ProjectError, _event, _owner  # noqa: F401  (shared project rules)

DRAFT = "draft"


def _error(status: int, code: str, message: str) -> ProjectError:
    return ProjectError(status, code, message)


def _audit(
    db: Session, action: str, project: CommercialProject, label: str, ip_hash: str | None, **details: object
) -> None:
    audit.record(
        db,
        action,
        actor_label=label,
        entity_type="project_document",
        entity_id=str(details.get("document", project.id)),
        details={"project": str(project.id), "reference": project.reference, **details},
        ip_hash=ip_hash,
    )


def _visible_project(project: CommercialProject) -> None:
    if project.status == "draft":
        raise _error(409, "project_draft", "The customer cannot see a draft project yet.")


# --------------------------------------------------------------------------- reads


def limits(*, upload: bool, client_upload: bool) -> LimitsOut:
    settings = get_settings()
    return LimitsOut(
        max_bytes=settings.project_upload_max_bytes,
        extensions=filecheck.describe(),
        categories=list(CATEGORIES),
        client_categories=list(CLIENT_CATEGORIES),
        upload=upload,
        client_upload=client_upload,
    )


def _versions(db: Session, document: ProjectDocument) -> list[ProjectDocumentVersion]:
    return list(
        db.scalars(
            select(ProjectDocumentVersion)
            .where(ProjectDocumentVersion.document_id == document.id)
            .order_by(ProjectDocumentVersion.number)
        ).all()
    )


def _approvals(db: Session, project: CommercialProject) -> dict[uuid.UUID, list[DocumentApproval]]:
    out: dict[uuid.UUID, list[DocumentApproval]] = {}
    rows = db.scalars(
        select(DocumentApproval)
        .where(DocumentApproval.project_id == project.id)
        .order_by(DocumentApproval.created_at, DocumentApproval.id)
    ).all()
    for row in rows:
        out.setdefault(row.version_id, []).append(row)
    return out


def _approval_out(row: DocumentApproval, number: int, viewer: uuid.UUID | None, *, staff: bool = False) -> ApprovalOut:
    decided_by = None
    if row.decided_at is not None:
        decided_by = "you" if viewer is not None and row.decided_by_account_id == viewer else "member"
    return ApprovalOut(
        id=row.id,
        version=number,
        state=row.state,
        message=row.message,
        requested_at=row.created_at,
        decided_at=row.decided_at,
        decision_note=row.decision_note,
        decided_by=decided_by,
    )


def _current_approval(rows: list[DocumentApproval] | None) -> DocumentApproval | None:
    """The open request, or else the latest one: what the page shows next to a version."""
    if not rows:
        return None
    for row in reversed(rows):
        if row.state == "pending":
            return row
    return rows[-1]


def _comments(db: Session, document: ProjectDocument, numbers: dict[uuid.UUID, int], viewer: uuid.UUID | None):
    rows = db.scalars(
        select(DocumentComment).where(DocumentComment.document_id == document.id).order_by(DocumentComment.created_at)
    ).all()
    return [
        CommentOut(
            id=row.id,
            version=numbers.get(row.version_id, 0),
            author="client" if row.author_kind == "client" else "team",
            mine=viewer is not None and row.author_account_id == viewer,
            body=row.body,
            created_at=row.created_at,
        )
        for row in rows
    ]


def _scan_allows_customer(version: ProjectDocumentVersion) -> bool:
    if version.scan_status == "infected":
        return False
    return version.scan_status == "clean" or not get_settings().project_upload_require_scan


def client_documents(
    db: Session, project: CommercialProject, account_id: uuid.UUID, role: str, *, upload: bool, client_upload: bool
) -> DocumentsOut:
    approvals = _approvals(db, project)
    documents = db.scalars(
        select(ProjectDocument)
        .where(ProjectDocument.project_id == project.id, ProjectDocument.archived_at.is_(None))
        .order_by(ProjectDocument.created_at, ProjectDocument.id)
    ).all()
    out: list[DocumentOut] = []
    for document in documents:
        versions = [v for v in _versions(db, document) if v.state == "published"]
        if not versions:
            continue
        numbers = {v.id: v.number for v in versions}
        out.append(
            DocumentOut(
                id=document.id,
                title=document.title,
                category=document.category,
                origin=document.origin,
                revision=document.revision,
                archived=False,
                created_at=document.created_at,
                versions=[
                    VersionOut(
                        number=v.number,
                        filename=v.filename,
                        content_type=v.content_type,
                        size_bytes=v.size_bytes,
                        sha256=v.sha256,
                        note=v.note,
                        state=v.state,
                        published_at=v.published_at,
                        created_at=v.created_at,
                        uploaded_by="client" if v.uploaded_by_kind == "client" else "team",
                        mine=v.uploaded_by_account_id == account_id,
                        downloadable=v.purged_at is None and _scan_allows_customer(v),
                        approval=(
                            _approval_out(a, v.number, account_id)
                            if (a := _current_approval(approvals.get(v.id)))
                            else None
                        ),
                    )
                    for v in versions
                ],
                comments=_comments(db, document, numbers, account_id),
                can_add_version=client_upload and document.origin == "client",
            )
        )
    return DocumentsOut(
        documents=out,
        limits=limits(upload=upload, client_upload=client_upload),
        can_decide=role in APPROVER_ROLES,
    )


def staff_documents(db: Session, project: CommercialProject, *, upload: bool, client_upload: bool) -> StaffDocumentsOut:
    approvals = _approvals(db, project)
    documents = db.scalars(
        select(ProjectDocument)
        .where(ProjectDocument.project_id == project.id)
        .order_by(ProjectDocument.created_at, ProjectDocument.id)
    ).all()
    out: list[StaffDocumentOut] = []
    for document in documents:
        versions = _versions(db, document)
        numbers = {v.id: v.number for v in versions}
        admins = {
            a.id: a.full_name
            for a in db.scalars(
                select(AdminUser).where(
                    AdminUser.id.in_(
                        {v.uploaded_by_admin_id for v in versions if v.uploaded_by_admin_id}
                        | {document.created_by_admin_id} - {None}
                    )
                )
            ).all()
        }
        out.append(
            StaffDocumentOut(
                id=document.id,
                title=document.title,
                category=document.category,
                origin=document.origin,
                revision=document.revision,
                archived=document.archived_at is not None,
                created_at=document.created_at,
                retain_until=document.retain_until,
                created_by_label=admins.get(document.created_by_admin_id) if document.created_by_admin_id else "client",
                versions=[
                    StaffVersionOut(
                        number=v.number,
                        filename=v.filename,
                        content_type=v.content_type,
                        size_bytes=v.size_bytes,
                        sha256=v.sha256,
                        note=v.note,
                        state=v.state,
                        published_at=v.published_at,
                        created_at=v.created_at,
                        uploaded_by="client" if v.uploaded_by_kind == "client" else "team",
                        mine=False,
                        downloadable=v.purged_at is None and v.scan_status != "infected",
                        approval=(
                            _approval_out(a, v.number, None) if (a := _current_approval(approvals.get(v.id))) else None
                        ),
                        scan_status=v.scan_status,
                        scanned_at=v.scanned_at,
                        uploaded_by_label=admins.get(v.uploaded_by_admin_id) if v.uploaded_by_admin_id else "client",
                        purged=v.purged_at is not None,
                    )
                    for v in versions
                ],
                comments=_comments(db, document, numbers, None),
                can_add_version=document.archived_at is None and document.origin == "staff" and upload,
            )
        )
    return StaffDocumentsOut(documents=out, limits=limits(upload=upload, client_upload=client_upload))


# --------------------------------------------------------------------------- lookups


def document_of(
    db: Session, project: CommercialProject, document_id: uuid.UUID, *, lock: bool = False
) -> ProjectDocument:
    """A document of this project only: another project's document answers exactly like a missing one."""
    query = select(ProjectDocument).where(ProjectDocument.id == document_id, ProjectDocument.project_id == project.id)
    if lock:
        query = query.with_for_update()
    document = db.scalar(query)
    if document is None:
        raise _error(404, "document_not_found", "Not found.")
    return document


def require_visible_to_customer(db: Session, document: ProjectDocument) -> None:
    """A document the customer cannot see (archived, or with no published version) answers like a missing one."""
    if document.archived_at is not None or _latest_published(db, document) is None:
        raise _error(404, "document_not_found", "Not found.")


def version_of(db: Session, document: ProjectDocument, number: int) -> ProjectDocumentVersion:
    version = db.scalar(
        select(ProjectDocumentVersion).where(
            ProjectDocumentVersion.document_id == document.id, ProjectDocumentVersion.number == number
        )
    )
    if version is None:
        raise _error(404, "document_not_found", "Not found.")
    return version


def _latest(db: Session, document: ProjectDocument) -> ProjectDocumentVersion | None:
    return db.scalar(
        select(ProjectDocumentVersion)
        .where(ProjectDocumentVersion.document_id == document.id)
        .order_by(ProjectDocumentVersion.number.desc())
        .limit(1)
    )


def _latest_published(db: Session, document: ProjectDocument) -> ProjectDocumentVersion | None:
    return db.scalar(
        select(ProjectDocumentVersion)
        .where(ProjectDocumentVersion.document_id == document.id, ProjectDocumentVersion.state == "published")
        .order_by(ProjectDocumentVersion.number.desc())
        .limit(1)
    )


# --------------------------------------------------------------------------- upload


def upload(
    db: Session,
    project: CommercialProject,
    *,
    origin: str,
    admin: AdminUser | None,
    account: CustomerAccount | None,
    filename: str,
    chunks: Iterable[bytes],
    title: str | None = None,
    category: str | None = None,
    note: str | None = None,
    document: ProjectDocument | None = None,
    expected_version: int | None = None,
    ip_hash: str | None = None,
) -> tuple[ProjectDocument, ProjectDocumentVersion, bool]:
    """Stores one file as the first version of a new document, or as the next version of `document`.

    Returns (document, version, created). The caller holds the project's row lock (and the document's). Nothing is
    kept when the file is refused: the stored bytes are removed again.
    """
    settings = get_settings()
    label = f"admin:{admin.id}" if admin else f"account:{account.id if account else '-'}"
    try:
        kind = filecheck.type_for(filename)
    except filecheck.FileRejected as exc:
        raise _error(422, exc.code, exc.message) from exc
    clean_name = filecheck.clean_filename(filename)

    if document is None:
        if category not in CATEGORIES or (origin == "client" and category not in CLIENT_CATEGORIES):
            raise _error(422, "category_not_allowed", "This category is not allowed here.")
        if not (title or "").strip():
            raise _error(422, "title_required", "A title is required.")
        count = db.scalar(
            select(func.count()).select_from(ProjectDocument).where(ProjectDocument.project_id == project.id)
        )
        if (count or 0) >= settings.project_documents_per_project:
            raise _error(409, "document_limit", "This project has reached its limit of documents.")
        document = ProjectDocument(
            project_id=project.id,
            title=title.strip(),
            category=category,
            origin=origin,
            created_by_admin_id=admin.id if admin else None,
            created_by_account_id=account.id if account else None,
            retain_until=utcnow() + timedelta(days=settings.project_document_retention_days),
        )
        db.add(document)
        db.flush()
        latest = None
    else:
        if document.archived_at is not None:
            raise _error(409, "document_archived", "This document is archived.")
        if document.origin != origin:
            raise _error(409, "document_origin", "A new version must come from the same side as the document.")
        latest = _latest(db, document)
        current = latest.number if latest else 0
        if expected_version != current:
            raise _error(409, "version_conflict", f"The document is at version {current}. Reload and try again.")
        versions = db.scalar(
            select(func.count())
            .select_from(ProjectDocumentVersion)
            .where(ProjectDocumentVersion.document_id == document.id)
        )
        if (versions or 0) >= settings.project_versions_per_document:
            raise _error(409, "version_limit", "This document has reached its limit of versions.")

    key = storage.new_key(project.id, document.id)
    store = storage.get_storage()
    try:
        try:
            size, digest = store.put(key, chunks, max_bytes=settings.project_upload_max_bytes)
        except storage.TooLarge as exc:
            raise _error(413, "file_too_large", "The file is too large.") from exc
        except storage.StorageError as exc:
            raise _error(422, "file_unreadable", "The file could not be stored.") from exc
        if size == 0:
            raise _error(422, "file_empty", "The file is empty.")
        with store.local_path(key).open("rb") as handle:
            head = handle.read(16)
        try:
            filecheck.check_content(store.local_path(key), head, kind)
        except filecheck.FileRejected as exc:
            raise _error(422, exc.code, exc.message) from exc

        if latest is not None and latest.sha256 == digest:
            # The same bytes again (a double click or a retry): nothing new is stored.
            store.delete(key)
            return document, latest, False

        number = (latest.number if latest else 0) + 1
        version = ProjectDocumentVersion(
            document_id=document.id,
            number=number,
            filename=clean_name,
            content_type=kind.content_type,
            size_bytes=size,
            sha256=digest,
            storage_key=key,
            scan_status="not_scanned",
            note=(note or "").strip() or None,
            state="published" if origin == "client" else DRAFT,
            uploaded_by_kind=origin,
            uploaded_by_admin_id=admin.id if admin else None,
            uploaded_by_account_id=account.id if account else None,
            published_at=utcnow() if origin == "client" else None,
        )
        db.add(version)
        document.revision += 1
        db.flush()
        _audit(
            db,
            "project_document.upload",
            project,
            label,
            ip_hash,
            document=str(document.id),
            version=number,
            size=size,
            category=document.category,
        )
        db.commit()
    except BaseException:
        db.rollback()
        store.delete(key)
        raise
    return document, version, True


# --------------------------------------------------------------------------- staff publication and scanning


def _supersede(db: Session, document: ProjectDocument, keep: ProjectDocumentVersion | None, to: str) -> int:
    rows = db.scalars(
        select(DocumentApproval)
        .where(DocumentApproval.document_id == document.id, DocumentApproval.state == "pending")
        .with_for_update()
    ).all()
    changed = 0
    for row in rows:
        if keep is not None and row.version_id == keep.id:
            continue
        row.state = to
        changed += 1
    return changed


def publish(
    db: Session,
    project: CommercialProject,
    document: ProjectDocument,
    version: ProjectDocumentVersion,
    admin: AdminUser,
    ip_hash: str | None,
) -> bool:
    """Makes a draft version visible to the customer. Returns False when it already is (a repeat changes nothing)."""
    _visible_project(project)
    if document.archived_at is not None:
        raise _error(409, "document_archived", "This document is archived.")
    if version.state == "published":
        return False
    if version.state != DRAFT:
        raise _error(409, "version_state", "A withdrawn version cannot be published again: upload a new version.")
    if version.purged_at is not None:
        raise _error(409, "document_purged", "The stored file was removed.")
    if version.scan_status == "infected":
        raise _error(409, "document_infected", "A scan found a problem with this file.")
    if get_settings().project_upload_require_scan and version.scan_status != "clean":
        raise _error(409, "document_not_scanned", "The file has not been scanned yet.")
    version.state = "published"
    version.published_at = utcnow()
    version.published_by_admin_id = admin.id
    document.revision += 1
    _supersede(db, document, version, "superseded")
    published = _event(
        db,
        project,
        "delivery",
        author_kind="staff",
        admin=admin,
        meta={"action": "document_published", "document": document.title, "version": version.number},
    )
    notify.queue(db, project, OutboxKind.DOCUMENT_PUBLISHED, published.id)
    _audit(
        db,
        "project_document.publish",
        project,
        f"admin:{admin.id}",
        ip_hash,
        document=str(document.id),
        version=version.number,
    )
    db.commit()
    return True


def withdraw(
    db: Session,
    project: CommercialProject,
    document: ProjectDocument,
    version: ProjectDocumentVersion,
    admin: AdminUser,
    ip_hash: str | None,
) -> bool:
    if version.state == "withdrawn":
        return False
    version.state = "withdrawn"
    document.revision += 1
    for row in db.scalars(
        select(DocumentApproval)
        .where(DocumentApproval.version_id == version.id, DocumentApproval.state == "pending")
        .with_for_update()
    ).all():
        row.state = "withdrawn"
    _audit(
        db,
        "project_document.withdraw",
        project,
        f"admin:{admin.id}",
        ip_hash,
        document=str(document.id),
        version=version.number,
    )
    db.commit()
    return True


def archive(
    db: Session, project: CommercialProject, document: ProjectDocument, admin: AdminUser, ip_hash: str | None
) -> bool:
    if document.archived_at is not None:
        return False
    document.archived_at = utcnow()
    document.revision += 1
    _supersede(db, document, None, "withdrawn")
    _audit(db, "project_document.archive", project, f"admin:{admin.id}", ip_hash, document=str(document.id))
    db.commit()
    return True


def record_scan(
    db: Session,
    project: CommercialProject,
    document: ProjectDocument,
    version: ProjectDocumentVersion,
    result: str,
    admin: AdminUser,
    ip_hash: str | None,
) -> None:
    """Records what a scanner (or a person) found. An infected published version is withdrawn at once."""
    if version.scan_status == "infected" and result != "infected":
        raise _error(409, "document_infected", "A file that was found infected cannot be marked clean.")
    version.scan_status = result
    version.scanned_at = utcnow()
    if result == "infected":
        if version.state == "published":
            version.state = "withdrawn"
        for row in db.scalars(
            select(DocumentApproval)
            .where(DocumentApproval.version_id == version.id, DocumentApproval.state == "pending")
            .with_for_update()
        ).all():
            row.state = "withdrawn"
    _audit(
        db,
        "project_document.scan",
        project,
        f"admin:{admin.id}",
        ip_hash,
        document=str(document.id),
        version=version.number,
        result=result,
    )
    db.commit()


# --------------------------------------------------------------------------- approvals and feedback


def request_approval(
    db: Session,
    project: CommercialProject,
    document: ProjectDocument,
    version: ProjectDocumentVersion,
    admin: AdminUser,
    message: str | None,
    ip_hash: str | None,
) -> tuple[DocumentApproval, bool]:
    _visible_project(project)
    if document.origin != "staff":
        raise _error(409, "document_origin", "Only a document from the team can be put to approval.")
    if document.archived_at is not None:
        raise _error(409, "document_archived", "This document is archived.")
    latest = _latest_published(db, document)
    if version.state != "published" or latest is None or latest.id != version.id:
        raise _error(409, "version_not_current", "Only the latest published version can be put to approval.")
    existing = db.scalar(
        select(DocumentApproval).where(DocumentApproval.version_id == version.id, DocumentApproval.state == "pending")
    )
    if existing is not None:
        return existing, False
    approval = DocumentApproval(
        project_id=project.id,
        document_id=document.id,
        version_id=version.id,
        requested_by_admin_id=admin.id,
        message=(message or "").strip() or None,
    )
    db.add(approval)
    db.flush()
    _event(
        db,
        project,
        "approval",
        author_kind="staff",
        admin=admin,
        body=approval.message,
        meta={"action": "requested", "document": document.title, "version": version.number},
    )
    notify.queue(db, project, OutboxKind.APPROVAL_REQUESTED, approval.id)
    _audit(
        db,
        "project_document.approval_requested",
        project,
        f"admin:{admin.id}",
        ip_hash,
        document=str(document.id),
        version=version.number,
        approval=str(approval.id),
    )
    db.commit()
    return approval, True


def withdraw_approval(
    db: Session, project: CommercialProject, approval: DocumentApproval, admin: AdminUser, ip_hash: str | None
) -> bool:
    if approval.state == "withdrawn":
        return False
    if approval.state != "pending":
        raise _error(409, "approval_closed", "This request was already decided or closed.")
    approval.state = "withdrawn"
    _audit(
        db,
        "project_document.approval_withdrawn",
        project,
        f"admin:{admin.id}",
        ip_hash,
        document=str(approval.document_id),
        approval=str(approval.id),
    )
    db.commit()
    return True


def approval_of(
    db: Session, project: CommercialProject, approval_id: uuid.UUID, *, lock: bool = False
) -> DocumentApproval:
    query = select(DocumentApproval).where(
        DocumentApproval.id == approval_id, DocumentApproval.project_id == project.id
    )
    if lock:
        query = query.with_for_update()
    approval = db.scalar(query)
    if approval is None:
        raise _error(404, "approval_not_found", "Not found.")
    return approval


def decide(
    db: Session,
    project: CommercialProject,
    approval: DocumentApproval,
    payload: DecisionIn,
    account: CustomerAccount,
    role: str,
    ip_hash: str | None,
) -> tuple[DocumentApproval, bool]:
    """The customer's decision. Returns (approval, recorded). The caller holds the approval's row lock."""
    if role not in APPROVER_ROLES:
        raise _error(403, "role_not_allowed", "Your role in this workspace may not take this decision.")
    wanted = "approved" if payload.decision == "approve" else "rejected"
    version = db.get(ProjectDocumentVersion, approval.version_id)
    document = db.get(ProjectDocument, approval.document_id)
    if version is None or document is None:
        raise _error(404, "approval_not_found", "Not found.")
    if approval.state == wanted:
        return approval, False  # the same decision again changes nothing
    if approval.state in ("approved", "rejected"):
        raise _error(409, "approval_closed", "This request was already decided.")
    if approval.state == "superseded":
        raise _error(409, "approval_superseded", "A newer version replaced this one: review the new version.")
    if approval.state != "pending":
        raise _error(409, "approval_closed", "This request is closed.")
    if payload.expected_version != version.number:
        raise _error(409, "version_conflict", "The request is about another version than the one you saw.")
    comment = (payload.comment or "").strip()
    if wanted == "rejected" and len(comment) < 3:
        raise _error(422, "note_required", "Say what should change.")
    approval.state = wanted
    approval.decided_by_account_id = account.id
    approval.decided_at = utcnow()
    approval.decision_note = comment or None
    _event(
        db,
        project,
        "approval",
        author_kind="client",
        account=account.id,
        body=comment or None,
        meta={"action": wanted, "document": document.title, "version": version.number},
    )
    _audit(
        db,
        "project_document.approval_decided",
        project,
        f"account:{account.id}",
        ip_hash,
        document=str(document.id),
        version=version.number,
        approval=str(approval.id),
        decision=wanted,
    )
    db.commit()
    return approval, True


def add_comment(
    db: Session,
    project: CommercialProject,
    document: ProjectDocument,
    number: int,
    body: str,
    *,
    admin: AdminUser | None,
    account: CustomerAccount | None,
    ip_hash: str | None,
) -> DocumentComment:
    _visible_project(project)
    if document.archived_at is not None:
        raise _error(409, "document_archived", "This document is archived.")
    version = version_of(db, document, number)
    if version.state != "published":
        raise _error(404, "document_not_found", "Not found.")
    row = DocumentComment(
        document_id=document.id,
        version_id=version.id,
        author_kind="staff" if admin else "client",
        author_admin_id=admin.id if admin else None,
        author_account_id=account.id if account else None,
        body=body,
    )
    db.add(row)
    db.flush()
    _audit(
        db,
        "project_document.comment",
        project,
        f"admin:{admin.id}" if admin else f"account:{account.id if account else '-'}",
        ip_hash,
        document=str(document.id),
        version=number,
    )
    db.commit()
    return row


# --------------------------------------------------------------------------- download


def open_download(
    db: Session,
    project: CommercialProject,
    document: ProjectDocument,
    number: int,
    *,
    staff: bool,
    label: str,
    ip_hash: str | None,
) -> tuple[ProjectDocumentVersion, Iterator[bytes]]:
    """Authorizes and logs a download, then opens the stored bytes. The caller already proved the project is theirs."""
    version = version_of(db, document, number)
    if not staff and (document.archived_at is not None or version.state != "published"):
        raise _error(404, "document_not_found", "Not found.")
    if version.purged_at is not None:
        raise _error(410, "document_purged", "The stored file was removed after its retention period.")
    if version.scan_status == "infected":
        raise _error(409, "document_infected", "A scan found a problem with this file.")
    if not staff and not _scan_allows_customer(version):
        raise _error(409, "document_not_scanned", "The file has not been scanned yet.")
    try:
        stream = storage.get_storage().open(version.storage_key)
    except storage.StorageError as exc:
        raise _error(404, "document_not_found", "Not found.") from exc
    _audit(db, "project_document.download", project, label, ip_hash, document=str(document.id), version=number)
    db.commit()
    return version, stream


# --------------------------------------------------------------------------- retention


def count_expired(db: Session) -> int:
    """How many stored files `purge_expired` would delete now (the dry run of the maintenance command)."""
    now = utcnow()
    expired = select(ProjectDocument.id).where(
        ProjectDocument.retain_until.is_not(None), ProjectDocument.retain_until < now
    )
    waiting = select(DocumentApproval.document_id).where(DocumentApproval.state == "pending")
    return (
        db.scalar(
            select(func.count())
            .select_from(ProjectDocumentVersion)
            .where(
                ProjectDocumentVersion.purged_at.is_(None),
                ProjectDocumentVersion.document_id.in_(expired),
                ProjectDocumentVersion.document_id.not_in(waiting),
            )
        )
        or 0
    )


def purge_expired(db: Session) -> int:
    """Deletes the stored bytes of documents past `retain_until`, keeping every record. Returns the versions purged.

    A document with an open approval request is kept until the request is closed.
    """
    now = utcnow()
    store = storage.get_storage()
    purged = 0
    documents = db.scalars(
        select(ProjectDocument).where(ProjectDocument.retain_until.is_not(None), ProjectDocument.retain_until < now)
    ).all()
    for document in documents:
        open_request = db.scalar(
            select(func.count())
            .select_from(DocumentApproval)
            .where(DocumentApproval.document_id == document.id, DocumentApproval.state == "pending")
        )
        if open_request:
            continue
        removed = 0
        for version in _versions(db, document):
            if version.purged_at is None:
                store.delete(version.storage_key)
                version.purged_at = now
                removed += 1
        purged += removed
        if removed:
            audit.record(
                db,
                "project_document.purge",
                actor_label="system:retention",
                entity_type="project_document",
                entity_id=str(document.id),
                details={"project": str(document.project_id), "versions": removed},
            )
    db.commit()
    return purged
