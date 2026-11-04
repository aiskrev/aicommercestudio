"""Customer accounts: verification, one-time tokens, recovery, sessions and isolation."""

from __future__ import annotations

import logging
import re
import smtplib
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app.accounts import limits
from app.accounts.mail import MAX_ATTEMPTS, dispatch_pending
from app.accounts.models import CustomerAccount, CustomerSession, CustomerToken, OutboxMessage, RateLimitBucket
from app.config import Settings, get_settings
from app.errors import ApiError
from app.models import AdminUser, utcnow
from app.security import hash_token

EMAIL = "Customer@Example.com"
NORMAL = EMAIL.lower()
PASSWORD = "Correct-Horse-2026"
NEW_PASSWORD = "Another-Battery-2027"


class Inbox:
    def __init__(self) -> None:
        self.messages: list[tuple[str, str, str]] = []
        self.fail: Exception | None = None

    def send(self, recipient: str, subject: str, body: str) -> None:
        if self.fail:
            raise self.fail
        self.messages.append((recipient, subject, body))

    def last_token(self) -> str:
        return re.search(r"#token=([\w-]+)", self.messages[-1][2]).group(1)


@pytest.fixture
def inbox(monkeypatch) -> Inbox:
    box = Inbox()
    settings = get_settings()
    monkeypatch.setattr(settings, "customer_accounts_enabled", True)
    monkeypatch.setattr(settings, "email_provider", "smtp")
    monkeypatch.setattr(settings, "smtp_host", "mail.test")
    monkeypatch.setattr(settings, "smtp_from", "no-reply@example.com")
    monkeypatch.setattr(settings, "site_url", "https://trusted.example.com")
    monkeypatch.setattr("app.accounts.mail.get_sender", lambda *_: box)
    return box


def register(client, **extra):
    body = {"email": EMAIL, "password": PASSWORD, "privacy_acknowledged": True, **extra}
    return client.post("/api/accounts/register", json=body)


def login(client, password=PASSWORD):
    return client.post("/api/accounts/login", json={"email": EMAIL, "password": password})


def verified(client, inbox: Inbox):
    assert register(client).status_code == 202
    assert client.post("/api/accounts/verification/confirm", json={"token": inbox.last_token()}).status_code == 204
    response = login(client)
    assert response.status_code == 200
    return response


def public_body(response) -> dict:
    return {key: value for key, value in response.json().items() if key != "request_id"}


def use_session_cookie(client, value: str) -> None:
    name = get_settings().account_session_cookie_name
    client.cookies.delete(name)
    client.cookies.set(name, value)


def csrf(client) -> dict[str, str]:
    return {"x-csrf-token": client.cookies.get(get_settings().account_csrf_cookie_name)}


def test_flag_off_hides_every_route(client):
    assert get_settings().customer_accounts_enabled is False
    assert register(client).status_code == 404
    assert client.get("/api/accounts/me").status_code == 404


def test_registration_refused_without_a_provider(client, db, monkeypatch):
    monkeypatch.setattr(get_settings(), "customer_accounts_enabled", True)
    response = register(client)
    assert response.status_code == 503
    assert response.json()["code"] == "email_unavailable"
    assert db.scalar(select(func.count()).select_from(CustomerAccount)) == 0


def test_undelivered_message_is_blocked_not_marked_sent(client, db, inbox, monkeypatch):
    assert register(client).status_code == 202
    monkeypatch.undo()
    db.execute(OutboxMessage.__table__.update().values(status="pending", sent_at=None))
    db.commit()
    assert dispatch_pending()["blocked"] == 1
    db.expire_all()
    row = db.scalar(select(OutboxMessage))
    assert (row.status, row.sent_at, row.last_error) == ("blocked", None, "provider_not_configured")


@pytest.mark.parametrize(
    ("changes", "problem"),
    [
        ({"customer_accounts_enabled": True}, "CUSTOMER_ACCOUNTS_ENABLED needs"),
        ({"customer_accounts_enabled": True, "email_provider": "smtp"}, "CUSTOMER_ACCOUNTS_ENABLED needs"),
        ({"email_provider": "dev_file"}, "EMAIL_PROVIDER=dev_file"),
    ],
)
def test_production_refuses_to_pretend_it_can_send(changes, problem):
    base = get_settings().model_dump()
    base.update(app_env="production", **changes)
    with pytest.raises(ValueError, match=problem):
        Settings(**base)


def test_verification_link_uses_trusted_origin_and_stores_only_a_hash(client, db, inbox):
    response = client.post(
        "/api/accounts/register",
        json={"email": EMAIL, "password": PASSWORD, "privacy_acknowledged": True},
        headers={"host": "evil.example", "x-forwarded-host": "evil.example", "origin": "https://evil.example"},
    )
    assert response.status_code in (202, 400, 403)
    if response.status_code != 202:
        assert register(client).status_code == 202
    recipient, _, body = inbox.messages[-1]
    assert recipient == NORMAL
    assert "https://trusted.example.com/bg/konto/potvardi#token=" in body
    assert "evil.example" not in body
    token = inbox.last_token()
    row = db.scalar(select(CustomerToken))
    assert row.token_hash == hash_token(token) and token not in row.token_hash


def test_sign_in_needs_a_confirmed_email(client, inbox):
    register(client)
    response = login(client)
    assert response.status_code == 403
    assert response.json()["code"] == "email_not_verified"
    assert client.post("/api/accounts/verification/confirm", json={"token": inbox.last_token()}).status_code == 204
    assert login(client).status_code == 200


def test_token_works_once(client, inbox):
    register(client)
    token = inbox.last_token()
    assert client.post("/api/accounts/verification/confirm", json={"token": token}).status_code == 204
    again = client.post("/api/accounts/verification/confirm", json={"token": token})
    assert again.status_code == 400
    assert again.json()["code"] == "token_invalid"


def test_parallel_requests_cannot_use_a_token_twice(client, inbox):
    register(client)
    token = inbox.last_token()

    def confirm(_):
        return client.post("/api/accounts/verification/confirm", json={"token": token}).status_code

    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(confirm, range(6)))
    assert sorted(results) == [204, 400, 400, 400, 400, 400]


def test_expired_token_is_refused(client, db, inbox):
    register(client)
    row = db.scalar(select(CustomerToken))
    row.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert client.post("/api/accounts/verification/confirm", json={"token": inbox.last_token()}).status_code == 400
    assert login(client).status_code == 403


def test_token_for_one_purpose_is_useless_for_the_other(client, inbox):
    register(client)
    response = client.post("/api/accounts/password/reset", json={"token": inbox.last_token(), "password": NEW_PASSWORD})
    assert response.status_code == 400


def test_resend_replaces_the_previous_link(client, inbox):
    register(client)
    first = inbox.last_token()
    assert client.post("/api/accounts/verification/resend", json={"email": EMAIL}).status_code == 202
    second = inbox.last_token()
    assert first != second
    assert client.post("/api/accounts/verification/confirm", json={"token": first}).status_code == 400
    assert client.post("/api/accounts/verification/confirm", json={"token": second}).status_code == 204


def test_resend_sends_nothing_once_confirmed(client, inbox):
    verified(client, inbox)
    count = len(inbox.messages)
    assert client.post("/api/accounts/verification/resend", json={"email": EMAIL}).status_code == 202
    assert len(inbox.messages) == count


def test_answers_do_not_reveal_whether_an_account_exists(client, inbox):
    unknown = {"email": "nobody@example.com"}
    first = [
        client.post("/api/accounts/verification/resend", json=unknown),
        client.post("/api/accounts/password/forgot", json=unknown),
        client.post("/api/accounts/login", json={**unknown, "password": PASSWORD}),
    ]
    verified(client, inbox)
    client.post("/api/accounts/logout", headers=csrf(client))
    second = [
        client.post("/api/accounts/verification/resend", json={"email": EMAIL}),
        client.post("/api/accounts/password/forgot", json={"email": EMAIL}),
        login(client, "Wrong-Password-2026"),
    ]
    for a, b in zip(first, second, strict=True):
        assert (a.status_code, public_body(a)) == (b.status_code, public_body(b))


def test_registering_twice_changes_nothing_and_warns_the_owner(client, db, inbox):
    verified(client, inbox)
    client.post("/api/accounts/logout", headers=csrf(client))
    response = register(client, password="Attacker-Choice-2026", display_name="Mallory")
    assert response.status_code == 202
    assert response.json() == {"status": "accepted"}
    assert db.scalar(select(func.count()).select_from(CustomerAccount)) == 1
    assert "Вече имате акаунт" in inbox.messages[-1][1]
    assert "#token=" not in inbox.messages[-1][2]
    assert login(client).status_code == 200
    assert login(client, "Attacker-Choice-2026").status_code == 401


def test_recovery_changes_the_password_and_revokes_every_session(client, inbox):
    verified(client, inbox)
    client.post("/api/accounts/password/forgot", json={"email": EMAIL})
    token = inbox.last_token()
    assert client.get("/api/accounts/me").status_code == 200
    assert (
        client.post("/api/accounts/password/reset", json={"token": token, "password": NEW_PASSWORD}).status_code == 204
    )
    assert client.get("/api/accounts/me").status_code == 401
    assert login(client).status_code == 401
    assert login(client, NEW_PASSWORD).status_code == 200
    assert client.post("/api/accounts/password/reset", json={"token": token, "password": PASSWORD}).status_code == 400


def test_weak_password_is_refused(client, inbox):
    assert (
        client.post(
            "/api/accounts/register", json={"email": EMAIL, "password": "short", "privacy_acknowledged": True}
        ).status_code
        == 422
    )


def test_privacy_acknowledgement_is_required_and_marketing_is_optional(client, db, inbox):
    body = {"email": EMAIL, "password": PASSWORD}
    assert client.post("/api/accounts/register", json=body).status_code == 422
    assert register(client).status_code == 202
    account = db.scalar(select(CustomerAccount))
    assert account.privacy_notice_version == get_settings().privacy_notice_version
    assert account.marketing_consent_at is None and account.marketing_consent_version is None


def test_marketing_consent_is_recorded_with_its_version_and_can_be_withdrawn(client, db, inbox):
    verified(client, inbox)
    on = client.patch("/api/accounts/me", json={"marketing_consent": True}, headers=csrf(client))
    assert on.json()["marketing_consent"] is True
    account = db.scalar(select(CustomerAccount))
    assert account.marketing_consent_version == get_settings().marketing_consent_version
    off = client.patch("/api/accounts/me", json={"marketing_consent": False}, headers=csrf(client))
    assert off.json()["marketing_consent"] is False
    db.expire_all()
    assert db.scalar(select(CustomerAccount)).marketing_consent_at is None


def test_registration_collects_no_invoice_data(client, inbox):
    response = register(client, company="Example Ltd", vat_number="BG123456789")
    assert response.status_code == 422


def test_profile_and_language(client, inbox):
    verified(client, inbox)
    response = client.patch("/api/accounts/me", json={"display_name": "Ана", "locale": "en"}, headers=csrf(client))
    assert response.status_code == 200
    assert response.json()["display_name"] == "Ана"
    assert client.get("/api/accounts/me").json()["locale"] == "en"


def test_changes_need_the_csrf_token(client, inbox):
    verified(client, inbox)
    assert client.patch("/api/accounts/me", json={"locale": "en"}).status_code == 403
    assert client.patch("/api/accounts/me", json={"locale": "en"}, headers={"x-csrf-token": "wrong"}).status_code == 403
    assert client.post("/api/accounts/logout").status_code == 403


def test_session_cookie_is_http_only(client, inbox):
    response = verified(client, inbox)
    header = "; ".join(response.headers.get_list("set-cookie"))
    assert re.search(r"acs_account_session=[^;]+;[^,]*HttpOnly", header, re.I)
    assert "samesite=lax" in header.lower()


def test_logout_revokes_the_session_on_the_server(client, inbox):
    verified(client, inbox)
    stolen = client.cookies.get(get_settings().account_session_cookie_name)
    assert client.post("/api/accounts/logout", headers=csrf(client)).status_code == 204
    use_session_cookie(client, stolen)
    assert client.get("/api/accounts/me").status_code == 401


def test_session_list_and_revoking_another_device(client, db, inbox):
    verified(client, inbox)
    name = get_settings().account_session_cookie_name
    first_cookie = client.cookies.get(name)
    assert login(client).status_code == 200
    rows = client.get("/api/accounts/sessions").json()
    assert len(rows) == 2
    other = next(r for r in rows if not r["current"])
    assert client.delete(f"/api/accounts/sessions/{other['id']}", headers=csrf(client)).status_code == 204
    second_cookie = client.cookies.get(name)
    use_session_cookie(client, first_cookie)
    assert client.get("/api/accounts/me").status_code == 401
    use_session_cookie(client, second_cookie)
    assert client.get("/api/accounts/me").status_code == 200


def test_revoke_others_keeps_the_current_session(client, db, inbox):
    verified(client, inbox)
    assert login(client).status_code == 200
    assert client.post("/api/accounts/sessions/revoke-others", headers=csrf(client)).status_code == 204
    assert client.get("/api/accounts/me").status_code == 200
    assert len(client.get("/api/accounts/sessions").json()) == 1


def test_changing_the_password_revokes_other_sessions(client, db, inbox):
    verified(client, inbox)
    assert login(client).status_code == 200
    body = {"current_password": PASSWORD, "new_password": NEW_PASSWORD}
    assert client.post("/api/accounts/password/change", json=body, headers=csrf(client)).status_code == 204
    assert db.scalar(select(func.count()).select_from(CustomerSession).where(CustomerSession.revoked_at.is_(None))) == 1


def test_expired_and_idle_sessions_stop_working(client, db, inbox):
    verified(client, inbox)
    row = db.scalar(select(CustomerSession))
    row.last_seen_at = utcnow() - timedelta(minutes=get_settings().account_session_idle_minutes + 1)
    db.commit()
    assert client.get("/api/accounts/me").status_code == 401


def test_one_account_cannot_touch_another_accounts_session(client, db, inbox):
    verified(client, inbox)
    victim = db.scalar(select(CustomerSession))
    client.post("/api/accounts/logout", headers=csrf(client))
    other = {"email": "second@example.com", "password": PASSWORD, "privacy_acknowledged": True}
    client.post("/api/accounts/register", json=other)
    client.post("/api/accounts/verification/confirm", json={"token": inbox.last_token()})
    assert client.post("/api/accounts/login", json={"email": other["email"], "password": PASSWORD}).status_code == 200
    db.execute(CustomerSession.__table__.update().where(CustomerSession.id == victim.id).values(revoked_at=None))
    db.commit()
    assert client.delete(f"/api/accounts/sessions/{victim.id}", headers=csrf(client)).status_code == 404
    db.expire_all()
    assert db.get(CustomerSession, victim.id).revoked_at is None
    assert all(r["id"] != str(victim.id) for r in client.get("/api/accounts/sessions").json())


def test_registration_grants_nothing_beyond_the_account(client, db, inbox):
    from sqlalchemy import text

    domain_owner = "owner@acme.example"
    register(client, email=domain_owner)
    for table in ("ops_memberships", "ops_organizations", "portal_users"):
        assert db.execute(text(f"SELECT count(*) FROM {table}")).scalar() == 0  # noqa: S608 - fixed names
    assert db.scalar(select(func.count()).select_from(AdminUser)) == 0


def test_customer_session_opens_no_staff_operations_or_portal_route(client, inbox):
    verified(client, inbox)
    for path in ("/api/admin/auth/me", "/api/admin/leads", "/api/ops/organizations", "/api/portal/me"):
        assert client.get(path).status_code in (401, 403, 404), path


def test_staff_mfa_requirement_is_unchanged(client, admin_user, monkeypatch):
    from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD

    monkeypatch.setattr(get_settings(), "admin_mfa_required", True)
    response = client.post("/api/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert response.status_code == 200
    assert client.get("/api/admin/leads").status_code in (401, 403)


def test_failed_delivery_retries_with_status_and_then_gives_up(client, db, inbox):
    inbox.fail = smtplib.SMTPServerDisconnected("secret detail from the server")
    assert register(client).status_code == 202
    row = db.scalar(select(OutboxMessage))
    assert (row.status, row.attempts, row.last_error) == ("pending", 1, "SMTPServerDisconnected")
    assert row.next_attempt_at > utcnow()
    assert db.scalar(select(func.count()).select_from(CustomerToken)) == 0  # rolled back with the attempt
    for _ in range(MAX_ATTEMPTS - 1):
        db.execute(OutboxMessage.__table__.update().values(next_attempt_at=utcnow()))
        db.commit()
        dispatch_pending()
    db.expire_all()
    row = db.scalar(select(OutboxMessage))
    assert (row.status, row.attempts) == ("failed", MAX_ATTEMPTS)


def test_retry_after_a_failure_delivers_a_working_link(client, db, inbox):
    inbox.fail = OSError("connection refused")
    register(client)
    inbox.fail = None
    db.execute(OutboxMessage.__table__.update().values(next_attempt_at=utcnow()))
    db.commit()
    assert dispatch_pending()["sent"] == 1
    db.expire_all()
    row = db.scalar(select(OutboxMessage))
    assert row.status == "sent" and row.sent_at is not None
    assert client.post("/api/accounts/verification/confirm", json={"token": inbox.last_token()}).status_code == 204


def test_outbox_holds_no_address_or_token(client, db, inbox):
    register(client)
    row = db.scalar(select(OutboxMessage))
    values = " ".join(str(getattr(row, c.name)) for c in OutboxMessage.__table__.columns)
    assert NORMAL not in values and inbox.last_token() not in values


def test_logs_contain_no_token_password_or_mail_body(client, inbox, caplog):
    caplog.set_level(logging.DEBUG)
    inbox.fail = OSError("down")
    register(client)
    inbox.fail = None
    client.post("/api/accounts/verification/resend", json={"email": EMAIL})
    token = inbox.last_token()
    client.post("/api/accounts/verification/confirm", json={"token": token})
    text_logged = caplog.text + " ".join(str(r.__dict__) for r in caplog.records)
    assert token not in text_logged and PASSWORD not in text_logged and "Здравейте" not in text_logged


def test_rate_limit_is_shared_and_keeps_no_plain_values(client, db, inbox, monkeypatch):
    monkeypatch.setattr(get_settings(), "account_email_rate_limit", 2)
    for _ in range(2):
        assert client.post("/api/accounts/password/forgot", json={"email": EMAIL}).status_code == 202
    blocked = client.post("/api/accounts/password/forgot", json={"email": EMAIL})
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0
    keys = db.scalars(select(RateLimitBucket.key)).all()
    assert keys and all(re.fullmatch(r"[0-9a-f]{64}", key) for key in keys)


def test_parallel_hits_cannot_slip_past_the_limit(client, inbox):
    def hit(_):
        try:
            limits.hit("parallel", "x", 5, 60)
        except ApiError:
            return False
        return True

    with ThreadPoolExecutor(max_workers=10) as pool:
        allowed = list(pool.map(hit, range(20)))
    assert sum(allowed) == 5


def test_rate_limit_window_starts_over(client, db, inbox):
    limits.hit("probe", "x", 1, 60)
    db.execute(RateLimitBucket.__table__.update().values(window_start=utcnow() - timedelta(seconds=61)))
    db.commit()
    limits.hit("probe", "x", 1, 60)


def test_repeated_failures_lock_the_account_without_saying_so(client, db, inbox, monkeypatch):
    monkeypatch.setattr(get_settings(), "login_lockout_threshold", 2)
    monkeypatch.setattr(get_settings(), "account_email_rate_limit", 100)
    verified(client, inbox)
    client.post("/api/accounts/logout", headers=csrf(client))
    for _ in range(2):
        assert login(client, "Wrong-Password-2026").status_code == 401
    locked = login(client)
    assert locked.status_code == 401
    assert locked.json()["code"] == "invalid_credentials"
