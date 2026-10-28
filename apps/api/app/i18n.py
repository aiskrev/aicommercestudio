"""Bilingual (bg/en) API messages.

The website sends `Accept-Language: bg|en`; anything else falls back to Bulgarian. Error codes stay
stable (clients branch on `code`); only the human-readable `detail` and field messages are
localized. Validators raise `PydanticCustomError(<type>, <bg message>)` with a type listed in
`VALIDATION_MESSAGES`, so field errors can be rendered in either language.
"""

from __future__ import annotations

from typing import Literal

from starlette.requests import Request

Locale = Literal["bg", "en"]
SUPPORTED: tuple[Locale, ...] = ("bg", "en")
DEFAULT_LOCALE: Locale = "bg"


def parse_locale(value: str | None) -> Locale:
    """First language tag of an Accept-Language value, restricted to the allowlist."""
    if not value:
        return DEFAULT_LOCALE
    tag = value.split(",")[0].split(";")[0].strip().lower()[:2]
    return "en" if tag == "en" else DEFAULT_LOCALE


def request_locale(request: Request) -> Locale:
    return parse_locale(request.headers.get("accept-language"))


ERROR_MESSAGES: dict[str, dict[Locale, str]] = {
    "validation_error": {"bg": "Моля, коригирайте маркираните полета.", "en": "Please correct the highlighted fields."},
    "rate_limited": {
        "bg": "Твърде много заявки. Моля, опитайте отново по-късно.",
        "en": "Too many requests. Please try again later.",
    },
    "form_token_invalid": {
        "bg": "Формулярът е изпратен твърде бързо или е изтекъл. Моля, опитайте отново след няколко секунди.",
        "en": "The form was sent too quickly or has expired. Please try again in a few seconds.",
    },
    "spam_suspected": {
        "bg": "Съобщението съдържа твърде много връзки. Моля, опишете проекта си с думи.",
        "en": "The message contains too many links. Please describe your project in words.",
    },
    "origin_rejected": {
        "bg": "Заявката е отхвърлена (невалиден произход).",
        "en": "The request was rejected (invalid origin).",
    },
    "payload_too_large": {"bg": "Заявката е твърде голяма.", "en": "The request is too large."},
    "estimate_unavailable": {
        "bg": "Разходите временно не могат да бъдат изчислени. Моля, опитайте отново по-късно.",
        "en": "Costs cannot be calculated right now. Please try again later.",
    },
    "team_configuration_not_found": {
        "bg": "Запазената конфигурация не е намерена или е изтекла.",
        "en": "The saved configuration was not found or has expired.",
    },
    "report_unavailable": {
        "bg": "Отчетът временно не може да бъде създаден. Моля, опитайте отново по-късно.",
        "en": "The report cannot be created right now. Please try again later.",
    },
    "not_found": {"bg": "Ресурсът не е намерен.", "en": "The resource was not found."},
    "method_not_allowed": {"bg": "Методът не е позволен.", "en": "Method not allowed."},
    "internal_error": {
        "bg": "Възникна вътрешна грешка. Моля, опитайте отново.",
        "en": "An internal error occurred. Please try again.",
    },
    "unauthorized": {"bg": "Необходим е вход в системата.", "en": "Please log in."},
    "session_expired": {
        "bg": "Сесията изтече поради неактивност. Моля, влезте отново.",
        "en": "Your session expired due to inactivity. Please log in again.",
    },
    "invalid_credentials": {"bg": "Невалиден имейл или парола.", "en": "Invalid email or password."},
    "csrf_failed": {
        "bg": "Невалиден CSRF токен. Презаредете страницата.",
        "en": "Invalid CSRF token. Please reload the page.",
    },
    "lead_not_found": {"bg": "Запитването не е намерено.", "en": "Inquiry not found."},
    "domain_not_found": {"bg": "Направлението не е намерено.", "en": "Service domain not found."},
    "service_not_found": {"bg": "Услугата не е намерена.", "en": "Service not found."},
    "catalogue_entity_not_found": {"bg": "Записът не е намерен.", "en": "Catalogue entry not found."},
    "invalid_filter": {"bg": "Невалиден филтър.", "en": "Invalid filter."},
    "forbidden_role": {
        "bg": "Ролята ви не позволява това действие.",
        "en": "Your role does not allow this action.",
    },
    "precondition_required": {
        "bg": "Липсва версия на записа (If-Match). Презаредете страницата.",
        "en": "The entry version (If-Match) is missing. Please reload the page.",
    },
    "revision_conflict": {
        "bg": "Записът е променен от друг потребител. Презаредете страницата и повторете промените.",
        "en": "The entry was changed by someone else. Reload the page and apply your changes again.",
    },
    "catalogue_incomplete": {
        "bg": "Записът не може да бъде публикуван, докато не попълните маркираните полета.",
        "en": "The entry cannot be published until the highlighted fields are complete.",
    },
    "key_taken": {"bg": "Този ключ вече се използва.", "en": "This key is already in use."},
    "slug_taken": {"bg": "Този адрес вече се използва.", "en": "This URL slug is already in use."},
    "invalid_transition": {
        "bg": "Това действие не е възможно в текущото състояние на записа.",
        "en": "This action is not possible in the entry's current state.",
    },
    "entity_referenced": {
        "bg": "Записът се използва от други записи. Премахнете връзките или го архивирайте.",
        "en": "Other entries link to this entry. Remove those links or archive it instead.",
    },
    "staff_not_found": {"bg": "Служителят не е намерен.", "en": "Staff member not found."},
    "own_role": {"bg": "Не можете да промените собствената си роля.", "en": "You cannot change your own role."},
    "last_admin": {
        "bg": "Трябва да остане поне един активен администратор.",
        "en": "At least one active administrator must remain.",
    },
    "domain_archive_not_allowed": {
        "bg": "Направленията са фиксирани от таксономията и не се архивират.",
        "en": "Service domains are fixed by the taxonomy and cannot be archived.",
    },
    "action_not_found": {"bg": "Действието не е намерено.", "en": "Action not found."},
    "ops_not_found": {"bg": "Не е намерено.", "en": "Not found."},
    "ops_forbidden": {"bg": "Нямате права за това действие.", "en": "You do not have permission for this action."},
    "ops_suspended": {"bg": "Организацията е спряна.", "en": "The organisation is suspended."},
    "ops_conflict": {"bg": "Вече съществува такъв запис.", "en": "Such a record already exists."},
    "ops_last_owner": {
        "bg": "Организацията трябва да има поне един собственик.",
        "en": "The organisation must keep at least one owner.",
    },
    "ops_user_unknown": {
        "bg": "Няма активен потребител с този имейл.",
        "en": "There is no active user with this e-mail.",
    },
    "status_conflict": {
        "bg": "Запитването е променено от друг администратор. Презаредете страницата и опитайте отново.",
        "en": "The inquiry was changed by another administrator. Please reload the page and try again.",
    },
    "already_decided": {"bg": "Действието вече е решено.", "en": "This action has already been decided."},
    "approval_required": {"bg": "Действието изисква одобрение.", "en": "This action requires approval."},
    "ai_unavailable": {
        "bg": "AI услугата не е достъпна в момента.",
        "en": "The AI service is currently unavailable.",
    },
    "advisor_timeout": {
        "bg": "Анализът отне твърде дълго и беше прекъснат. Моля, опитайте отново след малко.",
        "en": "The analysis took too long and was stopped. Please try again in a moment.",
    },
    "advisor_busy": {
        "bg": "Услугата е натоварена в момента. Моля, опитайте отново след няколко минути.",
        "en": "The service is busy right now. Please try again in a few minutes.",
    },
    "advisor_invalid_output": {
        "bg": "Не успяхме да съставим валидна оценка. Моля, опитайте отново или опишете процеса по-конкретно.",
        "en": "We could not produce a valid assessment. Please try again or describe the process more specifically.",
    },
    "advisor_declined": {
        "bg": "Не можем да оценим този текст. Моля, опишете конкретен бизнес процес, който искате да автоматизирате.",
        "en": "We cannot assess this text. Please describe a specific business process you want to automate.",
    },
    "advisor_unavailable": {
        "bg": "Услугата за анализ временно не е достъпна. Моля, опитайте отново по-късно.",
        "en": "The analysis service is temporarily unavailable. Please try again later.",
    },
}

VALIDATION_MESSAGES: dict[str, dict[Locale, str]] = {
    "missing": {"bg": "Полето е задължително.", "en": "This field is required."},
    "enum": {"bg": "Изберете валидна стойност.", "en": "Select a valid value."},
    "literal_error": {"bg": "Изберете валидна стойност.", "en": "Select a valid value."},
    "extra_forbidden": {"bg": "Непознато поле.", "en": "Unknown field."},
    "json_invalid": {"bg": "Невалиден формат на заявката.", "en": "Invalid request format."},
    "uuid_parsing": {"bg": "Невалиден идентификатор.", "en": "Invalid identifier."},
    "bool_parsing": {"bg": "Невалидна стойност.", "en": "Invalid value."},
    "bool_type": {"bg": "Невалидна стойност.", "en": "Invalid value."},
    "string_type": {"bg": "Очаква се текст.", "en": "Text expected."},
    "list_type": {"bg": "Очаква се списък.", "en": "A list is expected."},
    "dict_type": {"bg": "Невалидна стойност.", "en": "Invalid value."},
    "model_type": {"bg": "Невалидна стойност.", "en": "Invalid value."},
    "datetime_from_date_parsing": {"bg": "Невалидна дата.", "en": "Invalid date."},
    "datetime_parsing": {"bg": "Невалидна дата.", "en": "Invalid date."},
    "string_too_short": {"bg": "Въведете поне {min_length} символа.", "en": "Enter at least {min_length} characters."},
    "string_too_long": {
        "bg": "Допустими са най-много {max_length} символа.",
        "en": "No more than {max_length} characters are allowed.",
    },
    "too_short": {"bg": "Изберете поне една възможност.", "en": "Select at least one option."},
    "too_long": {"bg": "Избрани са твърде много стойности.", "en": "Too many values selected."},
    "email": {"bg": "Въведете валиден имейл адрес.", "en": "Enter a valid email address."},
    "value_error": {"bg": "Невалидна стойност.", "en": "Invalid value."},
    # custom validator types
    "control_chars": {"bg": "Текстът съдържа непозволени символи.", "en": "The text contains invalid characters."},
    "markup": {
        "bg": "Използвайте само обикновен текст, без HTML или Markdown.",
        "en": "Use plain text only, without HTML or Markdown.",
    },
    "catalogue_slug": {
        "bg": "Използвайте малки латински букви, цифри и единични тирета.",
        "en": "Use lowercase Latin letters, digits and single hyphens.",
    },
    "catalogue_key": {
        "bg": "Използвайте малки латински букви, цифри и долна черта; започнете с буква.",
        "en": "Use lowercase Latin letters, digits and underscores; start with a letter.",
    },
    "required_to_publish": {
        "bg": "Полето е задължително за публикуване.",
        "en": "This field is required for publishing.",
    },
    "seo_title_length": {
        "bg": "SEO заглавието трябва да е до {max} символа.",
        "en": "The SEO title must be at most {max} characters.",
    },
    "seo_description_length": {
        "bg": "SEO описанието трябва да е между {min} и {max} символа.",
        "en": "The SEO description must be between {min} and {max} characters.",
    },
    "slug_taken": {"bg": "Този адрес вече се използва.", "en": "This URL slug is already in use."},
    "unknown_reference": {"bg": "Непознат запис.", "en": "Unknown entry."},
    "archived_reference": {
        "bg": "Свързаният запис е архивиран.",
        "en": "The linked entry is archived.",
    },
    "duplicate_key": {"bg": "Ключът се повтаря.", "en": "This key is used twice."},
    "lead_category_taken": {
        "bg": "Тази категория вече се използва от друга услуга.",
        "en": "This category is already used by another service.",
    },
    "items_not_allowed": {
        "bg": "Направленията нямат списък с възможности.",
        "en": "Service domains have no capability list.",
    },
    "self_reference": {"bg": "Записът не може да сочи към себе си.", "en": "An entry cannot link to itself."},
    "duration": {
        "bg": "Продължителността е от 0,5 до 99 дни, а максимумът не е по-малък от минимума.",
        "en": "The duration is 0.5 to 99 days, and the maximum is not below the minimum.",
    },
    "duration_offering": {
        "bg": "Продължителност се задава само за оценки и работни срещи.",
        "en": "A duration applies only to assessments and workshops.",
    },
    "primary_domain_required": {
        "bg": "Услугата трябва да има основно направление.",
        "en": "A service needs a primary domain.",
    },
    "no_links": {"bg": "Полето не може да съдържа връзки или HTML.", "en": "This field cannot contain links or HTML."},
    "phone": {"bg": "Невалиден телефонен номер.", "en": "Invalid phone number."},
    "privacy_required": {
        "bg": "Необходимо е да потвърдите, че сте запознати с информацията за поверителност.",
        "en": "Please confirm that you have read the privacy information.",
    },
    "website_url": {
        "bg": "Въведете валиден адрес на сайт, например https://example.bg.",
        "en": "Enter a valid website address, for example https://example.com.",
    },
    "secrets": {
        "bg": (
            "Текстът прилича на парола, API ключ или токен. Моля, премахнете го — такива данни не се "
            "изпращат през формата."
        ),
        "en": (
            "This looks like a password, API key or token. Please remove it — such data must not be sent "
            "through the form."
        ),
    },
    "ai_details_service": {
        "bg": "Информацията за AI система се приема само за услугата AI Managed Services.",
        "en": "AI system details are only accepted for the AI Managed Services service.",
    },
    "ops_slug": {
        "bg": "Използвайте малки латински букви, цифри и тирета.",
        "en": "Use lowercase Latin letters, digits and hyphens.",
    },
    "ops_label": {
        "bg": "Използвайте латински букви, цифри и . _ : / -",
        "en": "Use Latin letters, digits and . _ : / -",
    },
    "nothing_to_change": {
        "bg": "Посочете статус или услуга за промяна.",
        "en": "Specify a status or service to change.",
    },
    "team_model": {
        "bg": "Конфигурацията е направена с по-стара версия. Моля, презаредете страницата.",
        "en": "The configuration was made with an older version. Please reload the page.",
    },
    "team_selection": {
        "bg": "Екипът трябва да има поне един агент със задачи (координаторът — поне два).",
        "en": "The team needs at least one task agent (two for a coordinator).",
    },
    "team_duplicates": {
        "bg": "Стойностите не трябва да се повтарят.",
        "en": "Values must not repeat.",
    },
    "readiness_model": {
        "bg": "Оценката е направена с по-стара версия. Моля, презаредете страницата.",
        "en": "The assessment was made with an older version. Please reload the page.",
    },
    "readiness_answers": {
        "bg": "Отговорите на оценката са непълни или невалидни.",
        "en": "The assessment answers are incomplete or invalid.",
    },
    "too_many_links": {
        "bg": "Описанието съдържа твърде много връзки. Опишете процеса с думи.",
        "en": "The description contains too many links. Please describe the process in words.",
    },
}


def error_message(code: str | None, locale: Locale, fallback: str) -> str:
    entry = ERROR_MESSAGES.get(code or "")
    return entry[locale] if entry else fallback


def validation_message(error_type: str, locale: Locale, ctx: dict | None = None) -> str | None:
    entry = VALIDATION_MESSAGES.get(error_type)
    if not entry:
        return None
    try:
        return entry[locale].format(**(ctx or {}))
    except (KeyError, IndexError):
        return entry[locale]
