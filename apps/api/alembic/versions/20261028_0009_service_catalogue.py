"""Service catalogue V1: domains, families, services, translations and relations.

First bounded slice of docs/DATABASE_SCHEMA_V2.md:

* catalogue_entities: supertype (entity_type, stable key, publishing status, revision, authorship);
  (id, entity_type) is unique so subtypes and relations can reference both.
* service_domains, service_families, services: typed subtypes sharing the entity id; a composite
  foreign key (id, entity_type) keeps each subtype row attached to an entity of the right type.
* family_services: services that implement a family (N:M).
* entity_translations: per-locale texts, slug and SEO; slugs are unique per (locale, namespace),
  so domain and service slugs cannot collide under /uslugi.
* entity_relations: typed edges (related, cross_sell, delivered_through) with a CHECK on the
  allowed (kind, from_type, to_type) combinations.

Backward compatible: new tables only. Leads keep `service` as a ServiceKey string and get no
foreign key to the catalogue. The catalogue is filled by `python -m app.cli catalogue-seed`, not by
this migration. Downgrade drops the seven tables; the catalogue is a mirror of the web content and
is re-created by running the seed again.

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LEAD_CATEGORIES = ("maintenance", "seo", "ai_tools", "automation", "analytics", "integrations", "audit", "ai_managed", "ai_agents")
KEY_PATTERN = r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$"
SLUG_PATTERN = r"^[a-z0-9]+(-[a-z0-9]+)*$"
RELATION_TYPES_CHECK = (
    "(kind = 'related' AND from_type = 'service' AND to_type = 'service') OR "
    "(kind = 'cross_sell' AND from_type = 'domain' AND to_type = 'domain') OR "
    "(kind = 'delivered_through' AND from_type = 'family' AND to_type = 'domain')"
)


def _subtype_fk(table: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(
        ["id", "entity_type"],
        ["catalogue_entities.id", "catalogue_entities.entity_type"],
        name=f"fk_{table}_entity",
        ondelete="CASCADE",
    )


def upgrade() -> None:
    op.create_table(
        "catalogue_entities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("entity_type", sa.String(16), nullable=False),
        sa.Column("key", sa.String(80), nullable=False),
        sa.Column("status", sa.String(12), server_default="draft", nullable=False),
        sa.Column("revision", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("first_published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("updated_by_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint(
            "entity_type IN ('domain', 'family', 'service')", name="ck_catalogue_entities_entity_type"
        ),
        sa.CheckConstraint("status IN ('draft', 'published', 'archived')", name="ck_catalogue_entities_status"),
        sa.CheckConstraint(f"key ~ '{KEY_PATTERN}'", name="ck_catalogue_entities_key_format"),
        sa.CheckConstraint("revision >= 1", name="ck_catalogue_entities_revision_positive"),
        sa.CheckConstraint(
            "(status = 'archived') = (archived_at IS NOT NULL)", name="ck_catalogue_entities_archived_at"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["admin_users.id"],
            name="fk_catalogue_entities_created_by_id_admin_users",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by_id"],
            ["admin_users.id"],
            name="fk_catalogue_entities_updated_by_id_admin_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_catalogue_entities"),
        sa.UniqueConstraint("entity_type", "key", name="uq_catalogue_entities_type_key"),
        sa.UniqueConstraint("id", "entity_type", name="uq_catalogue_entities_id_type"),
    )
    op.create_index("ix_catalogue_entities_type_status", "catalogue_entities", ["entity_type", "status"])

    # contact_service_id → services is added after `services` exists (the two tables reference each other).
    op.create_table(
        "service_domains",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("entity_type", sa.String(16), server_default="domain", nullable=False),
        sa.Column("code", sa.String(1), nullable=False),
        sa.Column("band", sa.String(16), nullable=False),
        sa.Column("icon", sa.String(32), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("contact_service_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint("entity_type = 'domain'", name="ck_service_domains_entity_type"),
        sa.CheckConstraint("code ~ '^[A-Z]$'", name="ck_service_domains_code_format"),
        sa.CheckConstraint("band IN ('ai', 'engineering', 'operations')", name="ck_service_domains_band"),
        sa.CheckConstraint("position >= 0", name="ck_service_domains_position"),
        _subtype_fk("service_domains"),
        sa.PrimaryKeyConstraint("id", name="pk_service_domains"),
        sa.UniqueConstraint("code", name="uq_service_domains_code"),
        sa.UniqueConstraint(
            "band", "position", name="uq_service_domains_band_position", deferrable=True, initially="DEFERRED"
        ),
    )

    op.create_table(
        "service_families",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("entity_type", sa.String(16), server_default="family", nullable=False),
        sa.Column("domain_id", sa.Uuid(), nullable=False),
        sa.Column("delivery_status", sa.String(12), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("entity_type = 'family'", name="ck_service_families_entity_type"),
        sa.CheckConstraint(
            "delivery_status IN ('available', 'custom', 'planned')", name="ck_service_families_delivery_status"
        ),
        sa.CheckConstraint("position >= 0", name="ck_service_families_position"),
        _subtype_fk("service_families"),
        sa.ForeignKeyConstraint(
            ["domain_id"],
            ["service_domains.id"],
            name="fk_service_families_domain_id_service_domains",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_service_families"),
        sa.UniqueConstraint(
            "domain_id",
            "position",
            name="uq_service_families_domain_position",
            deferrable=True,
            initially="DEFERRED",
        ),
    )
    op.create_index("ix_service_families_domain_id", "service_families", ["domain_id"])

    lead_categories = ", ".join(f"'{key}'" for key in LEAD_CATEGORIES)
    op.create_table(
        "services",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("entity_type", sa.String(16), server_default="service", nullable=False),
        sa.Column("offering_type", sa.String(20), server_default="service", nullable=False),
        sa.Column("primary_domain_id", sa.Uuid(), nullable=True),
        sa.Column("delivery_status", sa.String(12), nullable=False),
        sa.Column("lead_category", sa.String(32), nullable=True),
        sa.Column("icon", sa.String(32), nullable=True),
        sa.Column("custom_page", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_entry_offer", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("entity_type = 'service'", name="ck_services_entity_type"),
        sa.CheckConstraint("offering_type IN ('service')", name="ck_services_offering_type"),
        sa.CheckConstraint(
            "delivery_status IN ('available', 'custom', 'planned')", name="ck_services_delivery_status"
        ),
        sa.CheckConstraint(
            f"lead_category IS NULL OR lead_category IN ({lead_categories})", name="ck_services_lead_category"
        ),
        sa.CheckConstraint(
            "offering_type <> 'service' OR (primary_domain_id IS NOT NULL AND lead_category IS NOT NULL)",
            name="ck_services_service_requirements",
        ),
        sa.CheckConstraint("position >= 0", name="ck_services_position"),
        _subtype_fk("services"),
        sa.ForeignKeyConstraint(
            ["primary_domain_id"],
            ["service_domains.id"],
            name="fk_services_primary_domain_id_service_domains",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_services"),
        sa.UniqueConstraint("lead_category", name="uq_services_lead_category"),
    )
    op.create_index("ix_services_primary_domain_id", "services", ["primary_domain_id"])
    op.create_foreign_key(
        "fk_service_domains_contact_service_id_services",
        "service_domains",
        "services",
        ["contact_service_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_table(
        "family_services",
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("service_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("position >= 0", name="ck_family_services_position"),
        sa.ForeignKeyConstraint(
            ["family_id"],
            ["service_families.id"],
            name="fk_family_services_family_id_service_families",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["service_id"], ["services.id"], name="fk_family_services_service_id_services", ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("family_id", "service_id", name="pk_family_services"),
        sa.UniqueConstraint(
            "family_id",
            "position",
            name="uq_family_services_family_position",
            deferrable=True,
            initially="DEFERRED",
        ),
    )
    op.create_index("ix_family_services_service_id", "family_services", ["service_id"])

    op.create_table(
        "entity_translations",
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("locale", sa.String(2), nullable=False),
        sa.Column("route_namespace", sa.String(16), nullable=True),
        sa.Column("slug", sa.String(80), nullable=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("short_name", sa.String(80), nullable=True),
        sa.Column("summary", sa.String(300), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("cta_label", sa.String(80), nullable=True),
        sa.Column("prerequisite", sa.String(400), nullable=True),
        sa.Column("seo_title", sa.String(70), nullable=True),
        sa.Column("seo_description", sa.String(175), nullable=True),
        sa.Column("primary_keyword", sa.String(100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("locale IN ('bg', 'en')", name="ck_entity_translations_locale"),
        sa.CheckConstraint(
            "route_namespace IS NULL OR route_namespace IN ('services')", name="ck_entity_translations_route_namespace"
        ),
        sa.CheckConstraint("(route_namespace IS NULL) = (slug IS NULL)", name="ck_entity_translations_slug_namespace"),
        sa.CheckConstraint(f"slug IS NULL OR slug ~ '{SLUG_PATTERN}'", name="ck_entity_translations_slug_format"),
        sa.CheckConstraint("body IS NULL OR char_length(body) <= 2000", name="ck_entity_translations_body_length"),
        sa.ForeignKeyConstraint(
            ["entity_id"],
            ["catalogue_entities.id"],
            name="fk_entity_translations_entity_id_catalogue_entities",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("entity_id", "locale", name="pk_entity_translations"),
    )
    op.create_index(
        "uq_entity_translations_route",
        "entity_translations",
        ["locale", "route_namespace", "slug"],
        unique=True,
        postgresql_where=sa.text("slug IS NOT NULL"),
    )
    op.create_index(
        "uq_entity_translations_primary_keyword",
        "entity_translations",
        ["locale", sa.text("lower(primary_keyword)")],
        unique=True,
        postgresql_where=sa.text("primary_keyword IS NOT NULL"),
    )

    op.create_table(
        "entity_relations",
        sa.Column("from_entity_id", sa.Uuid(), nullable=False),
        sa.Column("from_type", sa.String(16), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("to_entity_id", sa.Uuid(), nullable=False),
        sa.Column("to_type", sa.String(16), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "kind IN ('related', 'cross_sell', 'delivered_through')", name="ck_entity_relations_kind"
        ),
        sa.CheckConstraint(RELATION_TYPES_CHECK, name="ck_entity_relations_kind_types"),
        sa.CheckConstraint("from_entity_id <> to_entity_id", name="ck_entity_relations_not_self"),
        sa.CheckConstraint("position >= 0", name="ck_entity_relations_position"),
        sa.ForeignKeyConstraint(
            ["from_entity_id", "from_type"],
            ["catalogue_entities.id", "catalogue_entities.entity_type"],
            name="fk_entity_relations_from",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["to_entity_id", "to_type"],
            ["catalogue_entities.id", "catalogue_entities.entity_type"],
            name="fk_entity_relations_to",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("from_entity_id", "kind", "to_entity_id", name="pk_entity_relations"),
        sa.UniqueConstraint(
            "from_entity_id",
            "kind",
            "position",
            name="uq_entity_relations_from_kind_position",
            deferrable=True,
            initially="DEFERRED",
        ),
    )
    op.create_index("ix_entity_relations_to", "entity_relations", ["to_entity_id", "kind"])


def downgrade() -> None:
    op.drop_table("entity_relations")
    op.drop_table("entity_translations")
    op.drop_table("family_services")
    op.drop_constraint("fk_service_domains_contact_service_id_services", "service_domains", type_="foreignkey")
    op.drop_table("services")
    op.drop_table("service_families")
    op.drop_table("service_domains")
    op.drop_table("catalogue_entities")
