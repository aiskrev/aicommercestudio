"""What a workspace may do now. The only place that reads plans; routes ask through `require_entitlement`."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import utcnow
from app.workspace.models import (
    CustomerWorkspace,
    EntitlementGrant,
    Plan,
    PlanFeature,
    PlanPrice,
    PlanVersion,
    Product,
)

PRODUCT = "advisor_workspace"
DEFAULT_PLAN = "free"


@dataclass(frozen=True)
class Entitlements:
    plan: str
    version: int
    features: frozenset[str]
    limits: dict[str, int]

    def has(self, feature: str) -> bool:
        return feature in self.features

    def limit(self, name: str) -> int:
        return self.limits.get(name, 0)  # an unknown limit is zero, never "no limit"


def workspace_for(db: Session, account_id: uuid.UUID) -> CustomerWorkspace:
    db.execute(insert(CustomerWorkspace).values(id=uuid.uuid4(), owner_account_id=account_id).on_conflict_do_nothing())
    db.flush()
    return db.scalars(select(CustomerWorkspace).where(CustomerWorkspace.owner_account_id == account_id)).one()


def latest_version(db: Session, plan_key: str) -> tuple[Plan, PlanVersion] | None:
    row = db.execute(
        select(Plan, PlanVersion)
        .join(PlanVersion, PlanVersion.plan_id == Plan.id)
        .join(Product, Product.id == Plan.product_id)
        .where(Product.key == PRODUCT, Plan.key == plan_key)
        .order_by(PlanVersion.version.desc())
        .limit(1)
    ).first()
    return (row[0], row[1]) if row else None


def _load(db: Session, plan: Plan, version: PlanVersion) -> Entitlements:
    rows = db.scalars(select(PlanFeature).where(PlanFeature.plan_version_id == version.id)).all()
    return Entitlements(
        plan=plan.key,
        version=version.version,
        features=frozenset(r.feature for r in rows if r.enabled and r.limit_value is None),
        limits={r.feature: r.limit_value for r in rows if r.limit_value is not None},
    )


def resolve(db: Session, workspace_id: uuid.UUID) -> Entitlements:
    row = db.execute(
        select(Plan, PlanVersion)
        .join(PlanVersion, PlanVersion.plan_id == Plan.id)
        .join(EntitlementGrant, EntitlementGrant.plan_version_id == PlanVersion.id)
        .where(EntitlementGrant.workspace_id == workspace_id, EntitlementGrant.ended_at.is_(None))
    ).first()
    plan, version = (row[0], row[1]) if row else latest_version(db, DEFAULT_PLAN)
    return _load(db, plan, version)


def grant(db: Session, workspace_id: uuid.UUID, plan_key: str, source: str) -> None:
    found = latest_version(db, plan_key)
    if found is None:
        raise ValueError(plan_key)
    db.execute(
        EntitlementGrant.__table__.update()
        .where(EntitlementGrant.workspace_id == workspace_id, EntitlementGrant.ended_at.is_(None))
        .values(ended_at=utcnow())
    )
    db.add(EntitlementGrant(workspace_id=workspace_id, plan_version_id=found[1].id, source=source))


def public_plans(db: Session) -> list[dict]:
    """Plans for display. A price appears only after the owner has approved it."""
    rows = db.execute(
        select(Plan).join(Product, Product.id == Plan.product_id).where(Product.key == PRODUCT).order_by(Plan.position)
    ).scalars()
    result = []
    for plan in rows:
        _, version = latest_version(db, plan.key)
        entitlements = _load(db, plan, version)
        prices = db.scalars(
            select(PlanPrice).where(PlanPrice.plan_version_id == version.id, PlanPrice.approved_at.is_not(None))
        ).all()
        result.append(
            {
                "key": plan.key,
                "version": version.version,
                "features": sorted(entitlements.features),
                "limits": entitlements.limits,
                "prices": [
                    {"currency": p.currency, "amount_minor": p.amount_minor, "interval": p.billing_interval}
                    for p in prices
                ],
            }
        )
    return result
