"""Operational commands.

    python -m app.cli seed                      # bootstrap admin (+ synthetic demo data in development)
    python -m app.cli create-admin --email x@y  # password read from ADMIN_PASSWORD env or prompted
    python -m app.cli set-password --email x@y  # reset a password, clear lockout, revoke sessions
    python -m app.cli maintenance [--dry-run]   # GDPR retention + expired session cleanup
    python -m app.cli purge-synthetic           # remove synthetic development data
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from datetime import timedelta

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session

from app import audit
from app.advisor import service as advisor
from app.config import get_settings
from app.db import get_sessionmaker
from app.models import AdminSession, AdminUser, Lead, LeadNote, LeadStatus, utcnow
from app.security import hash_password, validate_password_strength
from app.services import ai_actions, leads

SYNTHETIC_SOURCE = "synthetic_seed"

# Clearly fake development records. Reserved example.com domain; no real people or companies.
_SYNTHETIC_LEADS = [
    ("maintenance", "Иван Тестов", "Демо Мода ЕООД (синтетични данни)", LeadStatus.NEW, 1,
     "Магазинът ни на WooCommerce стана бавен след последното обновяване и количката понякога дава грешка."),
    ("seo", "Мария Примерова", "Примерен Дом ООД (синтетични данни)", LeadStatus.CONTACTED, 4,
     "Искаме технически SEO одит на категориите — органичният трафик спада от няколко месеца."),
    ("ai_tools", "Георги Демов", "Тест Електроникс АД (синтетични данни)", LeadStatus.QUALIFIED, 9,
     "Търсим AI асистент, който да отговаря на въпроси за наличности и доставка въз основа на нашите данни."),
    ("automation", "Елена Образцова", "Образец Дистрибуция ЕООД (синтетични данни)", LeadStatus.PROPOSAL, 15,
     "Ръчно обработваме входящите поръчки по имейл и ги въвеждаме в ERP. Искаме автоматизация с одобрение."),
    ("analytics", "Петър Пробов", "Проба Козметика ООД (синтетични данни)", LeadStatus.WON, 24,
     "Нуждаем се от табло с продажби по продукти и анализ на изоставените колички в GA4."),
    ("integrations", "Никола Шаблонов", "Шаблон Б2Б ЕООД (синтетични данни)", LeadStatus.LOST, 33,
     "Трябва ни синхронизация на наличности между Shopify и склада чрез API и webhooks."),
    ("audit", "Десислава Макетова", "Макет Спорт ООД (синтетични данни)", LeadStatus.NEW, 0,
     "Бихме искали цялостен технически одит на магазина и план за подобрения за следващите месеци."),
]


def _print(msg: str) -> None:
    sys.stdout.write(msg + "\n")


def ensure_admin(db: Session, email: str, password: str, full_name: str) -> tuple[AdminUser, bool]:
    existing = db.scalar(select(AdminUser).where(func.lower(AdminUser.email) == email.lower()))
    if existing:
        return existing, False
    validate_password_strength(password)
    user = AdminUser(email=email.lower(), full_name=full_name, password_hash=hash_password(password))
    db.add(user)
    db.flush()
    audit.record(db, "admin.created", actor_label="cli", entity_type="admin_user", entity_id=str(user.id))
    db.commit()
    return user, True


def seed_synthetic_data(db: Session, admin: AdminUser | None) -> int:
    if db.scalar(select(func.count()).select_from(Lead).where(Lead.source == SYNTHETIC_SOURCE)):
        return 0
    now = utcnow()
    created = 0
    for index, (service, name, company, status, days_ago, message) in enumerate(_SYNTHETIC_LEADS, start=1):
        moment = now - timedelta(days=days_ago, hours=index)
        lead = Lead(
            service=service, submitted_service=service, name=name, company=company,
            **(
                {
                    "inquiry_type": "quote",
                    "platform": "woocommerce",
                    "budget_range": "undisclosed",
                    "timeline": "flexible",
                }
                if index % 2 == 0
                else {}
            ),
            email=f"demo.lead{index}@example.com", phone=None,
            message=f"[СИНТЕТИЧНИ ДАННИ] {message}",
            status=status.value, source=SYNTHETIC_SOURCE,
            privacy_acknowledged_at=moment, privacy_notice_version="synthetic",
            marketing_consent=index % 3 == 0, marketing_consent_at=moment if index % 3 == 0 else None,
            created_at=moment, updated_at=moment,
            status_changed_at=moment if status != LeadStatus.NEW else None,
        )
        db.add(lead)
        db.flush()
        if admin and status != LeadStatus.NEW:
            db.add(LeadNote(lead_id=lead.id, author_id=admin.id, created_at=moment,
                            body="[Синтетична бележка] Първоначален разговор за уточняване на обхвата."))
        created += 1
    audit.record(db, "seed.synthetic_data", actor_label="cli", details={"leads": created})
    db.commit()

    sample = db.scalar(select(Lead).where(Lead.source == SYNTHETIC_SOURCE, Lead.status == "QUALIFIED"))
    ai_actions.propose_action(
        db,
        action_type="send_message",
        summary="[Синтетично] Изпращане на последващ имейл с покана за среща",
        payload={
            "lead_reference": sample.reference if sample else None,
            "channel": "email",
            "draft": "Здравейте! Благодарим за разговора. Предлагаме кратка среща за уточняване на обхвата.",
            "synthetic": True,
        },
        requested_by="demo-agent (synthetic)",
    )
    return created


def cmd_seed(_: argparse.Namespace) -> int:
    settings = get_settings()
    with get_sessionmaker()() as db:
        admin = None
        if settings.admin_bootstrap_email and settings.admin_bootstrap_password:
            try:
                admin, created = ensure_admin(
                    db, settings.admin_bootstrap_email, settings.admin_bootstrap_password, settings.admin_bootstrap_name
                )
            except ValueError as exc:
                _print(f"[seed] Admin not created: {exc}")
                return 1
            _print(f"[seed] Admin {'created' if created else 'already exists'}: {admin.email}")
            if settings.is_production:
                _print("[seed] WARNING: remove ADMIN_BOOTSTRAP_PASSWORD from the production environment now.")
        else:
            _print("[seed] ADMIN_BOOTSTRAP_EMAIL/PASSWORD not set — skipping admin bootstrap")

        if settings.seed_sample_data and not settings.is_production:
            count = seed_synthetic_data(db, admin)
            _print(f"[seed] Synthetic leads created: {count}" if count else "[seed] Synthetic data already present")
    return 0


def _read_password() -> str | None:
    """ADMIN_PASSWORD (non-interactive) or a hidden prompt entered twice. Never echoed or logged."""
    if os.environ.get("ADMIN_PASSWORD"):
        return os.environ["ADMIN_PASSWORD"]
    password = getpass.getpass("Password (min. 12 chars, upper/lower case and digits): ")
    if getpass.getpass("Repeat password: ") != password:
        _print("Error: passwords do not match")
        return None
    return password


def cmd_create_admin(args: argparse.Namespace) -> int:
    password = _read_password()
    if password is None:
        return 1
    with get_sessionmaker()() as db:
        try:
            user, created = ensure_admin(db, args.email, password, args.name)
        except ValueError as exc:
            _print(f"Error: {exc}")
            return 1
    _print(f"Admin {'created' if created else 'already exists'}: {user.email}")
    return 0


def set_admin_password(db: Session, email: str, password: str) -> int:
    """Reset an administrator's password: clears the lockout and revokes all open sessions (audited).
    Returns the number of revoked sessions."""
    user = db.scalar(select(AdminUser).where(func.lower(AdminUser.email) == email.lower()))
    if user is None:
        raise LookupError(f"no administrator with e-mail {email}")
    validate_password_strength(password)
    now = utcnow()
    user.password_hash = hash_password(password)
    user.failed_login_count = 0
    user.locked_until = None
    revoked = db.execute(
        update(AdminSession)
        .where(AdminSession.user_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=now)
    ).rowcount
    audit.record(
        db, "admin.password_reset", actor_label="cli", entity_type="admin_user", entity_id=str(user.id),
        details={"sessions_revoked": revoked},
    )
    db.commit()
    return revoked


def cmd_set_password(args: argparse.Namespace) -> int:
    password = _read_password()
    if password is None:
        return 1
    with get_sessionmaker()() as db:
        try:
            revoked = set_admin_password(db, args.email, password)
        except (LookupError, ValueError) as exc:
            _print(f"Error: {exc}")
            return 1
    _print(f"Password updated for {args.email.lower()}; lockout cleared; sessions revoked: {revoked}")
    return 0


def cmd_purge_synthetic(_: argparse.Namespace) -> int:
    settings = get_settings()
    with get_sessionmaker()() as db:
        removed = leads.purge_synthetic(db, SYNTHETIC_SOURCE)
    _print(f"[purge-synthetic] Removed synthetic leads: {removed} (environment: {settings.app_env})")
    return 0


def cmd_maintenance(args: argparse.Namespace) -> int:
    settings = get_settings()
    with get_sessionmaker()() as db:
        result = leads.purge_expired(
            db, settings.lead_retention_days, settings.audit_retention_days, dry_run=args.dry_run
        )
        assessments = advisor.purge_expired(db, dry_run=args.dry_run)
        sessions_removed = 0
        if not args.dry_run:
            cutoff = utcnow() - timedelta(days=1)
            sessions_removed = db.execute(
                delete(AdminSession).where(
                    or_(AdminSession.expires_at < utcnow(), AdminSession.revoked_at < cutoff)
                )
            ).rowcount
            db.commit()
    prefix = "[dry-run] would delete" if args.dry_run else "deleted"
    _print(
        f"{prefix}: leads={result.leads_deleted} audit_entries={result.audit_entries_deleted} "
        f"advisor_assessments={assessments.due if args.dry_run else assessments.deleted} "
        f"sessions={sessions_removed}"
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("seed", help="Bootstrap admin and synthetic development data").set_defaults(func=cmd_seed)
    create = sub.add_parser("create-admin", help="Create an administrator account")
    create.add_argument("--email", required=True)
    create.add_argument("--name", default="Администратор")
    create.set_defaults(func=cmd_create_admin)
    reset = sub.add_parser("set-password", help="Reset an administrator's password (clears lockout, revokes sessions)")
    reset.add_argument("--email", required=True)
    reset.set_defaults(func=cmd_set_password)
    maint = sub.add_parser("maintenance", help="Apply retention policy and remove expired sessions")
    maint.add_argument("--dry-run", action="store_true")
    maint.set_defaults(func=cmd_maintenance)
    sub.add_parser(
        "purge-synthetic", help="Delete all synthetic development leads (source=synthetic_seed)"
    ).set_defaults(func=cmd_purge_synthetic)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
