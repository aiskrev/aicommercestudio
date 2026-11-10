"""Data-subject rights in the account area: export, requests (deletion, correction, restriction, objection)."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import Field
from sqlalchemy import select

from app import audit
from app.accounts import limits
from app.compliance import service
from app.compliance.models import DataRequest
from app.deps import AppSettings, DbSession
from app.routers.accounts import Account, _enabled, _no_store
from app.schemas import StrictModel

router = APIRouter(
    prefix="/api/accounts/data", tags=["data-rights"], dependencies=[Depends(_enabled), Depends(_no_store)]
)


class DataRequestIn(StrictModel):
    kind: Literal["deletion", "correction", "restriction", "objection"]
    message: Annotated[str | None, Field(max_length=1000)] = None


def _present(row: DataRequest) -> dict[str, Any]:
    return {
        "reference": row.reference,
        "kind": row.kind,
        "status": row.status,
        "created_at": row.created_at,
        "handled_at": row.handled_at,
        "outcome_note": row.outcome_note,
    }


@router.get("/export")
def export_data(ctx: Account, db: DbSession, response: Response, settings: AppSettings) -> dict[str, Any]:
    """The account holder's own data as JSON. Never includes password or token hashes."""
    limits.hit(
        "data-export:account",
        str(ctx.account.id),
        settings.legal_action_rate_limit,
        settings.legal_action_rate_window_seconds,
    )
    response.headers["Content-Disposition"] = 'attachment; filename="account-data.json"'
    audit.record(
        db,
        "account.data_exported",
        actor_label=f"account:{ctx.account.id}",
        entity_type="customer_account",
        entity_id=str(ctx.account.id),
    )
    db.commit()
    return service.build_export(db, ctx.account)


@router.post("/requests", status_code=status.HTTP_202_ACCEPTED)
def create_request(payload: DataRequestIn, ctx: Account, db: DbSession, settings: AppSettings) -> dict[str, Any]:
    """Asks for deletion, correction, restriction or objection. Deletion is carried out by an administrator, so the
    answer says "received", never "deleted"; a repeat of an open request returns the same reference."""
    limits.hit(
        "data-request:account",
        str(ctx.account.id),
        settings.legal_action_rate_limit,
        settings.legal_action_rate_window_seconds,
    )
    row, created = service.open_data_request(db, ctx.account, payload.kind, payload.message)
    if created:
        audit.record(
            db,
            "account.data_request_opened",
            actor_label=f"account:{ctx.account.id}",
            entity_type="data_request",
            entity_id=str(row.id),
            details={"kind": payload.kind, "reference": row.reference},
        )
    db.commit()
    return {**_present(row), "created": created}


@router.get("/requests")
def list_requests(ctx: Account, db: DbSession, settings: AppSettings) -> list[dict[str, Any]]:
    limits.hit(
        "data-requests-list:account",
        str(ctx.account.id),
        settings.legal_read_rate_limit,
        settings.legal_read_rate_window_seconds,
    )
    rows = db.scalars(
        select(DataRequest).where(DataRequest.account_id == ctx.account.id).order_by(DataRequest.created_at.desc())
    ).all()
    return [_present(row) for row in rows]
