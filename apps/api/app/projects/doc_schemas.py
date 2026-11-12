"""Request and response models of project documents (docs/PROJECT_DOCUMENTS.md).

A file never travels inside JSON: it is the raw body of an upload request, with its title, category and note in
URL-encoded headers (`X-Document-Title`, ...), so no multipart parser is needed and the size can be limited while it is
being read. Everything else is plain text with a length limit.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field

from app.ops.workflows import sanitize
from app.schemas import StrictModel

Body = Annotated[str, Field(min_length=3, max_length=2000), AfterValidator(sanitize)]


class ApprovalRequestIn(StrictModel):
    message: Annotated[str, Field(max_length=500), AfterValidator(sanitize)] | None = None


class DecisionIn(StrictModel):
    # The version number the person saw: a decision on a version that is no longer the one asked about is refused.
    expected_version: int = Field(ge=1)
    decision: Literal["approve", "reject"]
    comment: Annotated[str, Field(max_length=1000), AfterValidator(sanitize)] | None = None


class CommentIn(StrictModel):
    version: int = Field(ge=1)
    body: Body


class ScanIn(StrictModel):
    # What an external scanner (or a person who checked the file) found. The system itself runs no scanner.
    result: Literal["clean", "infected", "failed"]


class ApprovalOut(BaseModel):
    id: uuid.UUID
    version: int
    state: Literal["pending", "approved", "rejected", "withdrawn", "superseded"]
    message: str | None
    requested_at: datetime
    decided_at: datetime | None
    decision_note: str | None
    # "you" for the viewer's own decision, "member" for another member of the workspace; never an e-mail address.
    decided_by: Literal["you", "member"] | None


class CommentOut(BaseModel):
    id: uuid.UUID
    version: int
    author: Literal["client", "team"]
    mine: bool
    body: str
    created_at: datetime


class VersionOut(BaseModel):
    number: int
    filename: str
    content_type: str
    size_bytes: int
    sha256: str
    note: str | None
    state: Literal["draft", "published", "withdrawn"]
    published_at: datetime | None
    created_at: datetime
    uploaded_by: Literal["client", "team"]
    mine: bool
    downloadable: bool
    approval: ApprovalOut | None


class DocumentOut(BaseModel):
    id: uuid.UUID
    title: str
    category: str
    origin: Literal["staff", "client"]
    revision: int
    archived: bool
    created_at: datetime
    versions: list[VersionOut]
    comments: list[CommentOut]
    # Whether this viewer may add a new version right now.
    can_add_version: bool


class LimitsOut(BaseModel):
    max_bytes: int
    extensions: list[dict[str, str]]
    categories: list[str]
    client_categories: list[str]
    upload: bool
    client_upload: bool


class DocumentsOut(BaseModel):
    documents: list[DocumentOut]
    limits: LimitsOut
    # Whether this viewer may approve or reject (owner or billing member).
    can_decide: bool


class StaffVersionOut(VersionOut):
    scan_status: str
    scanned_at: datetime | None
    uploaded_by_label: str | None
    purged: bool


class StaffDocumentOut(DocumentOut):
    versions: list[StaffVersionOut]  # type: ignore[assignment]
    retain_until: datetime | None
    created_by_label: str | None


class StaffDocumentsOut(BaseModel):
    documents: list[StaffDocumentOut]
    limits: LimitsOut
