"""Customer accounts, phase 08: systematic checks of the whole account surface and the ownership link to quote requests.

The per-feature behaviour (tokens, recovery, sessions, enumeration, lockout) is in test_accounts.py. This file adds what
that file does not: every route that needs a customer session is checked for authentication and CSRF at once (so a new
route cannot be added without them), cookie attributes in production, status, erased accounts, the go-live
prerequisites one by one and the quote-request ownership rules.
"""

from __future__ import annotations

import re
from datetime import timedelta

import pytest
from fastapi.routing import APIRoute
from pydantic import ValidationError
from sqlalchemy import select

from app import release_gates
from app.accounts.models import CustomerAccount, CustomerSession
from app.config import Settings, get_settings
from app.models import Lead, utcnow
from app.quotations.models import Quotation
from app.routers.accounts import require_account
from tests.conftest import lead_payload
from tests.test_accounts import NORMAL, PASSWORD, Inbox, csrf, login, register, verified
from tests.test_security import _production


@pytest.fixture
def inbox(monkeypatch) -> Inbox:
    """Accounts on and a mailbox that records what would be sent (the same set-up as test_accounts.py)."""
    box = Inbox()
    settings = get_settings()
    monkeypatch.setattr(settings, "customer_accounts_enabled", True)
    # The workspace, zone and billing areas have their own flags; switched on so their routes are checked too.
    monkeypatch.setattr(settings, "advisor_workspace_enabled", True)
    monkeypatch.setattr(settings, "billing_provider", "stripe")
    monkeypatch.setattr(settings, "email_provider", "smtp")
    monkeypatch.setattr(settings, "smtp_host", "mail.test")
    monkeypatch.setattr(settings, "smtp_from", "no-reply@example.com")
    monkeypatch.setattr(settings, "site_url", "https://trusted.example.com")
    monkeypatch.setattr("app.accounts.mail.get_sender", lambda *_: box)
    return box


ACCOUNT_PREFIXES = ("/api/accounts", "/api/workspace", "/api/zone", "/api/billing")
UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


def _needs_session(route: APIRoute) -> bool:
    """Whether the route depends (at any depth) on the customer-session dependency."""
    stack = list(route.dependant.dependencies)
    while stack:
        dependency = stack.pop()
        if dependency.call is require_account:
            return True
        stack.extend(dependency.dependencies)
    return False


def _api_routes(routes, prefix: str = ""):
    """Every APIRoute with its full path. This FastAPI wraps included routers (`_IncludedRouter`), so walk them."""
    for route in routes:
        if isinstance(route, APIRoute):
            yield prefix + route.path, route
        elif hasattr(route, "original_router"):
            yield from _api_routes(route.original_router.routes, prefix + route.include_context.prefix)


def _session_routes() -> list[tuple[str, str]]:
    from app.main import app

    found: list[tuple[str, str]] = []
    for path, route in _api_routes(app.routes):
        if path.startswith(ACCOUNT_PREFIXES) and _needs_session(route):
            found.extend((method, path) for method in sorted(route.methods - {"HEAD", "OPTIONS"}))
    return sorted(found)


def _fill(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "00000000-0000-4000-8000-000000000000", path)


# --- Every route that needs a session ------------------------------------------------------------------


def test_the_session_routes_are_found():
    routes = _session_routes()
    assert len(routes) >= 25, routes  # guards the introspection itself
    paths = {path for _, path in routes}
    for expected in (
        "/api/accounts/me",
        "/api/accounts/sessions",
        "/api/accounts/data/export",
        "/api/accounts/quote-requests",
    ):
        assert expected in paths
    assert ("POST", "/api/accounts/logout") in routes and any(method in UNSAFE for method, _ in routes)


@pytest.mark.parametrize(("method", "path"), _session_routes())
def test_no_session_route_answers_without_a_sign_in(client, inbox, method, path):
    response = client.request(method, _fill(path), json={} if method in UNSAFE else None)
    assert response.status_code == 401, (method, path, response.status_code)
    assert response.json()["code"] == "unauthorized"


@pytest.mark.parametrize(("method", "path"), [item for item in _session_routes() if item[0] in UNSAFE])
def test_every_state_changing_session_route_needs_the_csrf_token(client, inbox, method, path):
    verified(client, inbox)
    # A valid session without the double-submit token never gets as far as the route.
    assert client.request(method, _fill(path), json={}).status_code == 403
    wrong = client.request(method, _fill(path), json={}, headers={"x-csrf-token": "wrong"})
    assert wrong.status_code == 403 and wrong.json()["code"] == "csrf_failed"


@pytest.mark.parametrize(("method", "path"), [item for item in _session_routes() if item[0] not in UNSAFE])
def test_a_staff_session_opens_no_customer_route(client, admin_client, inbox, method, path):
    # Staff cookies are a different principal: the customer routes still say "sign in".
    client.cookies.update(admin_client.cookies)
    assert client.request(method, _fill(path)).status_code == 401


# --- Cookies, production and the flag ------------------------------------------------------------------


def test_cookie_attributes_in_production(client, inbox, monkeypatch):
    monkeypatch.setattr(get_settings(), "cookie_secure", True)
    response = verified(client, inbox)
    cookies = {value.split("=", 1)[0]: value for value in response.headers.get_list("set-cookie")}
    session = cookies["acs_account_session"].lower()
    csrf_cookie = cookies["acs_account_csrf"].lower()
    for header in (session, csrf_cookie):
        assert "secure" in header and "samesite=lax" in header and "path=/" in header and "max-age=" in header
    assert "httponly" in session  # the session is unreadable by script
    assert "httponly" not in csrf_cookie  # the double-submit token is read by the page, never the session
    assert re.search(r"max-age=(\d+)", session).group(1) == str(get_settings().account_session_hours * 3600)


def test_logout_clears_both_cookies(client, inbox):
    verified(client, inbox)
    response = client.post("/api/accounts/logout", headers=csrf(client))
    cleared = " ".join(response.headers.get_list("set-cookie")).lower()
    assert "acs_account_session=" in cleared and "acs_account_csrf=" in cleared and "max-age=0" in cleared


def test_the_session_token_is_stored_only_as_a_hash_and_is_long_and_random(client, db, inbox):
    verified(client, inbox)
    token = client.cookies.get(get_settings().account_session_cookie_name)
    assert len(token) >= 40
    row = db.scalar(select(CustomerSession))
    assert row.token_hash != token and token not in (row.token_hash, row.csrf_hash)
    other = client.cookies.get(get_settings().account_csrf_cookie_name)
    assert other != token and row.csrf_hash != other


def test_each_sign_in_gets_a_new_session_and_the_old_one_is_not_reused(client, db, inbox):
    verified(client, inbox)
    first = client.cookies.get(get_settings().account_session_cookie_name)
    assert login(client).status_code == 200
    assert client.cookies.get(get_settings().account_session_cookie_name) != first
    assert len(db.scalars(select(CustomerSession)).all()) == 2


# --- Account status and erased accounts ----------------------------------------------------------------


def test_the_profile_reports_the_account_status(client, db, inbox):
    verified(client, inbox)
    me = client.get("/api/accounts/me").json()
    assert me["email"] == NORMAL and me["email_verified"] is True and me["status"] == "active"
    assert me["privacy_notice_version"] and me["created_at"]
    assert set(me) == {
        "email",
        "display_name",
        "locale",
        "marketing_consent",
        "email_verified",
        "created_at",
        "privacy_notice_version",
        "status",
    }  # no ids, hashes or internal flags
    opened = client.post("/api/accounts/data/requests", json={"kind": "deletion"}, headers=csrf(client))
    assert opened.status_code == 202
    assert client.get("/api/accounts/me").json()["status"] == "deletion_requested"
    # Other kinds of request do not change the status; patching the profile keeps it.
    patched = client.patch("/api/accounts/me", json={"locale": "en"}, headers=csrf(client)).json()
    assert patched["status"] == "deletion_requested" and patched["locale"] == "en"


def test_an_erased_account_cannot_use_a_session_even_if_one_survived(client, db, inbox):
    verified(client, inbox)
    account = db.scalar(select(CustomerAccount))
    account.erased_at = utcnow()  # as if a session had outlived the erasure
    db.commit()
    assert client.get("/api/accounts/me").status_code == 401
    db.expire_all()
    assert db.scalar(select(CustomerSession)).revoked_at is not None  # and it is closed for good


def test_the_account_cannot_change_its_status_fields(client, inbox):
    verified(client, inbox)
    for field in ("email_verified", "status", "created_at", "email", "privacy_notice_version"):
        assert client.patch("/api/accounts/me", json={field: "x"}, headers=csrf(client)).status_code == 422


# --- The go-live prerequisites, one by one -------------------------------------------------------------


def _ready_for_accounts(monkeypatch, **overrides) -> Settings:
    """A production configuration that satisfies every prerequisite (docs/ACCOUNTS_GO_LIVE.md)."""
    from app import legal

    monkeypatch.setattr(legal, "pending_review", lambda: [])
    monkeypatch.setattr(release_gates, "ACCOUNT_HEADER_LAYOUT_FIXED", True)
    values = {
        "customer_accounts_enabled": True,
        "email_provider": "smtp",
        "smtp_host": "mail.example.com",
        "smtp_from": "no-reply@example.com",
        "database_url": "postgresql+psycopg://acs_app_api:p@localhost/db",
        "email_delivery_verified": True,
        "withdrawal_retention_years": 10,
        "data_request_retention_years": 5,
        **overrides,
    }
    return _production(**values)


def test_accounts_start_in_production_only_when_every_prerequisite_is_met(monkeypatch):
    assert _ready_for_accounts(monkeypatch).customer_accounts_enabled is True


@pytest.mark.parametrize(
    ("breaks", "expected"),
    [
        ({"email_provider": "disabled"}, "e-mail provider"),
        ({"email_provider": "dev_file"}, "dev_file"),
        ({"smtp_host": None}, "e-mail provider"),
        ({"database_url": "postgresql+psycopg://acs:p@localhost/db"}, "restricted database role"),
        ({"email_delivery_verified": False}, "EMAIL_DELIVERY_VERIFIED"),
        ({"withdrawal_retention_years": None}, "RETENTION_YEARS"),
        ({"data_request_retention_years": None}, "RETENTION_YEARS"),
        ({"cookie_secure": False}, "COOKIE_SECURE"),
        ({"site_url": "http://example.com"}, "https://"),
    ],
)
def test_each_missing_prerequisite_refuses_the_start(monkeypatch, breaks, expected):
    with pytest.raises(ValidationError) as error:
        _ready_for_accounts(monkeypatch, **breaks)
    assert expected in str(error.value)


def test_pending_legal_texts_and_the_header_blocker_each_refuse_the_start(monkeypatch):
    from app import legal

    _ready_for_accounts(monkeypatch)  # patches both to satisfied
    monkeypatch.setattr(legal, "pending_review", lambda: ["privacy"])
    with pytest.raises(ValidationError, match="pending lawyer review"):
        _production(
            customer_accounts_enabled=True,
            email_provider="smtp",
            smtp_host="h",
            smtp_from="f@example.com",
            database_url="postgresql+psycopg://acs_app_api:p@localhost/db",
            email_delivery_verified=True,
            withdrawal_retention_years=10,
            data_request_retention_years=5,
        )
    monkeypatch.setattr(legal, "pending_review", lambda: [])
    monkeypatch.setattr(release_gates, "ACCOUNT_HEADER_LAYOUT_FIXED", False)
    with pytest.raises(ValidationError, match="BLOCKER-ACC-HEADER-01"):
        _production(
            customer_accounts_enabled=True,
            email_provider="smtp",
            smtp_host="h",
            smtp_from="f@example.com",
            database_url="postgresql+psycopg://acs_app_api:p@localhost/db",
            email_delivery_verified=True,
            withdrawal_retention_years=10,
            data_request_retention_years=5,
        )


def test_public_registration_is_off_by_default_and_in_every_unconfigured_start():
    assert Settings.model_fields["customer_accounts_enabled"].default is False
    assert _production().customer_accounts_enabled is False  # a production start without the flag opens nothing


# --- Quote requests and accounts: verified ownership only ----------------------------------------------


URL = "/api/accounts/quote-requests"


def send_request(client, email: str, **overrides) -> str:
    response = client.post("/api/public/quote-requests", json=quote_payload(email, **overrides))
    assert response.status_code == 201, response.text
    return response.json()["reference"]


def quote_payload(email: str, **overrides) -> dict:
    return lead_payload(email=email, platform="shopify", budget_range="2500_10000", timeline="flexible", **overrides)


def test_a_customer_sees_only_requests_sent_from_their_own_verified_address(client, inbox, db):
    mine = send_request(client, "customer@example.com")
    contact = client.post(
        "/api/public/leads", json=lead_payload(email="Customer@Example.com", message="Hello there, a question.")
    ).json()["reference"]
    other = send_request(client, "someone.else@example.com", company="Other Ltd")
    client.cookies.clear()
    verified(client, inbox)
    listed = client.get(URL)
    assert listed.status_code == 200 and listed.headers["cache-control"] == "no-store"
    rows = listed.json()
    assert {row["reference"] for row in rows} == {mine, contact}
    assert other not in {row["reference"] for row in rows}
    assert {row["kind"] for row in rows} == {"quote", "contact"}
    # Only the customer's own submission, never contact details, free text, notes or the pipeline status.
    assert set(rows[0]) == {"reference", "created_at", "kind", "service", "quotation_status"}
    assert "someone.else@example.com" not in listed.text and "Other Ltd" not in listed.text
    assert all(row["quotation_status"] is None for row in rows)  # quotations are off


def test_matching_is_by_the_verified_address_alone(client, inbox, db):
    send_request(client, "customer@example.com", company="Customer Ltd", name="Customer Name")
    # Same company and same name: neither is an ownership claim.
    send_request(client, "colleague@example.com", company="Customer Ltd", name="Customer Name")
    send_request(client, "customer.tag@example.com")  # a different address, even if it looks similar
    send_request(client, "customer@example.org")  # the same local part on another domain
    client.cookies.clear()
    verified(client, inbox)
    assert len(client.get(URL).json()) == 1


def test_an_unverified_or_erased_account_has_no_claim_and_a_stranger_registering_gets_nothing(client, inbox, db):
    send_request(client, "customer@example.com")
    client.cookies.clear()
    # Someone registers with another person's address: they cannot sign in without the mailbox, so they see nothing.
    assert register(client).status_code == 202
    assert login(client).status_code == 403  # email_not_verified
    assert client.get(URL).status_code == 401
    # Even a session that exists for an unverified account would get an empty list (defence in depth).
    from app.routers.account_requests import owned_by

    assert owned_by("customer@example.com", verified=False, erased=False) is None
    assert owned_by("customer@example.com", verified=True, erased=True) is None
    assert owned_by("  Customer@Example.COM ", verified=True, erased=False) is not None


def test_two_customers_never_see_each_others_requests(client, inbox, db):
    first = send_request(client, "customer@example.com")
    second = send_request(client, "second@example.com")
    client.cookies.clear()
    verified(client, inbox)
    assert [row["reference"] for row in client.get(URL).json()] == [first]
    client.post("/api/accounts/logout", headers=csrf(client))
    box = inbox
    assert (
        client.post(
            "/api/accounts/register",
            json={"email": "second@example.com", "password": PASSWORD, "privacy_acknowledged": True},
        ).status_code
        == 202
    )
    token = re.search(r"#token=([\w-]+)", box.messages[-1][2]).group(1)
    assert client.post("/api/accounts/verification/confirm", json={"token": token}).status_code == 204
    assert (
        client.post("/api/accounts/login", json={"email": "second@example.com", "password": PASSWORD}).status_code
        == 200
    )
    assert [row["reference"] for row in client.get(URL).json()] == [second]


def test_sending_a_request_never_touches_accounts(client, inbox, db):
    verified(client, inbox)
    before = db.scalars(select(CustomerAccount)).all()
    reference = send_request(client, "customer@example.com")  # the signed-in customer still sends anonymously
    after = db.scalars(select(CustomerAccount)).all()
    assert [a.id for a in before] == [a.id for a in after]
    assert db.scalar(select(Lead).where(Lead.email == "customer@example.com")).reference == reference
    # A request from an address nobody registered works exactly as before and creates no account.
    send_request(client, "nobody@example.com")
    assert db.scalar(select(CustomerAccount).where(CustomerAccount.email == "nobody@example.com")) is None


def test_flag_off_hides_the_route_and_the_reads_are_rate_limited(client, inbox, monkeypatch):
    verified(client, inbox)
    monkeypatch.setattr(get_settings(), "legal_read_rate_limit", 2)
    assert [client.get(URL).status_code for _ in range(3)] == [200, 200, 429]
    monkeypatch.setattr(get_settings(), "customer_accounts_enabled", False)
    assert client.get(URL).status_code == 404


def test_the_quotation_state_is_shown_without_the_link_or_the_content(client, admin_client, inbox, db, monkeypatch):
    from tests.test_quotations import approved, publish

    monkeypatch.setattr(get_settings(), "quotations_enabled", True)
    monkeypatch.setattr(get_settings(), "contact_rate_limit", 100)
    reference = send_request(client, "customer@example.com")
    lead = db.scalar(select(Lead).where(Lead.email == "customer@example.com"))
    assert lead.reference == reference
    proposal = approved(admin_client, str(lead.id))
    published = publish(admin_client, str(lead.id), proposal)
    token = published.json()["token"]
    client.cookies.clear()
    verified(client, inbox)
    rows = client.get(URL).json()
    assert rows[0]["quotation_status"] == "published"
    assert token not in str(rows) and "scope" not in str(rows)  # the link is the credential: staff hand it out
    quotation = db.scalar(select(Quotation))
    quotation.valid_until = (utcnow() - timedelta(days=1)).date()
    db.commit()
    assert client.get(URL).json()[0]["quotation_status"] == "expired"
