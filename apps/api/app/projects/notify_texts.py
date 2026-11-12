"""Wording of the project service messages, in Bulgarian and English (docs/PROJECT_NOTIFICATIONS.md).

Each message says only that something happened in the customer's own project and where to read it after signing in. It
never carries a note, a file name, a message text, a token or an amount, and it promises no outcome or deadline. The
wording is not lawyer-approved (decision D-37); it makes no legal statement.
"""

from __future__ import annotations

from app.accounts.models import OutboxKind

_FOOT = {
    "bg": (
        "Влезте с акаунта си, за да видите подробностите. "
        "Това писмо е служебно съобщение за вашия проект и не съдържа подробности.\n\nA.I. Commerce Studio\n"
    ),
    "en": (
        "Sign in to your account to see the details. "
        "This is a service message about your project and holds no details.\n\nA.I. Commerce Studio\n"
    ),
}
_HELLO = {"bg": "Здравейте,", "en": "Hello,"}


def _text(bg_subject: str, bg_line: str, en_subject: str, en_line: str) -> dict[str, tuple[str, str]]:
    return {
        "bg": (bg_subject, f"{_HELLO['bg']}\n\n{bg_line}\n{{link}}\n\n{_FOOT['bg']}"),
        "en": (en_subject, f"{_HELLO['en']}\n\n{en_line}\n{{link}}\n\n{_FOOT['en']}"),
    }


PROJECT_TEXTS: dict[OutboxKind, dict[str, tuple[str, str]]] = {
    OutboxKind.PROJECT_AVAILABLE: _text(
        "Проект {reference} е достъпен в клиентската ви зона",
        "Проект {reference} ({title}) вече е достъпен в клиентската ви зона:",
        "Project {reference} is available in your client area",
        "Project {reference} ({title}) is now available in your client area:",
    ),
    OutboxKind.PROJECT_UPDATE: _text(
        "Ново в проект {reference}",
        "Има ново обновление в проект {reference} ({title}):",
        "There is news in project {reference}",
        "There is an update in project {reference} ({title}):",
    ),
    OutboxKind.APPROVAL_REQUESTED: _text(
        "Нужно е вашето решение: проект {reference}",
        "В проект {reference} ({title}) се иска ваше решение:",
        "Your decision is needed: project {reference}",
        "A decision from you is requested in project {reference} ({title}):",
    ),
    OutboxKind.REVIEW_REQUESTED: _text(
        "Резултатът е готов за преглед: проект {reference}",
        "Резултатът по проект {reference} ({title}) е готов за вашия преглед:",
        "The result is ready for your review: project {reference}",
        "The result of project {reference} ({title}) is ready for your review:",
    ),
    OutboxKind.DOCUMENT_PUBLISHED: _text(
        "Нов документ в проект {reference}",
        "Екипът публикува нов документ в проект {reference} ({title}):",
        "A new document in project {reference}",
        "The team published a new document in project {reference} ({title}):",
    ),
    OutboxKind.SUPPORT_REPLY: _text(
        "Отговор на вашата заявка: проект {reference}",
        "Екипът отговори на ваша заявка в проект {reference} ({title}):",
        "A reply to your request: project {reference}",
        "The team replied to your request in project {reference} ({title}):",
    ),
}
