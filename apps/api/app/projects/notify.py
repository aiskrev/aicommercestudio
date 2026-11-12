"""Service e-mail about a customer's own project (docs/PROJECT_NOTIFICATIONS.md).

Off with `PROJECT_NOTIFICATIONS_ENABLED`.

These messages are queued in the existing outbox (`app/accounts/mail.py`) in the same transaction as the event that
causes them, so a message exists only if the event does. Nothing is sent here: `outbox-run` sends what is due, through
a configured provider, and a row without a provider becomes `blocked` instead of pretending to work.

* **Who**: the owner and the members of the project's workspace, at the verified address of their account. An account
  that is not verified, was erased or asked for deletion gets nothing. Approvals and reviews go to the people who can
  decide (the owner and `billing` members); everything else goes to every member.
* **What**: a reference, the project title and a link to the signed-in page. Never a note, a file name, a message text,
  a token or an amount; the customer reads the content after signing in.
* **Transactional, not marketing**: these are messages about a contract in progress. They do not use or require the
  marketing consent, carry no promotion and are not affected by withdrawing it.
* **Once per account and event**: the outbox has a unique index on (account, kind, event), so a retry, a repeated
  click or a second worker cannot queue a message twice.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import CustomerAccount, OutboxKind, OutboxMessage
from app.config import get_settings
from app.projects.models import CommercialProject
from app.workspace.models import CustomerWorkspace, WorkspaceMember

#: Kinds that need a decision: they go to the owner and the billing members only.
DECISION_KINDS = (OutboxKind.APPROVAL_REQUESTED, OutboxKind.REVIEW_REQUESTED)
DECIDER_ROLES = ("billing",)


def recipients(db: Session, project: CommercialProject, kind: OutboxKind) -> list[CustomerAccount]:
    workspace = db.get(CustomerWorkspace, project.workspace_id)
    if workspace is None:
        return []
    ids = [workspace.owner_account_id]
    members = select(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace.id)
    for member in db.scalars(members).all():
        if kind in DECISION_KINDS and member.role not in DECIDER_ROLES:
            continue
        ids.append(member.account_id)
    out: list[CustomerAccount] = []
    for account_id in dict.fromkeys(ids):
        account = db.get(CustomerAccount, account_id)
        if account is not None and account.email_verified_at is not None and account.erased_at is None:
            out.append(account)
    return out


def queue(db: Session, project: CommercialProject, kind: OutboxKind, event_ref: uuid.UUID) -> int:
    """Queues one message per recipient for this event. Returns how many were queued (0 while the flag is off)."""
    if not get_settings().project_notifications_enabled or project.status == "draft":
        return 0
    queued = 0
    for account in recipients(db, project, kind):
        try:
            with db.begin_nested():
                db.add(
                    OutboxMessage(
                        account_id=account.id,
                        kind=kind.value,
                        locale=account.locale if account.locale in ("bg", "en") else "bg",
                        project_id=project.id,
                        event_ref=event_ref,
                    )
                )
        except IntegrityError:
            continue  # this account already has a message for this event
        queued += 1
    return queued


def delivery(db: Session, project: CommercialProject) -> list[dict[str, object]]:
    """What staff may see of a project's message delivery: kind, state and attempts, never an address or text."""
    rows = db.scalars(
        select(OutboxMessage)
        .where(OutboxMessage.project_id == project.id)
        .order_by(OutboxMessage.created_at.desc(), OutboxMessage.id)
        .limit(100)
    ).all()
    return [
        {
            "id": str(row.id),
            "kind": row.kind,
            "locale": row.locale,
            "status": row.status,
            "attempts": row.attempts,
            "last_error": row.last_error,
            "created_at": row.created_at,
            "sent_at": row.sent_at,
        }
        for row in rows
    ]
