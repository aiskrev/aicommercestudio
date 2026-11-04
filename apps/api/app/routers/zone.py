"""Client zone: overview, billing profile, documents, members and support requests.

Roles live on the workspace: `owner`, `billing` and `member`. `billing_role` and `owner_role` are the
checks; another workspace's rows answer 404. A customer account has no route to staff or portal data.
"""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import EmailStr, Field, field_validator
from sqlalchemy import func, select

from app.accounts import limits
from app.accounts.models import CustomerAccount
from app.config import get_settings
from app.deps import AppSettings, DbSession
from app.errors import ApiError
from app.invoicing import service as invoicing
from app.invoicing.models import AccountingDocument, BillingProfile, DocumentStatus
from app.models import utcnow
from app.routers.accounts import Account
from app.routers.workspace import Context, WorkspaceCtx
from app.schemas import StrictModel
from app.security import generate_token, hash_token
from app.workspace import usage
from app.workspace.models import (
    CustomerWorkspace,
    SupportRequest,
    WorkspaceInvitation,
    WorkspaceMember,
    WorkspaceProject,
)

Role = Literal["billing", "member"]


def _enabled() -> None:
    settings = get_settings()
    if not (settings.advisor_workspace_enabled and settings.customer_accounts_enabled):
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/api/zone", tags=["zone"], dependencies=[Depends(_enabled), Depends(_no_store)])


def _not_found() -> ApiError:
    return ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _forbidden() -> ApiError:
    return ApiError(status.HTTP_403_FORBIDDEN, "Your role doesn't allow this.", "role_not_allowed")


def billing_role(ctx: WorkspaceCtx) -> Context:
    if ctx.role not in ("owner", "billing"):
        raise _forbidden()
    return ctx


def owner_role(ctx: WorkspaceCtx) -> Context:
    if ctx.role != "owner":
        raise _forbidden()
    return ctx


Billing = Annotated[Context, Depends(billing_role)]
Owner = Annotated[Context, Depends(owner_role)]


class ProfileIn(StrictModel):
    legal_name: str = Field(min_length=2, max_length=200)
    company_id: str | None = Field(default=None, max_length=40)
    vat_id: str | None = Field(default=None, max_length=40)
    address: str = Field(min_length=5, max_length=300)
    country: str = Field(pattern="^[A-Z]{2}$")
    email: EmailStr = Field(max_length=254)


class InviteIn(StrictModel):
    email: EmailStr = Field(max_length=254)
    role: Role


class AcceptIn(StrictModel):
    token: str = Field(min_length=20, max_length=200)


class RoleIn(StrictModel):
    role: Role


class SupportIn(StrictModel):
    kind: Literal["software", "service"]
    subject: str = Field(min_length=3, max_length=160)
    message: str = Field(min_length=10, max_length=4000)

    @field_validator("subject", "message")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()


@router.get("/overview")
def overview(ctx: WorkspaceCtx, db: DbSession) -> dict[str, Any]:
    """Only counts we really have. Uptime, agent runs and costs have no source, so they are not here."""
    workspace_id = ctx.workspace.id
    return {
        "role": ctx.role,
        "plan": ctx.rights.plan,
        "usage": usage.report(db, workspace_id),
        "limits": ctx.rights.limits,
        "projects": db.scalar(
            select(func.count()).select_from(WorkspaceProject).where(WorkspaceProject.workspace_id == workspace_id)
        ),
        "open_requests": db.scalar(
            select(func.count())
            .select_from(SupportRequest)
            .where(SupportRequest.workspace_id == workspace_id, SupportRequest.status == "open")
        ),
    }


@router.get("/billing-profile")
def read_profile(ctx: Billing, db: DbSession) -> dict[str, Any] | None:
    row = db.get(BillingProfile, ctx.workspace.id)
    if row is None:
        return None
    return {
        "legal_name": row.legal_name,
        "company_id": row.company_id,
        "vat_id": row.vat_id,
        "address": row.address,
        "country": row.country,
        "email": row.email,
    }


@router.put("/billing-profile", status_code=status.HTTP_204_NO_CONTENT)
def save_profile(payload: ProfileIn, ctx: Billing, db: DbSession) -> None:
    row = db.get(BillingProfile, ctx.workspace.id)
    values = payload.model_dump()
    if row is None:
        db.add(BillingProfile(workspace_id=ctx.workspace.id, **values))
    else:
        for key, value in values.items():
            setattr(row, key, value)
    db.commit()


def _documents(db, ctx: Context) -> list[AccountingDocument]:
    return list(
        db.scalars(
            select(AccountingDocument)
            .where(AccountingDocument.workspace_id == ctx.workspace.id)
            .order_by(AccountingDocument.created_at.desc())
        ).all()
    )


@router.get("/documents")
def list_documents(ctx: Billing, db: DbSession) -> list[dict[str, Any]]:
    return [invoicing.present(row) for row in _documents(db, ctx)]


@router.get("/documents/export")
def export_documents(ctx: Billing, db: DbSession) -> Response:
    return Response(
        invoicing.export_csv(_documents(db, ctx)),
        media_type="text/csv; charset=utf-8",
        headers={"Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="documents.csv"'},
    )


@router.get("/documents/{document_id}/download")
def download_document(document_id: uuid.UUID, ctx: Billing, db: DbSession) -> Response:
    row = db.get(AccountingDocument, document_id)
    if row is None or row.workspace_id != ctx.workspace.id or row.status != DocumentStatus.ISSUED.value:
        raise _not_found()
    return Response(
        invoicing.render(row),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-store", "Content-Disposition": f'attachment; filename="{row.number}.txt"'},
    )


@router.get("/members")
def members(ctx: WorkspaceCtx, db: DbSession) -> list[dict[str, Any]]:
    owner = db.get(CustomerAccount, ctx.workspace.owner_account_id)
    rows = db.execute(
        select(WorkspaceMember, CustomerAccount)
        .join(CustomerAccount, CustomerAccount.id == WorkspaceMember.account_id)
        .where(WorkspaceMember.workspace_id == ctx.workspace.id)
    ).all()
    result = [{"id": str(owner.id), "email": owner.email, "role": "owner"}]
    return result + [{"id": str(a.id), "email": a.email, "role": m.role} for m, a in rows]


@router.post("/invitations", status_code=status.HTTP_201_CREATED)
def invite(payload: InviteIn, ctx: Owner, db: DbSession, settings: AppSettings) -> dict[str, str]:
    """The link is shown once to the owner and only the hash is kept. It works for this e-mail alone."""
    token = generate_token()
    db.add(
        WorkspaceInvitation(
            workspace_id=ctx.workspace.id,
            email=payload.email.strip().lower(),
            role=payload.role,
            token_hash=hash_token(token),
            expires_at=utcnow() + timedelta(days=7),
        )
    )
    db.commit()
    return {"token": token}


@router.post("/invitations/accept", status_code=status.HTTP_204_NO_CONTENT)
def accept(payload: AcceptIn, account: Account, db: DbSession, settings: AppSettings) -> None:
    limits.hit("invite:account", str(account.account.id), 10, 900)
    row = db.scalar(
        select(WorkspaceInvitation).where(WorkspaceInvitation.token_hash == hash_token(payload.token)).with_for_update()
    )
    now = utcnow()
    if row is None or row.used_at is not None or row.expires_at <= now or row.email != account.account.email:
        raise ApiError(status.HTTP_400_BAD_REQUEST, "This invitation is invalid or has expired.", "token_invalid")
    row.used_at = now
    db.add(WorkspaceMember(workspace_id=row.workspace_id, account_id=account.account.id, role=row.role))
    db.commit()


def _member(db, ctx: Context, account_id: uuid.UUID) -> WorkspaceMember:
    row = db.get(WorkspaceMember, (ctx.workspace.id, account_id))
    if row is None:
        raise _not_found()
    return row


@router.patch("/members/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def change_role(account_id: uuid.UUID, payload: RoleIn, ctx: Owner, db: DbSession) -> None:
    _member(db, ctx, account_id).role = payload.role
    db.commit()


@router.delete("/members/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(account_id: uuid.UUID, ctx: Owner, db: DbSession) -> None:
    db.delete(_member(db, ctx, account_id))
    db.commit()


@router.get("/memberships")
def memberships(account: Account, db: DbSession) -> list[dict[str, str]]:
    """Workspaces this account may switch to, sent back in the X-Workspace header."""
    own = db.scalars(select(CustomerWorkspace.id).where(CustomerWorkspace.owner_account_id == account.account.id)).all()
    rows = db.scalars(select(WorkspaceMember).where(WorkspaceMember.account_id == account.account.id)).all()
    return [{"id": str(i), "role": "owner"} for i in own] + [{"id": str(m.workspace_id), "role": m.role} for m in rows]


@router.get("/support")
def list_support(ctx: WorkspaceCtx, db: DbSession) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(SupportRequest)
        .where(SupportRequest.workspace_id == ctx.workspace.id)
        .order_by(SupportRequest.created_at.desc())
    ).all()
    return [
        {
            "id": str(r.id),
            "kind": r.kind,
            "subject": r.subject,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/support", status_code=status.HTTP_201_CREATED)
def create_support(payload: SupportIn, account: Account, ctx: WorkspaceCtx, db: DbSession) -> dict[str, str]:
    limits.hit("support:workspace", str(ctx.workspace.id), 10, 3600)
    row = SupportRequest(workspace_id=ctx.workspace.id, created_by=account.account.id, **payload.model_dump())
    db.add(row)
    db.commit()
    return {"id": str(row.id)}
