"""Outbound e-mail. Nothing is sent unless SMTP_HOST, SMTP_FROM and LEAD_NOTIFICATION_EMAIL are set."""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import Settings

logger = logging.getLogger(__name__)

SERVICE_LABELS = {
    "maintenance": "Поддръжка на онлайн магазини",
    "seo": "SEO и органичен растеж",
    "ai_tools": "AI инструменти по поръчка",
    "automation": "Автоматизация на процеси",
    "analytics": "Анализи и конверсии",
    "integrations": "API интеграции, облак и сигурност",
    "audit": "Технически одит",
    "ai_managed": "AI Managed Services",
    "other": "Друго",
}

LANGUAGE_LABELS = {"bg": "български", "en": "английски"}

# Customer acknowledgement templates per language. PREPARED ONLY: no code path sends e-mail to
# visitors. Enabling it requires an approved provider, a privacy-policy update and explicit sign-off.
CUSTOMER_ACKNOWLEDGEMENT = {
    "bg": {
        "subject": "Получихме запитването ви ({reference})",
        "body": (
            "Здравейте,\n\nБлагодарим ви за запитването. Референтният му номер е {reference}. "
            "Ще го прегледаме и ще се свържем с вас в рамките на работното време.\n\n"
            "Моля, не изпращайте пароли, API ключове или поверителни документи по имейл.\n\nA.I. Commerce Studio"
        ),
    },
    "en": {
        "subject": "We have received your inquiry ({reference})",
        "body": (
            "Hello,\n\nThank you for your inquiry. Its reference number is {reference}. "
            "We will review it and get back to you during business hours.\n\n"
            "Please do not send passwords, API keys or confidential documents by email.\n\nA.I. Commerce Studio"
        ),
    },
}


def customer_acknowledgement(locale: str, reference: str) -> tuple[str, str]:
    """Subject and body of the (not yet enabled) customer acknowledgement in the inquiry's language."""
    template = CUSTOMER_ACKNOWLEDGEMENT.get(locale, CUSTOMER_ACKNOWLEDGEMENT["bg"])
    return template["subject"].format(reference=reference), template["body"].format(reference=reference)


def notify_new_lead(
    settings: Settings,
    lead_id: str,
    reference: str,
    service: str,
    inquiry_type: str = "contact",
    locale: str = "bg",
) -> None:
    """Notify the team about a new inquiry. The e-mail deliberately contains no personal data —
    details are only visible after logging in to the admin panel."""
    if not settings.email_enabled:
        logger.info("lead_notification_skipped", extra={"reason": "email provider not configured", "lead": reference})
        return

    message = EmailMessage()
    kind = "Заявка за оферта" if inquiry_type == "quote" else "Ново запитване"
    message["Subject"] = f"{kind} {reference}: {SERVICE_LABELS.get(service, service)}"
    message["From"] = settings.smtp_from
    message["To"] = settings.lead_notification_email
    message.set_content(
        "Получено е ново запитване през контактната форма.\n\n"
        f"Референция: {reference}\n"
        f"Услуга: {SERVICE_LABELS.get(service, service)}\n"
        f"Език на клиента: {LANGUAGE_LABELS.get(locale, locale)}\n\n"
        f"Преглед: {settings.site_url.rstrip('/')}/admin/leads/{lead_id}\n"
    )
    try:
        with smtplib.SMTP(settings.smtp_host or "", settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        logger.info("lead_notification_sent", extra={"lead": reference})
    except (smtplib.SMTPException, OSError):
        logger.exception("lead_notification_failed", extra={"lead": reference})
