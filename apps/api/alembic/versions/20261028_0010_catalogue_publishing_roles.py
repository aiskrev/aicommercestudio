"""Catalogue publishing, staff roles, assessments/workshops, capabilities and deliverables.

* admin_users.role (admin | editor | viewer, NOT NULL, server default 'admin'): every existing
  account keeps full rights; editors and viewers reach only the service catalogue.
* catalogue_entities: published_revision, published_at, published_by_id and published_snapshot
  (JSONB read model served by the public API). A published domain or service must have a snapshot.
  Data step: rows seeded under 0009 are 'published' without a snapshot; they become 'draft' here and
  `python -m app.cli catalogue-seed` (run by `seed` on start) publishes them again from the seed
  document. Nothing else changes.
* services: offering types 'assessment' and 'workshop'; duration band columns (assessments and
  workshops only).
* content_items + content_item_translations: ordered capabilities and deliverables per locale.

Downgrade: drops the new tables and columns. Assessment and workshop rows cannot exist under 0009's
CHECK, so they are deleted with their entities (documented in DATABASE_SCHEMA.md); published
domains and services keep status 'published'.

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PUBLISHED_SNAPSHOT_CHECK = (
    "entity_type = 'family' OR status <> 'published' "
    "OR (published_snapshot IS NOT NULL AND published_revision IS NOT NULL)"
)
DURATION_CHECK = (
    "(duration_min_days IS NULL AND duration_max_days IS NULL) OR "
    "(offering_type IN ('assessment', 'workshop') AND duration_min_days > 0 "
    "AND duration_max_days >= duration_min_days)"
)


def upgrade() -> None:
    op.add_column("admin_users", sa.Column("role", sa.String(12), server_default="admin", nullable=False))
    op.create_check_constraint("ck_admin_users_role", "admin_users", "role IN ('admin', 'editor', 'viewer')")

    op.add_column("catalogue_entities", sa.Column("published_revision", sa.Integer(), nullable=True))
    op.add_column("catalogue_entities", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("catalogue_entities", sa.Column("published_by_id", sa.Uuid(), nullable=True))
    op.add_column(
        "catalogue_entities",
        sa.Column("published_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_foreign_key(
        "fk_catalogue_entities_published_by_id_admin_users",
        "catalogue_entities",
        "admin_users",
        ["published_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    # 0009 rows were published without a snapshot; the seed publishes them again (see docstring).
    op.execute(
        "UPDATE catalogue_entities SET status = 'draft' "
        "WHERE status = 'published' AND entity_type IN ('domain', 'service')"
    )
    op.create_check_constraint("ck_catalogue_entities_published_snapshot", "catalogue_entities", PUBLISHED_SNAPSHOT_CHECK)

    op.drop_constraint("ck_services_offering_type", "services", type_="check")
    op.create_check_constraint(
        "ck_services_offering_type", "services", "offering_type IN ('service', 'assessment', 'workshop')"
    )
    op.add_column("services", sa.Column("duration_min_days", sa.Numeric(4, 1), nullable=True))
    op.add_column("services", sa.Column("duration_max_days", sa.Numeric(4, 1), nullable=True))
    op.create_check_constraint("ck_services_duration", "services", DURATION_CHECK)

    op.create_table(
        "content_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("item_type", sa.String(20), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("item_type IN ('capability', 'deliverable')", name="ck_content_items_item_type"),
        sa.CheckConstraint("position >= 0", name="ck_content_items_position"),
        sa.ForeignKeyConstraint(
            ["entity_id"],
            ["catalogue_entities.id"],
            name="fk_content_items_entity_id_catalogue_entities",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_content_items"),
        sa.UniqueConstraint(
            "entity_id",
            "item_type",
            "position",
            name="uq_content_items_entity_type_position",
            deferrable=True,
            initially="DEFERRED",
        ),
    )
    op.create_index("ix_content_items_entity_id", "content_items", ["entity_id"])

    op.create_table(
        "content_item_translations",
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("locale", sa.String(2), nullable=False),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.CheckConstraint("locale IN ('bg', 'en')", name="ck_content_item_translations_locale"),
        sa.CheckConstraint("title IS NOT NULL OR body IS NOT NULL", name="ck_content_item_translations_not_empty"),
        sa.CheckConstraint(
            "body IS NULL OR char_length(body) <= 1000", name="ck_content_item_translations_body_length"
        ),
        sa.ForeignKeyConstraint(
            ["item_id"],
            ["content_items.id"],
            name="fk_content_item_translations_item_id_content_items",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("item_id", "locale", name="pk_content_item_translations"),
    )


def downgrade() -> None:
    op.drop_table("content_item_translations")
    op.drop_table("content_items")

    # Offering types that 0009 does not know are removed with their entities.
    op.execute(
        "DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM services "
        "WHERE offering_type <> 'service') OR to_entity_id IN (SELECT id FROM services WHERE offering_type <> 'service')"
    )
    op.execute("DELETE FROM family_services WHERE service_id IN (SELECT id FROM services WHERE offering_type <> 'service')")
    op.execute(
        "DELETE FROM catalogue_entities WHERE id IN (SELECT id FROM services WHERE offering_type <> 'service')"
    )
    op.drop_constraint("ck_services_duration", "services", type_="check")
    op.drop_column("services", "duration_max_days")
    op.drop_column("services", "duration_min_days")
    op.drop_constraint("ck_services_offering_type", "services", type_="check")
    op.create_check_constraint("ck_services_offering_type", "services", "offering_type IN ('service')")

    op.drop_constraint("ck_catalogue_entities_published_snapshot", "catalogue_entities", type_="check")
    op.drop_constraint("fk_catalogue_entities_published_by_id_admin_users", "catalogue_entities", type_="foreignkey")
    op.drop_column("catalogue_entities", "published_snapshot")
    op.drop_column("catalogue_entities", "published_by_id")
    op.drop_column("catalogue_entities", "published_at")
    op.drop_column("catalogue_entities", "published_revision")

    op.drop_constraint("ck_admin_users_role", "admin_users", type_="check")
    op.drop_column("admin_users", "role")
