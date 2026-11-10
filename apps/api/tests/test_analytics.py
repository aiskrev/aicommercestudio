"""Site statistics: what is collected, what is refused, and what the administrator sees."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select

from app.analytics import service
from app.analytics.models import AnalyticsEvent
from app.config import get_settings
from app.models import utcnow

DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
URL = "/api/public/analytics"


@pytest.fixture
def on(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "analytics_enabled", True)
    monkeypatch.setattr(settings, "site_url", "https://ai-commercestudio.com")


@pytest.fixture
def visitor() -> Iterator[TestClient]:
    """A browser with no cookies, unlike `client` once an administrator has signed in."""
    from app.main import app

    with TestClient(app) as browser:
        yield browser


def send(browser: TestClient, *events: dict, ua: str = DESKTOP, ip: str = "203.0.113.7", **headers: str):
    return browser.post(
        URL,
        json={"events": list(events)},
        headers={"User-Agent": ua, "X-Forwarded-For": ip, **headers},
    )


def view(path: str = "/bg", **extra) -> dict:
    return {"type": "view", "path": path, "locale": "en" if path.startswith("/en") else "bg", **extra}


def rows(db) -> list[AnalyticsEvent]:
    db.expire_all()
    return list(db.scalars(select(AnalyticsEvent).order_by(AnalyticsEvent.created_at, AnalyticsEvent.id)))


@pytest.fixture(autouse=True)
def empty(db) -> None:
    db.execute(delete(AnalyticsEvent))
    db.commit()


# ------------------------------------------------------------------------------------------- collecting


def test_nothing_is_stored_while_statistics_are_off(visitor, db):
    assert get_settings().analytics_enabled is False
    response = send(visitor, view())
    assert response.status_code == 200
    assert response.json() == {"enabled": False}
    assert rows(db) == []


def test_a_view_keeps_only_the_path_the_language_the_device_and_the_referrer_host(on, visitor, db):
    response = send(
        visitor,
        view(
            "/bg/uslugi/seo-optimizatsiya/?utm_source=x&email=a@b.bg#top",
            referrer="https://www.google.com/search?q=secret+query",
        ),
        ua=PHONE,
    )
    assert response.json() == {"enabled": True}
    [row] = rows(db)
    assert (row.kind, row.path, row.locale, row.device) == ("view", "/bg/uslugi/seo-optimizatsiya", "bg", "mobile")
    assert row.referrer_host == "google.com"
    stored = " ".join(str(getattr(row, column.name)) for column in AnalyticsEvent.__table__.columns)
    for secret in ("203.0.113.7", "iPhone", "Mozilla", "utm_source", "secret", "a@b.bg"):
        assert secret not in stored
    assert "203.0.113.7" not in row.visit and len(row.visit) == 20


def test_a_referrer_from_this_site_is_not_a_referrer(on, visitor, db):
    send(visitor, view(referrer="https://ai-commercestudio.com/bg/uslugi"))
    assert rows(db)[0].referrer_host is None


def test_clicks_keep_the_name_and_the_destination_but_never_an_address_or_a_number(on, visitor, db):
    send(
        visitor,
        {
            "type": "click",
            "path": "/bg",
            "locale": "bg",
            "label": "Заявете консултация",
            "target": "/bg/kontakti?tip=oferta",
        },
        {
            "type": "click",
            "path": "/bg",
            "locale": "bg",
            "label": "Блог",
            "target": "https://www.Example.com/private/path?x=1",
        },
        {"type": "click", "path": "/bg", "locale": "bg", "label": "contact@example.com", "target": "mailto"},
        {"type": "click", "path": "/bg", "locale": "bg", "label": "+359 882 377 753", "target": "tel"},
    )
    clicks = rows(db)
    assert [(c.label, c.target) for c in clicks] == [
        ("Заявете консултация", "/bg/kontakti"),
        ("Блог", "example.com"),
        ("mailto", "mailto"),
        ("tel", "tel"),
    ]


def test_tool_events_are_stored_with_their_name(on, visitor, db):
    send(
        visitor, {"type": "tool", "path": "/bg/ai-automation-advisor", "locale": "bg", "label": "advisor:tool_started"}
    )
    [row] = rows(db)
    assert (row.kind, row.label, row.target) == ("tool", "advisor:tool_started", None)


@pytest.mark.parametrize(
    "path",
    [
        "/admin",
        "/bg/konto/vhod",
        "/en/account/plan",
        "/bg/uslugi/../x",
        "/bg/./x",
        "https://evil.example/bg",
        "bg",
        "/fr/x",
        "/bg/" + "a" * 130,
        "/bg/a b",
        "/bg/a/b/c/d/e/f/g",
    ],
)
def test_paths_that_are_not_pages_of_this_site_are_dropped(on, visitor, db, path):
    assert send(visitor, view(path)).status_code == 200
    assert rows(db) == []


def test_more_than_twenty_events_are_refused(on, visitor, db):
    assert send(visitor, *[view()] * 21).status_code == 422
    assert rows(db) == []


@pytest.mark.parametrize(
    "headers,ua",
    [
        ({"DNT": "1"}, DESKTOP),
        ({"Sec-GPC": "1"}, DESKTOP),
        ({}, "Googlebot/2.1 (+http://www.google.com/bot.html)"),
        ({}, "Lighthouse"),
        ({}, "curl/8.0"),
        ({}, ""),
    ],
)
def test_do_not_track_robots_and_empty_agents_are_not_counted(on, visitor, db, headers, ua):
    response = send(visitor, view(), ua=ua, **headers)
    assert response.json() == {"enabled": True}
    assert rows(db) == []


def test_signed_in_staff_are_not_counted(on, admin_client, db):
    assert send(admin_client, view()).json() == {"enabled": True}
    assert rows(db) == []


def test_one_visit_shares_a_key_and_two_visitors_do_not(on, visitor, db):
    send(visitor, view("/bg"), view("/bg/uslugi"))
    send(visitor, view("/bg/paketi"), ip="198.51.100.9", ua=PHONE)
    first, second, third = rows(db)
    assert first.visit == second.visit != third.visit


def test_the_visit_key_changes_every_day_and_with_the_secret():
    one = service.visit_key("secret", date(2026, 11, 10), "203.0.113.7", DESKTOP)
    assert one == service.visit_key("secret", date(2026, 11, 10), "203.0.113.7", DESKTOP)
    assert one != service.visit_key("secret", date(2026, 11, 11), "203.0.113.7", DESKTOP)
    assert one != service.visit_key("other", date(2026, 11, 10), "203.0.113.7", DESKTOP)


def test_a_flood_from_one_address_is_limited(on, visitor, db, monkeypatch):
    monkeypatch.setattr(get_settings(), "analytics_rate_limit", 2)
    codes = [send(visitor, view(), ip="192.0.2.50").status_code for _ in range(3)]
    assert codes == [200, 200, 429]


# ------------------------------------------------------------------------------------------- reports


def test_reports_need_an_administrator(visitor):
    assert visitor.get("/api/admin/analytics/summary").status_code == 401
    assert visitor.get("/api/admin/analytics/visits").status_code == 401


def test_the_summary_counts_views_visits_clicks_pages_referrers_and_devices(on, visitor, admin_client, db):
    send(visitor, view("/bg", referrer="https://www.google.com/"), view("/bg/uslugi/seo-optimizatsiya"))
    send(
        visitor,
        {
            "type": "click",
            "path": "/bg/uslugi/seo-optimizatsiya",
            "locale": "bg",
            "label": "Поискайте оферта",
            "target": "/bg/kontakti",
        },
        ip="198.51.100.9",
        ua=PHONE,
    )
    send(visitor, view("/en", referrer="https://www.google.com/"), view("/en"), ip="198.51.100.9", ua=PHONE)

    summary = admin_client.get("/api/admin/analytics/summary", params={"days": 7}).json()
    assert summary["enabled"] is True and summary["days"] == 7 and summary["retention_days"] == 180
    assert (summary["views"], summary["visits"], summary["clicks"]) == (4, 2, 1)
    assert len(summary["daily"]) == 7
    assert summary["daily"][-1] == {"date": summary["daily"][-1]["date"], "views": 4, "visits": 2}
    assert summary["top_pages"][0] == {"path": "/en", "views": 2, "visits": 1}
    assert {"path": "/bg", "views": 1, "visits": 1} in summary["top_pages"]
    assert summary["top_clicks"] == [
        {"page": "/bg/uslugi/seo-optimizatsiya", "label": "Поискайте оферта", "target": "/bg/kontakti", "clicks": 1}
    ]
    assert summary["referrers"] == [{"name": "google.com", "count": 2}]
    assert {item["name"]: item["count"] for item in summary["devices"]} == {"desktop": 2, "mobile": 2}
    assert {item["name"]: item["count"] for item in summary["locales"]} == {"bg": 2, "en": 2}
    assert summary["first_event_at"] is not None


def test_the_summary_works_with_no_data_and_checks_the_range(admin_client):
    empty_summary = admin_client.get("/api/admin/analytics/summary").json()
    assert empty_summary["views"] == 0 and empty_summary["top_pages"] == [] and len(empty_summary["daily"]) == 30
    assert empty_summary["first_event_at"] is None
    assert admin_client.get("/api/admin/analytics/summary", params={"days": 0}).status_code == 422
    assert admin_client.get("/api/admin/analytics/summary", params={"days": 181}).status_code == 422
    assert admin_client.get("/api/admin/analytics/summary").headers["Cache-Control"] == "no-store"


def test_events_outside_the_range_are_not_counted(on, visitor, admin_client, db):
    send(visitor, view("/bg"))
    old = db.scalars(select(AnalyticsEvent)).one()
    db.add(
        AnalyticsEvent(
            created_at=utcnow() - timedelta(days=20),
            kind="view",
            path="/bg/old",
            locale="bg",
            visit="x" * 20,
            device="desktop",
        )
    )
    db.commit()
    week = admin_client.get("/api/admin/analytics/summary", params={"days": 7}).json()
    month = admin_client.get("/api/admin/analytics/summary", params={"days": 30}).json()
    assert (week["views"], month["views"]) == (1, 2)
    assert old.path == "/bg"


def test_the_visits_list_shows_one_anonymous_path_per_visitor(on, visitor, admin_client):
    send(
        visitor,
        view("/bg", referrer="https://duckduckgo.com/"),
        {"type": "click", "path": "/bg", "locale": "bg", "label": "Услуги", "target": "/bg/uslugi"},
        view("/bg/uslugi"),
    )
    send(visitor, view("/en"), ip="198.51.100.9", ua=PHONE)

    data = admin_client.get("/api/admin/analytics/visits").json()
    assert date.fromisoformat(data["day"]) == utcnow().astimezone(service.SOFIA).date()
    first = next(item for item in data["visits"] if item["device"] == "desktop")
    assert [(e["kind"], e["path"], e["label"], e["target"]) for e in first["events"]] == [
        ("view", "/bg", None, None),
        ("click", "/bg", "Услуги", "/bg/uslugi"),
        ("view", "/bg/uslugi", None, None),
    ]
    assert first["referrer_host"] == "duckduckgo.com" and len(first["id"]) == 6
    assert "203.0.113.7" not in str(data)


# ------------------------------------------------------------------------------------------- retention


def test_old_events_are_deleted_by_the_retention_job(db):
    db.add_all(
        [
            AnalyticsEvent(
                created_at=utcnow() - timedelta(days=400),
                kind="view",
                path="/bg",
                locale="bg",
                visit="a" * 20,
                device="desktop",
            ),
            AnalyticsEvent(
                created_at=utcnow() - timedelta(days=1),
                kind="view",
                path="/bg",
                locale="bg",
                visit="b" * 20,
                device="desktop",
            ),
        ]
    )
    db.commit()
    assert service.purge_expired(db, 180, dry_run=True) == 1
    assert db.scalar(select(func.count()).select_from(AnalyticsEvent)) == 2
    assert service.purge_expired(db, 180) == 1
    db.commit()
    assert db.scalar(select(func.count()).select_from(AnalyticsEvent)) == 1


def test_the_api_role_cannot_change_a_stored_event(on, visitor, db):
    from sqlalchemy import text

    from app.db import get_sessionmaker

    send(visitor, view())
    with get_sessionmaker()() as api_session:
        assert api_session.scalar(text("SELECT count(*) FROM analytics_events")) == 1
        with pytest.raises(Exception, match="permission denied"):
            api_session.execute(text("UPDATE analytics_events SET path = '/bg/x'"))
