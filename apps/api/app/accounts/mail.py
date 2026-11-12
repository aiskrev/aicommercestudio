"""Transactional e-mail: delivery adapters, templates and the outbox dispatcher.

The outbox row stores what to send, never how to reach someone or a token. At send time the
dispatcher reads the address, creates a fresh one-time token (which replaces any older one) and
builds the message, so a raw token is never persisted or logged.

Links put the token after `#`: a fragment is not sent to servers, so it cannot reach an access log.
The origin comes from SITE_URL, never from a request header.

Without a provider nothing pretends to work: rows become `blocked`, and the API refuses to accept a
sign-up (see `email_available`). Production refuses to start with accounts on and no provider.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
import uuid
from datetime import timedelta
from email.message import EmailMessage
from pathlib import Path
from typing import Protocol

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.accounts.models import CustomerAccount, CustomerToken, OutboxKind, OutboxMessage, OutboxStatus, TokenPurpose
from app.config import Settings, get_settings
from app.db import get_sessionmaker
from app.models import utcnow
from app.projects.notify_texts import PROJECT_TEXTS
from app.security import generate_token, hash_token

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 6
BACKOFF_MINUTES = (1, 5, 15, 60, 240)
PATHS = {
    ("project", "bg"): "/bg/konto/izrabotka",
    ("project", "en"): "/en/account/delivery",
    ("verify", "bg"): "/bg/konto/potvardi",
    ("verify", "en"): "/en/account/verify",
    ("reset", "bg"): "/bg/konto/nova-parola",
    ("reset", "en"): "/en/account/reset-password",
    ("signin", "bg"): "/bg/konto/vhod",
    ("signin", "en"): "/en/account/sign-in",
    ("forgot", "bg"): "/bg/konto/zabravena-parola",
    ("forgot", "en"): "/en/account/forgot-password",
}

_HELLO = {"bg": "Здравейте,", "en": "Hello,"}
_LINK_RULES = {
    "bg": "Линкът важи {hours} часа и може да се използва веднъж.",
    "en": "The link is valid for {hours} hours and works once.",
}
TEXTS = {
    OutboxKind.VERIFY_EMAIL: {
        "bg": (
            "Потвърдете имейла си",
            f"{_HELLO['bg']}\n\nПотвърдете имейла си за A.I. Commerce Studio:\n{{link}}\n\n{_LINK_RULES['bg']} "
            "Ако не сте се регистрирали, пренебрегнете това писмо.\n",
        ),
        "en": (
            "Confirm your e-mail",
            f"{_HELLO['en']}\n\nConfirm your e-mail for A.I. Commerce Studio:\n{{link}}\n\n{_LINK_RULES['en']} "
            "If you didn't sign up, ignore this message.\n",
        ),
    },
    OutboxKind.RESET_PASSWORD: {
        "bg": (
            "Нова парола",
            f"{_HELLO['bg']}\n\nЗадайте нова парола за A.I. Commerce Studio:\n{{link}}\n\n{_LINK_RULES['bg']} "
            "Ако не сте го поискали, пренебрегнете това писмо.\n",
        ),
        "en": (
            "Reset your password",
            f"{_HELLO['en']}\n\nSet a new password for A.I. Commerce Studio:\n{{link}}\n\n{_LINK_RULES['en']} "
            "If you didn't ask for this, ignore this message.\n",
        ),
    },
    OutboxKind.WITHDRAWAL_RECEIVED: {
        "bg": (
            "Получихме изявлението ви за отказ от договор",
            f"{_HELLO['bg']}\n\nПолучихме изявлението ви за отказ от договор.\n\n"
            "Референтен номер: {reference}\nПодадено на: {when}\nПокупка: {offer}\nВашето изявление:\n{statement}\n\n"
            "Това писмо потвърждава получаването. Ще проверим договора и срока и ще ви отговорим. "
            "Ако отказът е в срок и сте потребител, сумите се връщат по същия метод на плащане "
            "не по-късно от 14 дни след получаването му, като се съобразим с евентуална пропорционална част, "
            "ако сте поискали услугата да започне в срока за отказ.\n"
            "Запазете писмото като доказателство.\n",
        ),
        "en": (
            "We received your withdrawal statement",
            f"{_HELLO['en']}\n\nWe received your statement withdrawing from the contract.\n\n"
            "Reference: {reference}\nSubmitted: {when}\nPurchase: {offer}\nYour statement:\n{statement}\n\n"
            "This message confirms receipt. We will check the contract and the period and reply to you. "
            "If the withdrawal "
            "is within the period and you are a consumer, refunds go to the same payment method no later than 14 days "
            "after we received it, taking into account any proportionate amount if you asked for the service to start "
            "within the withdrawal period.\nKeep this message as evidence.\n",
        ),
    },
    OutboxKind.ACCOUNT_EXISTS: {
        "bg": (
            "Вече имате акаунт",
            f"{_HELLO['bg']}\n\nНякой се опита да се регистрира с този имейл, но вече имате акаунт.\n"
            "Вход: {link}\nЗабравена парола: {forgot}\n\nАко не сте били вие, пренебрегнете това писмо.\n",
        ),
        "en": (
            "You already have an account",
            f"{_HELLO['en']}\n\nSomeone tried to sign up with this e-mail, but you already have an account.\n"
            "Sign in: {link}\nForgot your password: {forgot}\n\nIf this wasn't you, ignore this message.\n",
        ),
    },
}


# Service messages about a customer's own project (Phase 11).
TEXTS.update(PROJECT_TEXTS)


class EmailNotConfigured(RuntimeError):
    pass


class EmailSender(Protocol):
    def send(self, recipient: str, subject: str, body: str) -> None: ...


def _message(settings: Settings, recipient: str, subject: str, body: str) -> EmailMessage:
    message = EmailMessage()
    message["From"] = settings.smtp_from or "no-reply@localhost"
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)
    return message


class SmtpSender:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def send(self, recipient: str, subject: str, body: str) -> None:
        s = self.settings
        with smtplib.SMTP(s.smtp_host or "", s.smtp_port, timeout=15) as smtp:
            if s.smtp_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if s.smtp_username and s.smtp_password:
                smtp.login(s.smtp_username, s.smtp_password)
            smtp.send_message(_message(s, recipient, subject, body))


class DevFileSender:
    """Development only: writes .eml files to a local folder instead of sending anything."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def send(self, recipient: str, subject: str, body: str) -> None:
        folder = Path(self.settings.email_dev_dir)
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"{uuid.uuid4()}.eml").write_bytes(bytes(_message(self.settings, recipient, subject, body)))


def email_available(settings: Settings | None = None) -> bool:
    s = settings or get_settings()
    if s.email_provider == "smtp":
        return bool(s.smtp_host and s.smtp_from)
    return s.email_provider == "dev_file"


def get_sender(settings: Settings | None = None) -> EmailSender:
    s = settings or get_settings()
    if not email_available(s):
        raise EmailNotConfigured
    return SmtpSender(s) if s.email_provider == "smtp" else DevFileSender(s)


def enqueue(db: Session, account: CustomerAccount, kind: OutboxKind, locale: str | None = None) -> OutboxMessage:
    message = OutboxMessage(account_id=account.id, kind=kind.value, locale=locale or account.locale)
    db.add(message)
    return message


def _issue_token(db: Session, account_id: uuid.UUID, purpose: TokenPurpose, hours: int) -> str:
    """A new one-time token; any unused one for the same purpose stops working."""
    now = utcnow()
    db.execute(
        update(CustomerToken)
        .where(
            CustomerToken.account_id == account_id,
            CustomerToken.purpose == purpose.value,
            CustomerToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    raw = generate_token()
    db.add(
        CustomerToken(
            account_id=account_id,
            purpose=purpose.value,
            token_hash=hash_token(raw),
            expires_at=now + timedelta(hours=hours),
        )
    )
    return raw


def _render(db: Session, settings: Settings, row: OutboxMessage) -> tuple[str, str]:
    kind = OutboxKind(row.kind)
    locale = row.locale if row.locale in ("bg", "en") else "bg"
    subject, template = TEXTS[kind][locale]
    origin = settings.site_url.rstrip("/")
    if kind is OutboxKind.VERIFY_EMAIL:
        hours = settings.account_verify_token_hours
        token = _issue_token(db, row.account_id, TokenPurpose.VERIFY_EMAIL, hours)
        return subject, template.format(link=f"{origin}{PATHS[('verify', locale)]}#token={token}", hours=hours)
    if kind is OutboxKind.RESET_PASSWORD:
        hours = settings.account_reset_token_hours
        token = _issue_token(db, row.account_id, TokenPurpose.RESET_PASSWORD, hours)
        return subject, template.format(link=f"{origin}{PATHS[('reset', locale)]}#token={token}", hours=hours)
    if kind in PROJECT_TEXTS:
        from app.projects.models import CommercialProject

        project = db.get(CommercialProject, row.project_id) if row.project_id else None
        if project is None or project.status == "draft":
            raise LookupError("project_missing")
        link = f"{origin}{PATHS[('project', locale)]}?p={project.id}"
        return subject.format(reference=project.reference), template.format(
            reference=project.reference, title=project.title, link=link
        )
    if kind is OutboxKind.WITHDRAWAL_RECEIVED:
        from app.compliance.models import WithdrawalRequest

        request = db.scalar(select(WithdrawalRequest).where(WithdrawalRequest.reference == row.reference))
        if request is None:
            raise LookupError("withdrawal_missing")
        return subject, template.format(
            reference=request.reference,
            when=request.created_at.strftime("%Y-%m-%d %H:%M UTC"),
            offer=request.offer_key,
            statement=request.statement,
        )
    return subject, template.format(
        link=f"{origin}{PATHS[('signin', locale)]}", forgot=f"{origin}{PATHS[('forgot', locale)]}"
    )


def _permanent(error: Exception) -> bool:
    """A refusal that retrying cannot fix: the provider rejected the recipient or answered with a 5xx code."""
    if isinstance(error, smtplib.SMTPRecipientsRefused):
        return True
    return isinstance(error, smtplib.SMTPResponseException) and 500 <= error.smtp_code < 600


def dispatch_pending(sender: EmailSender | None = None, limit: int = 20) -> dict[str, int]:
    """Send what is due. Safe to run from several processes: rows are claimed with SKIP LOCKED."""
    settings = get_settings()
    result = {"sent": 0, "retry": 0, "failed": 0, "blocked": 0}
    with get_sessionmaker()() as db:
        rows = db.scalars(
            select(OutboxMessage)
            .where(OutboxMessage.status == OutboxStatus.PENDING.value, OutboxMessage.next_attempt_at <= utcnow())
            .order_by(OutboxMessage.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        ).all()
        for row in rows:
            try:
                active = sender or get_sender(settings)
            except EmailNotConfigured:
                row.status = OutboxStatus.BLOCKED.value
                row.last_error = "provider_not_configured"
                result["blocked"] += 1
                logger.error("outbox_blocked", extra={"outbox_id": str(row.id), "kind": row.kind})
                continue
            account = db.get(CustomerAccount, row.account_id)
            if account is None or account.erased_at is not None or not account.email:
                row.status = OutboxStatus.FAILED.value
                row.last_error = "recipient_invalid"
                result["failed"] += 1
                continue
            row.attempts += 1
            try:
                with db.begin_nested():
                    subject, body = _render(db, settings, row)
                    active.send(account.email, subject, body)
            except LookupError:
                row.status = OutboxStatus.FAILED.value
                row.last_error = "source_missing"
                result["failed"] += 1
                logger.warning("outbox_source_missing", extra={"outbox_id": str(row.id), "kind": row.kind})
            except (smtplib.SMTPException, OSError) as error:
                row.last_error = type(error).__name__[:60]
                if row.attempts >= MAX_ATTEMPTS or _permanent(error):
                    row.status = OutboxStatus.FAILED.value
                    result["failed"] += 1
                else:
                    delay = BACKOFF_MINUTES[min(row.attempts - 1, len(BACKOFF_MINUTES) - 1)]
                    row.next_attempt_at = utcnow() + timedelta(minutes=delay)
                    result["retry"] += 1
                logger.warning(
                    "outbox_send_failed", extra={"outbox_id": str(row.id), "kind": row.kind, "attempts": row.attempts}
                )
            else:
                row.status = OutboxStatus.SENT.value
                row.sent_at = utcnow()
                row.last_error = None
                result["sent"] += 1
        db.commit()
    return result
