# ruff: noqa: E501, S608
"""Migrations 0023 and 0024 on a populated database (synthetic data only; never production data).

The database is brought to revision 0022 and filled with rows like those of a real installation: inquiries with
their privacy and marketing version columns, verified and unverified accounts, a workspace with its sessions,
billing customer, checkouts, subscriptions, a purchase, an accounting record, outbox messages and audit entries.
Then it is upgraded and checked: nothing is lost or changed, the new constraints, indexes and grants exist, the
models read the migrated schema, legal evidence can be written, and account erasure behaves. The downgrade is
exercised only BEFORE any legal evidence is written (a downgrade drops the evidence tables).
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from alembic import command
from sqlalchemy import create_engine, func, inspect, select, text
from sqlalchemy.orm import Session

from app.accounts.models import CustomerAccount, OutboxMessage
from app.billing.models import BillingCheckout, BillingSubscription
from app.compliance import events as _events  # noqa: F401  (registers the consent-history listeners)
from app.compliance import service
from app.compliance.models import DataRequest, LegalEvent, WithdrawalRequest
from app.config import get_settings
from app.invoicing.models import AccountingDocument
from app.models import AuditLog, Lead, utcnow
from app.workspace.models import CustomerWorkspace
from tests.conftest import TEST_DATABASE_URL, alembic_config, recreate_database

NAME = "acs_migration_populated"
URL = TEST_DATABASE_URL.rsplit("/", 1)[0] + f"/{NAME}"
OLD_TABLES = (
    "leads",
    "customer_accounts",
    "customer_workspaces",
    "customer_sessions",
    "billing_offers",
    "billing_customers",
    "billing_checkouts",
    "billing_subscriptions",
    "billing_purchases",
    "accounting_documents",
    "billing_profiles",
    "outbox_messages",
    "audit_logs",
    "workspace_members",
)
NEW_TABLES = ("legal_events", "withdrawal_requests", "data_requests")


def _counts(engine) -> dict[str, int]:
    with engine.connect() as conn:
        return {t: conn.execute(text(f"SELECT count(*) FROM {t}")).scalar_one() for t in OLD_TABLES}


def _populate(engine) -> dict[str, uuid.UUID]:
    ids = {name: uuid.uuid4() for name in ("verified", "unverified", "workspace", "plain_account", "plain_workspace")}
    with engine.begin() as conn:
        run = conn.execute
        for email, consent in (("old1@example.com", True), ("old2@example.com", False)):
            run(
                text(
                    "INSERT INTO leads (id, service, name, company, email, message, status, source, "
                    "privacy_acknowledged_at, privacy_notice_version, marketing_consent, marketing_consent_at, "
                    "marketing_consent_version, created_at, updated_at, submitted_service) "
                    "VALUES (gen_random_uuid(), 'seo', 'Синтетичен', 'Синтетична ООД', :email, 'Синтетичен запис', "
                    "'NEW', 'website_contact_form', now(), '2026-10-draft', :consent, "
                    "CASE WHEN :consent THEN now() END, CASE WHEN :consent THEN '2026-10-v1' END, now(), now(), 'seo')"
                ),
                {"email": email, "consent": consent},
            )
        for key, email, verified in (
            ("verified", "synthetic.verified@example.com", True),
            ("unverified", "synthetic.unverified@example.com", False),
            ("plain_account", "synthetic.plain@example.com", True),
        ):
            run(
                text(
                    "INSERT INTO customer_accounts (id, email, password_hash, privacy_notice_version, "
                    "privacy_acknowledged_at, email_verified_at, created_at, updated_at) "
                    "VALUES (:id, :email, '!synthetic', '2026-10-draft', now(), "
                    "CASE WHEN :verified THEN now() END, now() - interval '60 days', now())"
                ),
                {"id": ids[key], "email": email, "verified": verified},
            )
        run(
            text("INSERT INTO customer_workspaces (id, owner_account_id) VALUES (:w, :a), (:pw, :pa)"),
            {"w": ids["workspace"], "a": ids["verified"], "pw": ids["plain_workspace"], "pa": ids["plain_account"]},
        )
        run(
            text(
                "INSERT INTO workspace_members (workspace_id, account_id, role, created_at) "
                "VALUES (:w, :a, 'billing', now())"
            ),
            {"w": ids["workspace"], "a": ids["verified"]},
        )
        run(
            text(
                "INSERT INTO customer_sessions (id, account_id, token_hash, csrf_hash, created_at, last_seen_at, "
                "expires_at) VALUES (gen_random_uuid(), :a, 'hash-1', 'csrf-1', now(), now(), now() + interval '1 hour')"
            ),
            {"a": ids["verified"]},
        )
        run(
            text(
                "INSERT INTO billing_offers (key, kind, plan_key, billing_interval, stripe_price_id, currency, "
                "amount_minor, requires_scope) VALUES ('pro_monthly', 'subscription', 'pro', 'month', 'price_synth', "
                "'eur', 2900, false)"
            )
        )
        run(
            text(
                "INSERT INTO billing_customers (workspace_id, stripe_customer_id, billing_owner_account_id, created_at) "
                "VALUES (:w, 'cus_synthetic', :a, now())"
            ),
            {"w": ids["workspace"], "a": ids["verified"]},
        )
        run(
            text(
                "INSERT INTO billing_checkouts (id, workspace_id, offer_key, status, created_at) VALUES "
                "(gen_random_uuid(), :w, 'pro_monthly', 'complete', now() - interval '40 days'), "
                "(gen_random_uuid(), :w, 'pro_monthly', 'open', now())"
            ),
            {"w": ids["workspace"]},
        )
        run(
            text(
                "INSERT INTO billing_subscriptions (stripe_subscription_id, workspace_id, offer_key, status, "
                "cancel_at_period_end, action_required, onboarding_status, synced_at) VALUES "
                "('sub_active', :w, 'pro_monthly', 'active', false, false, 'not_required', now()), "
                "('sub_old', :w, 'pro_monthly', 'canceled', false, false, 'not_required', now())"
            ),
            {"w": ids["workspace"]},
        )
        run(
            text(
                "INSERT INTO billing_purchases (stripe_session_id, workspace_id, offer_key, payment_status, "
                "access_active, onboarding_status, created_at) VALUES "
                "('cs_synthetic', :w, 'pro_monthly', 'paid', true, 'not_required', now())"
            ),
            {"w": ids["workspace"]},
        )
        run(
            text(
                "INSERT INTO accounting_documents (id, workspace_id, kind, status, source_key, demo, currency, "
                "amount_minor, description, buyer, tax, attempts, next_attempt_at, created_at) VALUES "
                "(gen_random_uuid(), :w, 'invoice', 'queued', 'purchase:cs_synthetic', true, 'eur', 2900, "
                "'Синтетична демонстрация', '{}'::jsonb, '{}'::jsonb, 0, now(), now())"
            ),
            {"w": ids["workspace"]},
        )
        run(
            text(
                "INSERT INTO billing_profiles (workspace_id, legal_name, address, country, email, updated_at) "
                "VALUES (:w, 'Синтетична ООД', 'София', 'BG', 'billing@example.com', now())"
            ),
            {"w": ids["workspace"]},
        )
        run(
            text(
                "INSERT INTO outbox_messages (id, account_id, kind, locale, status, next_attempt_at, created_at) "
                "VALUES (gen_random_uuid(), :a, 'verify_email', 'bg', 'pending', now(), now())"
            ),
            {"a": ids["verified"]},
        )
        run(
            text(
                "INSERT INTO audit_logs (created_at, actor_label, action, details) "
                "VALUES (now(), 'synthetic', 'synthetic.seed', '{}'::jsonb)"
            )
        )
    return ids


@pytest.fixture
def migrated():
    recreate_database(NAME)
    cfg = alembic_config(URL)
    command.upgrade(cfg, "0022")
    engine = create_engine(URL)
    ids = _populate(engine)
    before = _counts(engine)
    with engine.connect() as conn:
        lead_rows = conn.execute(
            text(
                "SELECT email, privacy_notice_version, marketing_consent, marketing_consent_version FROM leads ORDER BY email"
            )
        ).all()
    yield cfg, engine, ids, before, lead_rows
    engine.dispose()


def test_upgrade_keeps_every_existing_row_and_adds_only_what_was_promised(migrated):
    cfg, engine, ids, before, lead_rows = migrated
    assert all(count > 0 for count in before.values()), before  # the fixture is really populated
    command.upgrade(cfg, "head")
    assert _counts(engine) == before
    with engine.connect() as conn:
        assert [
            tuple(r)
            for r in conn.execute(
                text(
                    "SELECT email, privacy_notice_version, marketing_consent, marketing_consent_version FROM leads ORDER BY email"
                )
            )
        ] == [tuple(r) for r in lead_rows]
        for table in NEW_TABLES:
            assert conn.execute(text(f"SELECT count(*) FROM {table}")).scalar_one() == 0
        added = {
            ("leads", "marketing_consent_withdrawn_at"),
            ("leads", "marketing_token_hash"),
            ("customer_accounts", "erased_at"),
            ("outbox_messages", "reference"),
            ("billing_checkouts", "completed_at"),
        }
        for table, column in added:
            assert column in {c["name"] for c in inspect(engine).get_columns(table)}
            assert conn.execute(text(f"SELECT count(*) FROM {table} WHERE {column} IS NOT NULL")).scalar_one() == 0


def test_the_new_constraints_indexes_and_grants_exist(migrated):
    cfg, engine, *_ = migrated
    command.upgrade(cfg, "head")
    with engine.connect() as conn:
        indexes = {r[0] for r in conn.execute(text("SELECT indexname FROM pg_indexes WHERE schemaname='public'"))}
        assert {
            "uq_withdrawal_requests_open",
            "uq_data_requests_open",
            "uq_legal_events_checkout_once",
            "uq_outbox_messages_kind_reference",
            "uq_leads_marketing_token_hash",
        } <= indexes
        constraints = {r[0] for r in conn.execute(text("SELECT conname FROM pg_constraint"))}
        assert {
            "ck_legal_events_action",
            "ck_legal_events_one_subject",
            "ck_withdrawal_requests_status",
            "ck_withdrawal_requests_eligibility",
            "ck_data_requests_kind",
        } <= constraints
        privilege = lambda table, kind: conn.execute(  # noqa: E731
            text("SELECT has_table_privilege('acs_app_api', :t, :k)"), {"t": table, "k": kind}
        ).scalar_one()
        assert privilege("legal_events", "INSERT") and not privilege("legal_events", "UPDATE")
        assert not privilege("legal_events", "DELETE")  # the API role cannot change or remove evidence
        assert privilege("withdrawal_requests", "UPDATE") and not privilege("withdrawal_requests", "DELETE")
        assert privilege("data_requests", "INSERT") and not privilege("data_requests", "DELETE")
        for table in NEW_TABLES:
            assert not conn.execute(
                text("SELECT has_table_privilege('acs_app_runtime', :t, 'SELECT')"), {"t": table}
            ).scalar_one()


def test_the_models_read_the_migrated_schema_and_evidence_can_be_written(migrated):
    cfg, engine, ids, before, _ = migrated
    command.upgrade(cfg, "head")
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Lead)) == 2
        assert db.scalar(select(func.count()).select_from(CustomerAccount)) == 3
        assert db.scalar(select(func.count()).select_from(AccountingDocument)) == 1
        assert db.scalar(select(func.count()).select_from(BillingSubscription)) == 2
        assert {c.status for c in db.scalars(select(BillingCheckout))} == {"complete", "open"}
        # A new inquiry after the migration writes its consent history; the old rows have none (no backfill).
        db.add(
            Lead(
                service="seo",
                submitted_service="seo",
                name="Нов",
                company="Нова ООД",
                email="new@example.com",
                message="Нов запис след миграцията",
                source="website_contact_form",
                privacy_acknowledged_at=utcnow(),
                privacy_notice_version="2026-11-10",
                marketing_consent=True,
                marketing_consent_at=utcnow(),
                marketing_consent_version="2026-11-10",
            )
        )
        db.commit()
        assert db.scalar(select(func.count()).select_from(LegalEvent).where(LegalEvent.lead_id.is_not(None))) == 2
        old = db.scalar(select(Lead).where(Lead.email == "old1@example.com"))
        assert db.scalar(select(func.count()).select_from(LegalEvent).where(LegalEvent.lead_id == old.id)) == 0
        # Marketing withdrawal of an old lead works and keeps its original consent evidence.
        assert service.withdraw_lead_marketing(db, old) is True
        db.commit()
        assert old.marketing_consent_version == "2026-10-v1" and old.marketing_consent_withdrawn_at is not None
        # The audit log and outbox still load.
        assert db.scalar(select(func.count()).select_from(AuditLog)) >= 1
        assert db.scalar(select(func.count()).select_from(OutboxMessage)) == 1


def test_erasure_after_the_migration_keeps_accounting_records_and_deletes_the_rest(migrated):
    cfg, engine, ids, *_ = migrated
    command.upgrade(cfg, "head")
    settings = get_settings()
    with Session(engine) as db:
        owner = db.get(CustomerAccount, ids["verified"])
        # The synthetic billing state has an active subscription and an open checkout: erasure must be refused.
        reasons = service.deletion_blockers(db, settings, owner, now=utcnow())
        assert "subscription_active" in reasons and "checkout_open" in reasons
        for row in db.scalars(select(BillingSubscription)):
            row.status = "canceled"
        db.scalar(select(BillingCheckout).where(BillingCheckout.status == "open")).status = "expired"
        db.commit()
        assert service.deletion_blockers(db, settings, owner) == []
        assert service.erase_account(db, owner) == "anonymized"  # it has billing and accounting records
        db.commit()
        assert owner.erased_at is not None and owner.email.endswith("@invalid.invalid")
        assert db.scalar(select(func.count()).select_from(AccountingDocument)) == 1
        assert db.scalar(select(func.count()).select_from(BillingCheckout)) == 2
        assert db.scalar(select(func.count()).select_from(CustomerWorkspace)) == 2
        plain = db.get(CustomerAccount, ids["plain_account"])
        assert service.erase_account(db, plain) == "deleted"  # nothing financial: removed completely
        db.commit()
        assert db.get(CustomerAccount, ids["plain_account"]) is None
        unverified = db.get(CustomerAccount, ids["unverified"])
        assert unverified.created_at < utcnow() - timedelta(days=30)  # the 30-day purge of unverified accounts applies


def test_downgrade_before_any_evidence_returns_to_the_old_schema_without_touching_data(migrated):
    cfg, engine, ids, before, lead_rows = migrated
    command.upgrade(cfg, "head")
    # No legal evidence exists yet, so the downgrade destroys nothing of value.
    with engine.connect() as conn:
        assert all(conn.execute(text(f"SELECT count(*) FROM {t}")).scalar_one() == 0 for t in NEW_TABLES)
    command.downgrade(cfg, "0022")
    assert _counts(engine) == before
    tables = set(inspect(engine).get_table_names())
    assert not (set(NEW_TABLES) & tables)
    assert "marketing_token_hash" not in {c["name"] for c in inspect(engine).get_columns("leads")}
    command.upgrade(cfg, "head")  # and forward again
    assert _counts(engine) == before


def test_a_downgrade_would_drop_evidence_so_it_is_documented_as_irreversible_after_release(migrated):
    """Not a downgrade: it states the rollback risk the release notes rely on (docs/LEGAL_RETENTION.md)."""
    cfg, engine, ids, *_ = migrated
    command.upgrade(cfg, "head")
    with Session(engine) as db:
        db.add(DataRequest(reference="D-SYNTH", account_id=ids["verified"], kind="correction"))
        db.add(
            WithdrawalRequest(
                reference="W-SYNTH",
                workspace_id=ids["workspace"],
                subject_kind="subscription",
                subject_ref="sub_active",
                offer_key="pro_monthly",
                statement="x" * 12,
                locale="bg",
                customer_kind="consumer",
                eligibility="within_period",
            )
        )
        db.commit()
        assert db.scalar(select(func.count()).select_from(WithdrawalRequest)) == 1
    import pathlib

    migration = (
        pathlib.Path(__file__).resolve().parents[1] / "alembic/versions/20261110_0023_legal_compliance.py"
    ).read_text(encoding="utf-8")
    assert 'op.drop_table("withdrawal_requests")' in migration  # the downgrade drops them: never run it after release
