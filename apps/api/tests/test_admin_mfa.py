"""Staff TOTP multi-factor authentication (launch blocker H-2): enrolment, the pending sign-in step,
replay refusal, CSRF, shared rate limits and lockout, one-time recovery codes, ADMIN_MFA_REQUIRED and
the `reset-mfa` CLI."""

from __future__ import annotations

import json
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.cli import main as cli_main
from app.cli import reset_admin_mfa
from app.models import AdminMfaRecoveryCode, AdminSession, AdminUser, AuditLog, utcnow
from app.portal import totp
from app.rate_limit import limiter
from app.services import admin_mfa
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD

AUTH = "/api/admin/auth"


class Clock:
    """Controls the TOTP time step, so a test can produce fresh (and replayed) codes deterministically."""

    def __init__(self) -> None:
        self.step = totp.current_step()

    def advance(self, steps: int = 1) -> None:
        self.step += steps


@pytest.fixture
def clock(monkeypatch) -> Clock:
    state = Clock()
    monkeypatch.setattr(totp, "current_step", lambda now=None: state.step)
    return state


def _csrf(client: TestClient, settings) -> TestClient:
    client.headers["X-CSRF-Token"] = client.cookies.get(settings.csrf_cookie_name) or ""
    return client


def _login(client: TestClient, password: str = ADMIN_PASSWORD):
    return client.post(f"{AUTH}/login", json={"email": ADMIN_EMAIL, "password": password})


def _code(db, settings, step: int) -> str:
    user = db.scalar(select(AdminUser).where(AdminUser.email == ADMIN_EMAIL))
    db.refresh(user)
    return totp.code_at(admin_mfa.secret(settings, user), step)


def _enrol(client: TestClient, db, settings, clock: Clock) -> list[str]:
    """Enrol the signed-in admin from the account page; returns the recovery codes."""
    setup = client.post(f"{AUTH}/mfa/setup")
    assert setup.status_code == 200, setup.text
    confirm = client.post(f"{AUTH}/mfa/confirm", json={"code": _code(db, settings, clock.step)})
    assert confirm.status_code == 200, confirm.text
    return confirm.json()["recovery_codes"]


@pytest.fixture
def mfa_admin(admin_client, db, settings, clock) -> list[str]:
    """The test admin with MFA on, signed out. Returns the recovery codes."""
    codes = _enrol(admin_client, db, settings, clock)
    assert admin_client.post(f"{AUTH}/logout").status_code == 204
    admin_client.headers.pop("X-CSRF-Token", None)
    clock.advance()
    return codes


def _pending(client: TestClient, settings) -> TestClient:
    response = _login(client)
    assert response.status_code == 200, response.text
    assert response.json()["mfa"] == "verify"
    return _csrf(client, settings)


# ------------------------------------------------------------------------------------- TOTP


def test_totp_rfc_6238_vectors_and_staff_secret_separation(admin_user, settings):
    secret = b"12345678901234567890"  # RFC 6238 appendix B, SHA-1 (last six digits)
    vectors = {
        59: "287082",
        1111111109: "081804",
        1111111111: "050471",
        1234567890: "005924",
        2000000000: "279037",
        20000000000: "353130",
    }
    for seconds, code in vectors.items():
        assert totp.code_at(secret, seconds // 30) == code
        assert totp.verify(secret, code, None, now=seconds) == seconds // 30
    assert totp.verify(secret, "287082", 1, now=59) is None  # a used step is refused (replay)
    assert totp.verify(secret, "287082", None, now=59 + 60) is None  # outside ±1 step of drift
    assert totp.verify(secret, "28708", None, now=59) is None

    # Staff secrets are derived (never stored) and differ from a portal secret for the same id and nonce.
    admin_user.mfa_nonce = totp.new_nonce()
    staff_secret = admin_mfa.secret(settings, admin_user)
    assert staff_secret != totp.secret_for(settings.secret_key, admin_user.id, admin_user.mfa_nonce)
    assert len(staff_secret) == 20


# ------------------------------------------------------------------------------- enrolment


def test_enrolment_from_account_shows_key_then_needs_a_code(admin_client, db, settings, clock):
    status = admin_client.get(f"{AUTH}/mfa").json()
    assert status == {"enabled": False, "enabled_at": None, "recovery_codes_remaining": 0, "required": False}

    setup = admin_client.post(f"{AUTH}/mfa/setup")
    assert setup.status_code == 200
    body = setup.json()
    assert body["otpauth_uri"].startswith("otpauth://totp/") and f"secret={body['secret']}" in body["otpauth_uri"]
    assert setup.headers["cache-control"] == "no-store"
    # Not active until confirmed: sign-in is still one step.
    assert admin_client.get(f"{AUTH}/mfa").json()["enabled"] is False

    assert admin_client.post(f"{AUTH}/mfa/confirm", json={"code": "000000"}).status_code == 400
    other = TestClient(admin_client.app)
    assert _login(other).json()["mfa"] is None

    confirm = admin_client.post(f"{AUTH}/mfa/confirm", json={"code": _code(db, settings, clock.step)})
    assert confirm.status_code == 200
    codes = confirm.json()["recovery_codes"]
    assert len(codes) == 10 and len(set(codes)) == 10
    assert confirm.json()["session"] is None

    status = admin_client.get(f"{AUTH}/mfa").json()
    assert status["enabled"] is True and status["recovery_codes_remaining"] == 10
    assert admin_client.get(f"{AUTH}/me").json()["user"]["mfa_enabled"] is True
    # Enabling ended every other session; this one stays.
    assert other.get(f"{AUTH}/me").status_code == 401
    assert admin_client.post(f"{AUTH}/mfa/setup").json()["code"] == "mfa_already_enabled"

    # Only hashes of the recovery codes are stored; the key itself is not stored at all.
    stored = db.scalars(select(AdminMfaRecoveryCode.code_hash)).all()
    assert len(stored) == 10 and not set(codes) & set(stored)
    user = db.scalar(select(AdminUser).where(AdminUser.email == ADMIN_EMAIL))
    db.refresh(user)
    assert body["secret"] not in json.dumps({c.name: str(getattr(user, c.name)) for c in AdminUser.__table__.c})

    # Audit events carry no secret, code or recovery code.
    entries = db.scalars(select(AuditLog).where(AuditLog.action.like("auth.mfa%"))).all()
    assert {"auth.mfa_setup_started", "auth.mfa_setup_failed", "auth.mfa_enabled"} <= {e.action for e in entries}
    dumped = json.dumps([e.details for e in entries])
    assert body["secret"] not in dumped and not any(code in dumped for code in codes)


# --------------------------------------------------------------------------------- sign-in


def test_pending_session_reaches_only_the_mfa_step(client, mfa_admin, db, settings, clock):
    response = _login(client)
    assert response.status_code == 200
    assert response.json()["mfa"] == "verify"
    _csrf(client, settings)
    pending_cookie = client.cookies.get(settings.session_cookie_name)
    pending = db.scalar(select(AdminSession).where(AdminSession.mfa_pending == "verify"))
    assert pending is not None and (pending.expires_at - utcnow()).total_seconds() <= 15 * 60

    for method, path in [
        ("get", f"{AUTH}/me"),
        ("get", f"{AUTH}/sessions"),
        ("get", f"{AUTH}/mfa"),
        ("get", "/api/admin/leads"),
        ("get", f"/api/admin/leads/{uuid.uuid4()}"),
        ("get", "/api/admin/dashboard/stats"),
        ("get", "/api/admin/audit"),
        ("get", "/api/admin/catalogue/entities"),
        ("post", f"{AUTH}/logout-all"),
        ("post", f"{AUTH}/mfa/setup"),
        ("post", f"{AUTH}/mfa/disable"),
    ]:
        result = getattr(client, method)(path) if method == "get" else client.post(path, json={})
        assert result.status_code == 401, f"{method} {path} -> {result.status_code}"
        assert result.json()["code"] == "mfa_required"

    verified = client.post(f"{AUTH}/mfa/verify", json={"code": _code(db, settings, clock.step)})
    assert verified.status_code == 200, verified.text
    assert verified.json()["mfa"] is None
    # A new session token replaces the pending one (no fixation across the privilege change).
    assert client.cookies.get(settings.session_cookie_name) != pending_cookie
    assert client.get(f"{AUTH}/me").status_code == 200
    assert client.get("/api/admin/leads").status_code == 200
    db.refresh(pending)
    assert pending.revoked_at is not None
    # A full session has nothing to verify.
    _csrf(client, settings)
    assert client.post(f"{AUTH}/mfa/verify", json={"code": "123456"}).json()["code"] == "mfa_not_pending"
    login = db.scalars(select(AuditLog).where(AuditLog.action == "auth.login")).all()[-1]
    assert login.details == {"mfa": "totp"}


def test_code_cannot_be_replayed(client, mfa_admin, db, settings, clock):
    code = _code(db, settings, clock.step)
    _pending(client, settings)
    assert client.post(f"{AUTH}/mfa/verify", json={"code": code}).status_code == 200

    second = TestClient(client.app)
    _pending(second, settings)
    replay = second.post(f"{AUTH}/mfa/verify", json={"code": code})
    assert replay.status_code == 400 and replay.json()["code"] == "mfa_code_invalid"
    # The previous step is refused too (it is at or before the last accepted one); the next one works.
    assert second.post(f"{AUTH}/mfa/verify", json={"code": _code(db, settings, clock.step - 1)}).status_code == 400
    clock.advance()
    assert second.post(f"{AUTH}/mfa/verify", json={"code": _code(db, settings, clock.step)}).status_code == 200


def test_mfa_step_requires_csrf_token(client, mfa_admin, db, settings, clock):
    _pending(client, settings)
    code = _code(db, settings, clock.step)
    client.headers.pop("X-CSRF-Token")
    missing = client.post(f"{AUTH}/mfa/verify", json={"code": code})
    assert missing.status_code == 403 and missing.json()["code"] == "csrf_failed"
    client.headers["X-CSRF-Token"] = "forged"
    assert client.post(f"{AUTH}/mfa/verify", json={"code": code}).status_code == 403
    _csrf(client, settings)
    assert client.post(f"{AUTH}/mfa/verify", json={"code": code}).status_code == 200


def test_pending_session_can_be_cancelled_and_expires(client, mfa_admin, db, settings, clock):
    _pending(client, settings)
    assert client.post(f"{AUTH}/logout").status_code == 204
    assert client.post(f"{AUTH}/mfa/verify", json={"code": _code(db, settings, clock.step)}).status_code == 401

    _pending(client, settings)
    pending = db.scalar(
        select(AdminSession).where(AdminSession.mfa_pending == "verify", AdminSession.revoked_at.is_(None))
    )
    pending.expires_at = utcnow()
    db.commit()
    assert client.post(f"{AUTH}/mfa/verify", json={"code": _code(db, settings, clock.step)}).status_code == 401


def test_wrong_codes_share_the_password_lockout(client, mfa_admin, db, settings, clock):
    """Five failures lock the account, counting passwords and codes together; a correct password in
    between does not reset the counter."""
    assert _login(client, "Wrong-Password-2026").status_code == 401
    _pending(client, settings)
    for _ in range(2):
        assert client.post(f"{AUTH}/mfa/verify", json={"code": "000000"}).status_code == 400
    _pending(client, settings)  # the correct password again
    assert client.post(f"{AUTH}/mfa/verify", json={"code": "000000"}).status_code == 400
    locked = client.post(f"{AUTH}/mfa/verify", json={"code": "111111"})
    assert locked.status_code == 429 and locked.json()["code"] == "rate_limited"

    # The pending session is gone and the account is locked for the password step too.
    assert client.post(f"{AUTH}/mfa/verify", json={"code": _code(db, settings, clock.step)}).status_code == 401
    limiter.reset()  # the account lockout, not the in-memory limiter, refuses the password now
    assert _login(client).status_code == 429
    actions = [e.action for e in db.scalars(select(AuditLog).order_by(AuditLog.created_at))]
    assert actions.count("auth.mfa_failed") == 4 and "auth.account_locked" in actions


def test_mfa_step_shares_the_login_rate_limit(client, mfa_admin, db, settings, clock):
    _pending(client, settings)
    for _ in range(settings.login_rate_limit):
        limiter.hit(f"login-email:{ADMIN_EMAIL}", settings.login_rate_limit, settings.login_rate_window_seconds)
    limited = client.post(f"{AUTH}/mfa/verify", json={"code": _code(db, settings, clock.step)})
    assert limited.status_code == 429 and limited.headers["retry-after"]


def test_recovery_codes_are_single_use(client, mfa_admin, db, settings, clock):
    code = mfa_admin[0]
    _pending(client, settings)
    # Case, spaces and dashes do not matter.
    used = client.post(f"{AUTH}/mfa/verify", json={"code": code.upper().replace("-", " ")})
    assert used.status_code == 200, used.text
    _csrf(client, settings)
    assert client.get(f"{AUTH}/mfa").json()["recovery_codes_remaining"] == 9
    assert client.post(f"{AUTH}/logout").status_code == 204

    _pending(client, settings)
    again = client.post(f"{AUTH}/mfa/verify", json={"code": code})
    assert again.status_code == 400 and again.json()["code"] == "mfa_code_invalid"
    assert client.post(f"{AUTH}/mfa/verify", json={"code": mfa_admin[1]}).status_code == 200

    entries = db.scalars(select(AuditLog).where(AuditLog.action == "auth.mfa_recovery_code_used")).all()
    assert [e.details for e in entries] == [{"remaining": 9}, {"remaining": 8}]
    assert not any(c in json.dumps([e.details for e in db.scalars(select(AuditLog))]) for c in mfa_admin)


def test_recovery_codes_can_be_replaced_with_a_current_code(client, mfa_admin, db, settings, clock):
    _pending(client, settings)
    assert client.post(f"{AUTH}/mfa/verify", json={"code": _code(db, settings, clock.step)}).status_code == 200
    _csrf(client, settings)
    # A recovery code is not enough for account changes, and a used step is refused.
    assert client.post(f"{AUTH}/mfa/recovery-codes", json={"code": mfa_admin[0]}).status_code == 400
    assert client.post(f"{AUTH}/mfa/recovery-codes", json={"code": _code(db, settings, clock.step)}).status_code == 400
    clock.advance()
    fresh = client.post(f"{AUTH}/mfa/recovery-codes", json={"code": _code(db, settings, clock.step)})
    assert fresh.status_code == 200
    new_codes = fresh.json()["recovery_codes"]
    assert len(new_codes) == 10 and not set(new_codes) & set(mfa_admin)
    assert client.post(f"{AUTH}/logout").status_code == 204

    _pending(client, settings)
    assert client.post(f"{AUTH}/mfa/verify", json={"code": mfa_admin[2]}).status_code == 400  # old set is gone
    assert client.post(f"{AUTH}/mfa/verify", json={"code": new_codes[0]}).status_code == 200


def test_disable_needs_password_and_code(client, mfa_admin, db, settings, clock):
    _pending(client, settings)
    assert client.post(f"{AUTH}/mfa/verify", json={"code": _code(db, settings, clock.step)}).status_code == 200
    _csrf(client, settings)
    clock.advance()
    code = _code(db, settings, clock.step)
    wrong = client.post(f"{AUTH}/mfa/disable", json={"password": "Wrong-Password-2026", "code": code})
    assert wrong.status_code == 400 and wrong.json()["code"] == "invalid_credentials"
    assert client.post(f"{AUTH}/mfa/disable", json={"password": ADMIN_PASSWORD, "code": "000000"}).status_code == 400
    assert client.post(f"{AUTH}/mfa/disable", json={"password": ADMIN_PASSWORD, "code": code}).status_code == 204

    assert client.get(f"{AUTH}/mfa").json()["enabled"] is False
    assert db.scalars(select(AdminMfaRecoveryCode)).all() == []
    assert "auth.mfa_disabled" in {e.action for e in db.scalars(select(AuditLog))}
    assert _login(TestClient(client.app)).json()["mfa"] is None


# ------------------------------------------------------------------------- ADMIN_MFA_REQUIRED


def test_required_mfa_forces_enrolment_after_password(client, admin_user, db, settings, clock, monkeypatch):
    early = TestClient(client.app)
    assert _login(early).status_code == 200  # a full session from before the switch
    monkeypatch.setattr(settings, "admin_mfa_required", True)
    assert early.get(f"{AUTH}/me").json()["code"] == "mfa_enrolment_required"
    assert early.get("/api/admin/leads").json()["code"] == "mfa_enrolment_required"
    # It can still log out (or enrol); nothing else.
    _csrf(early, settings)
    assert early.post(f"{AUTH}/logout").status_code == 204

    response = _login(client)
    assert response.status_code == 200 and response.json()["mfa"] == "enrol"
    _csrf(client, settings)
    for path in (f"{AUTH}/me", "/api/admin/leads", f"{AUTH}/mfa"):
        result = client.get(path)
        assert result.status_code == 401 and result.json()["code"] == "mfa_enrolment_required"
    # An enrolment session cannot pass the verify step.
    assert client.post(f"{AUTH}/mfa/verify", json={"code": "123456"}).json()["code"] == "mfa_enrolment_required"
    assert client.post(f"{AUTH}/mfa/confirm", json={"code": "123456"}).json()["code"] == "mfa_setup_missing"

    assert client.post(f"{AUTH}/mfa/setup").status_code == 200
    assert client.post(f"{AUTH}/mfa/confirm", json={"code": "000000"}).status_code == 400
    confirm = client.post(f"{AUTH}/mfa/confirm", json={"code": _code(db, settings, clock.step)})
    assert confirm.status_code == 200, confirm.text
    assert len(confirm.json()["recovery_codes"]) == 10
    assert confirm.json()["session"]["user"]["mfa_enabled"] is True
    assert client.get(f"{AUTH}/me").status_code == 200
    _csrf(client, settings)
    assert client.get(f"{AUTH}/mfa").json()["required"] is True

    # Under the policy MFA cannot be switched off; the next sign-in asks for a code.
    clock.advance()
    code = _code(db, settings, clock.step)
    disable = client.post(f"{AUTH}/mfa/disable", json={"password": ADMIN_PASSWORD, "code": code})
    assert disable.status_code == 409 and disable.json()["code"] == "mfa_policy_required"
    assert _login(TestClient(client.app)).json()["mfa"] == "verify"


def test_default_settings_keep_single_step_login(client, admin_user, settings):
    assert settings.admin_mfa_required is False
    response = _login(client)
    assert response.status_code == 200
    assert response.json()["mfa"] is None and response.json()["user"]["mfa_enabled"] is False
    assert client.get(f"{AUTH}/me").status_code == 200


# --------------------------------------------------------------------------------------- CLI


def test_cli_reset_mfa_removes_factor_and_revokes_sessions(client, mfa_admin, db, settings, clock, capsys):
    _pending(client, settings)
    assert client.post(f"{AUTH}/mfa/verify", json={"code": _code(db, settings, clock.step)}).status_code == 200

    assert reset_admin_mfa(db, ADMIN_EMAIL.upper()) == 1
    assert client.get(f"{AUTH}/me").status_code == 401
    user = db.scalar(select(AdminUser).where(AdminUser.email == ADMIN_EMAIL))
    db.refresh(user)
    assert (user.mfa_enabled, user.mfa_nonce, user.mfa_last_step) == (False, None, None)
    assert db.scalars(select(AdminMfaRecoveryCode)).all() == []
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "admin.mfa_reset"))
    assert entry.actor_label == "cli" and entry.details == {"was_enabled": True, "sessions_revoked": 1}

    assert _login(client).json()["mfa"] is None
    assert cli_main(["reset-mfa", "--email", ADMIN_EMAIL]) == 0
    assert "sessions revoked: 1" in capsys.readouterr().out
    assert cli_main(["reset-mfa", "--email", "nobody@example.com"]) == 1
