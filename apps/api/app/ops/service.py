"""Operational helpers for the AI operations scaffold (used by the CLI and tests)."""

from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app import audit
from app.models import (
    AdminUser,
    OpsAgent,
    OpsAgentStatus,
    OpsEnvironment,
    OpsMembership,
    OpsOrganization,
    OpsRole,
    OpsWorkspace,
)

DEMO_SLUG = "demo-sample-data"


class OpsSetupError(ValueError):
    pass


def create_organization(
    db: Session, *, slug: str, name: str, owner_email: str, is_demo: bool = False
) -> OpsOrganization:
    """Creates a tenant with its first owner (an existing, active staff account)."""
    owner = db.scalar(select(AdminUser).where(func.lower(AdminUser.email) == owner_email.lower()))
    if owner is None or not owner.is_active:
        raise OpsSetupError(f"No active user with e-mail {owner_email}")
    if db.scalar(select(OpsOrganization).where(OpsOrganization.slug == slug)):
        raise OpsSetupError(f"Organisation '{slug}' already exists")
    org = OpsOrganization(slug=slug, name=name, is_demo=is_demo)
    db.add(org)
    db.flush()
    db.add(OpsMembership(organization_id=org.id, user_id=owner.id, role=OpsRole.OWNER))
    audit.record(
        db,
        "ops.organization_created",
        actor_label="cli",
        entity_type="ops_organization",
        entity_id=str(org.id),
        details={"organization_id": str(org.id), "slug": slug, "is_demo": is_demo},
    )
    db.commit()
    return org


def seed_demo(db: Session, *, owner_email: str, app_env: str) -> OpsOrganization:
    """Sample registry data for a clearly labelled demo organisation. Refused in production.

    Registry metadata only: no runs, costs, latencies or incidents are invented.
    """
    if app_env == "production":
        raise OpsSetupError("Demo data is not created in production")
    existing = db.scalar(select(OpsOrganization).where(OpsOrganization.slug == DEMO_SLUG))
    if existing:
        return existing
    org = create_organization(
        db, slug=DEMO_SLUG, name="Demo organisation (sample data)", owner_email=owner_email, is_demo=True
    )
    staging = OpsWorkspace(
        organization_id=org.id, slug="staging", name="Staging (sample)", environment=OpsEnvironment.STAGING
    )
    production = OpsWorkspace(
        organization_id=org.id, slug="production", name="Production (sample)", environment=OpsEnvironment.PRODUCTION
    )
    db.add_all([staging, production])
    db.flush()
    samples = [
        (production, "support-assistant", "Sample support assistant", OpsAgentStatus.ACTIVE, "v1.2"),
        (production, "document-intake", "Sample document intake agent", OpsAgentStatus.PAUSED, "v0.9"),
        (staging, "knowledge-assistant", "Sample knowledge assistant", OpsAgentStatus.PLANNED, None),
    ]
    for workspace, key, name, agent_status, version in samples:
        db.add(
            OpsAgent(
                organization_id=org.id,
                workspace_id=workspace.id,
                key=key,
                name=name,
                status=agent_status,
                version=version,
                purpose="Sample data for demonstration only.",
            )
        )
    db.commit()
    return org


def purge_demo(db: Session) -> int:
    removed = db.execute(delete(OpsOrganization).where(OpsOrganization.is_demo.is_(True))).rowcount
    db.commit()
    return removed
