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
    "other": "Друго",
}


def notify_new_lead(
    settings: Settings, lead_id: str, reference: str, service: str, inquiry_type: str = "contact"
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
        f"Услуга: {SERVICE_LABELS.get(service, service)}\n\n"
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
