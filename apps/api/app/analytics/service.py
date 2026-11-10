"""Collecting and reporting anonymous site statistics.

What is kept: the page path (no query string), the language, the kind of device, the host of the referring
site, and for clicks the visible name of the link or button and where it leads. What is never kept: the IP
address, the user agent, cookies, anything typed into a field, the path of a referrer, an e-mail address or a
telephone number. Events of one visit share a hash that is computed from the address, the browser and the
date with the server's secret and changes every day, so it can group a visit but cannot follow a person.
"""

from __future__ import annotations

import hashlib
import hmac
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from sqlalchemy import delete, distinct, func, select
from sqlalchemy.orm import Session

from app.analytics.models import AnalyticsEvent
from app.analytics.schemas import (
    ClickRow,
    CountRow,
    DayPoint,
    EventIn,
    PageRow,
    Summary,
    VisitEvent,
    VisitOut,
    VisitsOut,
)
from app.models import utcnow

SOFIA = ZoneInfo("Europe/Sofia")

PATH_RE = re.compile(r"^/(?:bg|en)(?:/[A-Za-z0-9._~%\-]{1,120}){0,6}$")
HOST_RE = re.compile(r"^[a-z0-9](?:[a-z0-9.\-]{0,118}[a-z0-9])?$")
BOT_RE = re.compile(
    r"bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|monitor|uptime|curl|wget|python-requests|"
    r"httpx|axios|go-http|java/|libwww|scrapy|facebookexternalhit|embedly|whatsapp|telegram|preview",
    re.IGNORECASE,
)
DIGITS_RE = re.compile(r"\d")
SPECIAL_TARGETS = frozenset({"mailto", "tel"})
PRIVATE_PREFIXES = ("/bg/konto", "/en/account")


def is_bot(user_agent: str | None) -> bool:
    return not user_agent or bool(BOT_RE.search(user_agent))


def device_class(user_agent: str) -> str:
    ua = user_agent.lower()
    if "ipad" in ua or "tablet" in ua or ("android" in ua and "mobile" not in ua):
        return "tablet"
    if "mobi" in ua or "iphone" in ua or "android" in ua:
        return "mobile"
    return "desktop"


def visit_key(secret_key: str, day: date, ip: str | None, user_agent: str) -> str:
    """Groups the events of one visit; the date is part of the key, so it cannot link two days."""
    message = f"visit:{day.isoformat()}|{ip or ''}|{user_agent[:200]}"
    return hmac.new(secret_key.encode(), message.encode(), hashlib.sha256).hexdigest()[:20]


def clean_path(value: str | None) -> str | None:
    if not value:
        return None
    path = value.split("?", 1)[0].split("#", 1)[0]
    if len(path) > 1:
        path = path.rstrip("/")
    if len(path) > 200 or not PATH_RE.match(path) or any(set(part) == {"."} for part in path.split("/")[1:]):
        return None
    # The customer area is private: it is never counted.
    return None if path.startswith(PRIVATE_PREFIXES) else path


def clean_target(value: str | None) -> str | None:
    """A path on this site, or only the host of an outside link; `mailto` and `tel` carry no address."""
    if not value:
        return None
    if value in SPECIAL_TARGETS:
        return value
    if value.startswith("/"):
        return clean_path(value)
    if "://" in value:  # an outside link: keep the host only
        value = urlparse(value).hostname or ""
    host = value.lower().removeprefix("www.")
    return host if "." in host and HOST_RE.match(host) else None


def clean_label(value: str | None) -> str | None:
    """The visible name of a link or button. Anything that looks like contact data is dropped."""
    if not value:
        return None
    label = " ".join(value.split())[:80]
    if not label or "@" in label or len(DIGITS_RE.findall(label)) >= 6:
        return None
    return label


def referrer_host(value: str | None, own_host: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    host = parsed.hostname.lower().removeprefix("www.")
    if not HOST_RE.match(host) or host == (own_host or "").removeprefix("www."):
        return None
    return host


@dataclass(frozen=True)
class Visitor:
    ip: str | None
    user_agent: str


def record(db: Session, *, secret_key: str, own_host: str | None, visitor: Visitor, events: list[EventIn]) -> int:
    """Stores the valid events of one visitor; invalid ones are skipped. Returns how many were stored."""
    now = utcnow()
    visit = visit_key(secret_key, now.astimezone(SOFIA).date(), visitor.ip, visitor.user_agent)
    device = device_class(visitor.user_agent)
    stored = 0
    for position, event in enumerate(events):
        path = clean_path(event.path)
        if path is None:
            continue
        label = clean_label(event.label)
        target = clean_target(event.target) if event.type == "click" else None
        if event.type == "click" and target is None and label is None:
            continue
        if event.type == "tool" and label is None:
            continue
        db.add(
            AnalyticsEvent(
                created_at=now + timedelta(microseconds=position),  # keeps the order of one batch
                kind=event.type,
                path=path,
                locale=event.locale,
                visit=visit,
                device=device,
                referrer_host=referrer_host(event.referrer, own_host) if event.type == "view" else None,
                label=(label or target) if event.type == "click" else label,
                target=target,
            )
        )
        stored += 1
    return stored


# ------------------------------------------------------------------------------------------- reports


def _day_expression():
    return func.date(func.timezone("Europe/Sofia", AnalyticsEvent.created_at))


def summary(db: Session, *, days: int, enabled: bool, retention_days: int) -> Summary:
    today = utcnow().astimezone(SOFIA).date()
    start = today - timedelta(days=days - 1)
    since = datetime.combine(start - timedelta(days=1), time.min, tzinfo=SOFIA)  # lets the index prune
    day = _day_expression()
    in_range = (AnalyticsEvent.created_at >= since, day >= start)
    view = AnalyticsEvent.kind == "view"

    per_day = {
        row.day: row
        for row in db.execute(
            select(
                day.label("day"),
                func.count().filter(view).label("views"),
                func.count(distinct(AnalyticsEvent.visit)).filter(view).label("visits"),
            )
            .where(*in_range)
            .group_by(day)
        )
    }
    daily = []
    for offset in range(days):
        current = start + timedelta(days=offset)
        row = per_day.get(current)
        daily.append(DayPoint(date=current, views=row.views if row else 0, visits=row.visits if row else 0))

    def count_kind(kind: str) -> int:
        return db.scalar(select(func.count()).where(*in_range, AnalyticsEvent.kind == kind)) or 0

    def counts(column, *extra, limit: int = 10) -> list[CountRow]:
        rows = db.execute(
            select(column, func.count().label("n"))
            .where(*in_range, *extra)
            .group_by(column)
            .order_by(func.count().desc(), column)
            .limit(limit)
        )
        return [CountRow(name=str(name), count=n) for name, n in rows]

    pages = db.execute(
        select(
            AnalyticsEvent.path,
            func.count().label("views"),
            func.count(distinct(AnalyticsEvent.visit)).label("visits"),
        )
        .where(*in_range, view)
        .group_by(AnalyticsEvent.path)
        .order_by(func.count().desc(), AnalyticsEvent.path)
        .limit(15)
    )
    clicks = db.execute(
        select(AnalyticsEvent.path, AnalyticsEvent.label, AnalyticsEvent.target, func.count().label("n"))
        .where(*in_range, AnalyticsEvent.kind == "click")
        .group_by(AnalyticsEvent.path, AnalyticsEvent.label, AnalyticsEvent.target)
        .order_by(func.count().desc(), AnalyticsEvent.path, AnalyticsEvent.label)
        .limit(25)
    )
    return Summary(
        enabled=enabled,
        retention_days=retention_days,
        days=days,
        first_event_at=db.scalar(select(func.min(AnalyticsEvent.created_at))),
        views=sum(point.views for point in daily),
        visits=sum(point.visits for point in daily),
        clicks=count_kind("click"),
        tool_events=count_kind("tool"),
        daily=daily,
        top_pages=[PageRow(path=p, views=v, visits=n) for p, v, n in pages],
        top_clicks=[ClickRow(page=p, label=label or "", target=t, clicks=n) for p, label, t, n in clicks],
        referrers=counts(AnalyticsEvent.referrer_host, view, AnalyticsEvent.referrer_host.is_not(None)),
        devices=counts(AnalyticsEvent.device, view),
        locales=counts(AnalyticsEvent.locale, view),
        tools=counts(AnalyticsEvent.label, AnalyticsEvent.kind == "tool", limit=15),
    )


def recent_visits(db: Session, *, limit: int = 20, per_visit: int = 40) -> VisitsOut:
    """The latest visits of today, each as the pages and clicks of one anonymous visitor in order."""
    today = utcnow().astimezone(SOFIA).date()
    day = _day_expression()
    since = datetime.combine(today - timedelta(days=1), time.min, tzinfo=SOFIA)
    latest = db.execute(
        select(AnalyticsEvent.visit, func.max(AnalyticsEvent.created_at).label("last"))
        .where(AnalyticsEvent.created_at >= since, day == today)
        .group_by(AnalyticsEvent.visit)
        .order_by(func.max(AnalyticsEvent.created_at).desc())
        .limit(limit)
    ).all()
    visits: list[VisitOut] = []
    for visit, _last in latest:
        rows = db.scalars(
            select(AnalyticsEvent)
            .where(AnalyticsEvent.visit == visit, AnalyticsEvent.created_at >= since, day == today)
            .order_by(AnalyticsEvent.created_at, AnalyticsEvent.id)
            .limit(per_visit)
        ).all()
        if not rows:
            continue
        first_view = next((row for row in rows if row.kind == "view"), rows[0])
        visits.append(
            VisitOut(
                id=visit[:6],
                started_at=rows[0].created_at,
                device=rows[0].device,
                locale=first_view.locale,
                referrer_host=first_view.referrer_host,
                events=[
                    VisitEvent(at=row.created_at, kind=row.kind, path=row.path, label=row.label, target=row.target)
                    for row in rows
                ],
            )
        )
    return VisitsOut(day=today, visits=visits)


def count_expired(db: Session, retention_days: int) -> int:
    cutoff = utcnow() - timedelta(days=retention_days)
    return db.scalar(select(func.count()).where(AnalyticsEvent.created_at < cutoff)) or 0


def purge_expired(db: Session, retention_days: int, *, dry_run: bool = False) -> int:
    if dry_run:
        return count_expired(db, retention_days)
    cutoff = utcnow() - timedelta(days=retention_days)
    return db.execute(delete(AnalyticsEvent).where(AnalyticsEvent.created_at < cutoff)).rowcount
