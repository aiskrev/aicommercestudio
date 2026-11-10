"""Customer accounts (off unless CUSTOMER_ACCOUNTS_ENABLED=true; docs/CUSTOMER_ACCOUNTS.md).

Answers never reveal whether an e-mail is registered: registration, resending and password recovery
return the same 202 whatever happens. The password is hashed on every path so that timing does not
tell either. A session here gives access to this router only; staff, operations and portal routes
use their own cookies and tables.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from pydantic import EmailStr, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import audit
from app.accounts import limits
from app.accounts.mail import dispatch_pending, email_available, enqueue
from app.accounts.models import CustomerAccount, CustomerSession, CustomerToken, OutboxKind, TokenPurpose
from app.compliance.service import record_event
from app.config import Settings, get_settings
from app.deps import CSRF_HEADER, SAFE_METHODS, AppSettings, DbSession, client_ip, client_ip_hash
from app.errors import ApiError
from app.models import utcnow
from app.schemas import StrictModel
from app.security import (
    generate_token,
    hash_password,
    hash_token,
    password_needs_rehash,
    tokens_match,
    validate_password_strength,
    verify_password,
)
from app.turnstile import require_human

ACCEPTED = {"status": "accepted"}
Locale = Literal["bg", "en"]


def _enabled() -> None:
    if not get_settings().customer_accounts_enabled:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/api/accounts", tags=["accounts"], dependencies=[Depends(_enabled), Depends(_no_store)])


def _strong(value: str) -> str:
    validate_password_strength(value)
    return value


class RegisterIn(StrictModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(max_length=200)
    display_name: str | None = Field(default=None, max_length=120)
    locale: Locale = "bg"
    privacy_acknowledged: Literal[True]
    marketing_consent: bool = False
    turnstile_token: str | None = Field(default=None, max_length=2048)

    _password = field_validator("password")(_strong)


class EmailIn(StrictModel):
    email: EmailStr = Field(max_length=254)
    locale: Locale = "bg"
    turnstile_token: str | None = Field(default=None, max_length=2048)


class TokenIn(StrictModel):
    token: str = Field(min_length=20, max_length=200)


class ResetIn(TokenIn):
    password: str = Field(max_length=200)

    _password = field_validator("password")(_strong)


class LoginIn(StrictModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(max_length=200)


class ProfileIn(StrictModel):
    display_name: str | None = Field(default=None, max_length=120)
    locale: Locale | None = None
    marketing_consent: bool | None = None


class PasswordIn(StrictModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)

    _password = field_validator("new_password")(_strong)


class ProfileOut(StrictModel):
    email: str
    display_name: str | None
    locale: str
    marketing_consent: bool


class SessionOut(StrictModel):
    id: uuid.UUID
    created_at: str
    last_seen_at: str
    user_agent: str | None
    current: bool


def _profile(account: CustomerAccount) -> ProfileOut:
    return ProfileOut(
        email=account.email,
        display_name=account.display_name,
        locale=account.locale,
        marketing_consent=account.marketing_consent_at is not None,
    )


def _normal(email: str) -> str:
    return email.strip().lower()


def _find(db: Session, email: str) -> CustomerAccount | None:
    return db.scalar(select(CustomerAccount).where(CustomerAccount.email == _normal(email)))


def _limit_email(settings: Settings, scope: str, request: Request, email: str) -> None:
    window = settings.account_rate_window_seconds
    limits.hit(f"{scope}:ip", client_ip_hash(request), settings.account_ip_rate_limit, window)
    limits.hit(f"{scope}:email", _normal(email), settings.account_email_rate_limit, window)


def _require_email_delivery(settings: Settings) -> None:
    """Never tell someone a message is on its way when nothing can send it."""
    if not email_available(settings):
        raise ApiError(status.HTTP_503_SERVICE_UNAVAILABLE, "E-mail is not available.", "email_unavailable")


def _set_cookies(response: Response, settings: Settings, token: str, csrf: str, max_age: int) -> None:
    common = {"max_age": max_age, "secure": settings.secure_cookies, "samesite": "lax", "path": "/"}
    response.set_cookie(settings.account_session_cookie_name, token, httponly=True, **common)
    response.set_cookie(settings.account_csrf_cookie_name, csrf, httponly=False, **common)


def _clear_cookies(response: Response, settings: Settings) -> None:
    for name in (settings.account_session_cookie_name, settings.account_csrf_cookie_name):
        response.delete_cookie(name, path="/")


@dataclass
class AccountContext:
    account: CustomerAccount
    session: CustomerSession


def _unauthorized() -> ApiError:
    return ApiError(status.HTTP_401_UNAUTHORIZED, "Sign-in required.", "unauthorized")


def require_account(request: Request, db: DbSession, settings: AppSettings) -> AccountContext:
    token = request.cookies.get(settings.account_session_cookie_name)
    if not token or len(token) > 200:
        raise _unauthorized()
    session = db.scalar(select(CustomerSession).where(CustomerSession.token_hash == hash_token(token)))
    now = utcnow()
    if session is None or session.revoked_at is not None or session.expires_at <= now:
        raise _unauthorized()
    if now - session.last_seen_at > timedelta(minutes=settings.account_session_idle_minutes):
        session.revoked_at = now
        db.commit()
        raise _unauthorized()
    if request.method not in SAFE_METHODS:
        header = request.headers.get(CSRF_HEADER)
        if not header or not tokens_match(header, session.csrf_hash):
            raise ApiError(status.HTTP_403_FORBIDDEN, "Invalid CSRF token.", "csrf_failed")
    if now - session.last_seen_at > timedelta(minutes=1):
        session.last_seen_at = now
        db.commit()
    return AccountContext(account=session.account, session=session)


Account = Annotated[AccountContext, Depends(require_account)]


def _use_token(db: Session, raw: str, purpose: TokenPurpose) -> CustomerToken:
    """Consume a token exactly once; the row lock stops two parallel requests from both using it."""
    row = db.scalar(select(CustomerToken).where(CustomerToken.token_hash == hash_token(raw)).with_for_update())
    now = utcnow()
    if row is None or row.purpose != purpose.value or row.used_at is not None or row.expires_at <= now:
        raise ApiError(status.HTTP_400_BAD_REQUEST, "This link is invalid or has expired.", "token_invalid")
    row.used_at = now
    return row


def _revoke_sessions(db: Session, account_id: uuid.UUID, keep: uuid.UUID | None = None) -> None:
    query = update(CustomerSession).where(
        CustomerSession.account_id == account_id, CustomerSession.revoked_at.is_(None)
    )
    if keep is not None:
        query = query.where(CustomerSession.id != keep)
    db.execute(query.values(revoked_at=utcnow()))


@router.post("/register", status_code=status.HTTP_202_ACCEPTED)
def register(
    payload: RegisterIn, request: Request, tasks: BackgroundTasks, db: DbSession, settings: AppSettings
) -> dict[str, str]:
    _require_email_delivery(settings)
    _limit_email(settings, "register", request, payload.email)
    require_human(settings, payload.turnstile_token, client_ip(request))
    password_hash = hash_password(payload.password)  # on every path, so timing does not reveal an account
    existing = _find(db, payload.email)
    if existing is not None:
        enqueue(db, existing, OutboxKind.ACCOUNT_EXISTS, payload.locale)
    else:
        now = utcnow()
        account = CustomerAccount(
            email=_normal(payload.email),
            password_hash=password_hash,
            display_name=payload.display_name or None,
            locale=payload.locale,
            privacy_notice_version=settings.privacy_notice_version,
            privacy_acknowledged_at=now,
            marketing_consent_version=settings.marketing_consent_version if payload.marketing_consent else None,
            marketing_consent_at=now if payload.marketing_consent else None,
        )
        db.add(account)
        db.flush()
        enqueue(db, account, OutboxKind.VERIFY_EMAIL)
        audit.record(
            db,
            "account.registered",
            entity_type="customer_account",
            entity_id=str(account.id),
            ip_hash=client_ip_hash(request),
        )
    db.commit()
    tasks.add_task(dispatch_pending)
    return ACCEPTED


@router.post("/verification/resend", status_code=status.HTTP_202_ACCEPTED)
def resend(
    payload: EmailIn, request: Request, tasks: BackgroundTasks, db: DbSession, settings: AppSettings
) -> dict[str, str]:
    _require_email_delivery(settings)
    _limit_email(settings, "resend", request, payload.email)
    account = _find(db, payload.email)
    if account is not None and account.email_verified_at is None:
        enqueue(db, account, OutboxKind.VERIFY_EMAIL, payload.locale)
        db.commit()
        tasks.add_task(dispatch_pending)
    return ACCEPTED


@router.post("/verification/confirm", status_code=status.HTTP_204_NO_CONTENT)
def confirm(payload: TokenIn, request: Request, db: DbSession, settings: AppSettings) -> None:
    limits.hit(
        "confirm:ip", client_ip_hash(request), settings.account_ip_rate_limit, settings.account_rate_window_seconds
    )
    row = _use_token(db, payload.token, TokenPurpose.VERIFY_EMAIL)
    account = db.get(CustomerAccount, row.account_id)
    if account.email_verified_at is None:
        account.email_verified_at = utcnow()
    audit.record(
        db,
        "account.verified",
        entity_type="customer_account",
        entity_id=str(account.id),
        ip_hash=client_ip_hash(request),
    )
    db.commit()


@router.post("/login", response_model=ProfileOut)
def login(payload: LoginIn, request: Request, response: Response, db: DbSession, settings: AppSettings) -> ProfileOut:
    _limit_email(settings, "login", request, payload.email)
    account = _find(db, payload.email)
    now = utcnow()
    locked = account is not None and account.locked_until is not None and account.locked_until > now
    # verify_password compares against a dummy hash when there is no account, so timing stays the same.
    valid = verify_password(account.password_hash if account else None, payload.password)
    if account is None or locked or not valid:
        if account is not None and not locked:
            account.failed_logins += 1
            if account.failed_logins >= settings.login_lockout_threshold:
                account.locked_until = now + timedelta(minutes=settings.login_lockout_minutes)
                account.failed_logins = 0
            db.commit()
        raise ApiError(status.HTTP_401_UNAUTHORIZED, "Wrong e-mail or password.", "invalid_credentials")
    if account.email_verified_at is None:
        # Only someone who knows the password gets here, so this reveals nothing new.
        raise ApiError(status.HTTP_403_FORBIDDEN, "Confirm your e-mail first.", "email_not_verified")

    if password_needs_rehash(account.password_hash):
        account.password_hash = hash_password(payload.password)
    account.failed_logins = 0
    account.locked_until = None
    token, csrf = generate_token(), generate_token()
    ttl = timedelta(hours=settings.account_session_hours)
    db.add(
        CustomerSession(
            account_id=account.id,
            token_hash=hash_token(token),
            csrf_hash=hash_token(csrf),
            user_agent=(request.headers.get("user-agent") or "")[:160] or None,
            ip_hash=client_ip_hash(request),
            expires_at=now + ttl,
        )
    )
    db.commit()
    _set_cookies(response, settings, token, csrf, int(ttl.total_seconds()))
    return _profile(account)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(ctx: Account, response: Response, db: DbSession, settings: AppSettings) -> None:
    ctx.session.revoked_at = utcnow()
    db.commit()
    _clear_cookies(response, settings)


@router.post("/password/forgot", status_code=status.HTTP_202_ACCEPTED)
def forgot(
    payload: EmailIn, request: Request, tasks: BackgroundTasks, db: DbSession, settings: AppSettings
) -> dict[str, str]:
    _require_email_delivery(settings)
    _limit_email(settings, "forgot", request, payload.email)
    require_human(settings, payload.turnstile_token, client_ip(request))
    account = _find(db, payload.email)
    if account is not None:
        enqueue(db, account, OutboxKind.RESET_PASSWORD, payload.locale)
        db.commit()
        tasks.add_task(dispatch_pending)
    return ACCEPTED


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset(payload: ResetIn, request: Request, db: DbSession, settings: AppSettings) -> None:
    limits.hit(
        "reset:ip", client_ip_hash(request), settings.account_ip_rate_limit, settings.account_rate_window_seconds
    )
    row = _use_token(db, payload.token, TokenPurpose.RESET_PASSWORD)
    account = db.get(CustomerAccount, row.account_id)
    account.password_hash = hash_password(payload.password)
    account.failed_logins = 0
    account.locked_until = None
    if account.email_verified_at is None:
        account.email_verified_at = utcnow()  # the link proves control of the mailbox
    _revoke_sessions(db, account.id)
    audit.record(
        db,
        "account.password_reset",
        entity_type="customer_account",
        entity_id=str(account.id),
        ip_hash=client_ip_hash(request),
    )
    db.commit()


@router.post("/password/change", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordIn, ctx: Account, request: Request, db: DbSession, settings: AppSettings) -> None:
    limits.hit(
        "change:account", str(ctx.account.id), settings.account_email_rate_limit, settings.account_rate_window_seconds
    )
    if not verify_password(ctx.account.password_hash, payload.current_password):
        raise ApiError(status.HTTP_400_BAD_REQUEST, "Wrong password.", "invalid_credentials")
    ctx.account.password_hash = hash_password(payload.new_password)
    _revoke_sessions(db, ctx.account.id, keep=ctx.session.id)
    db.commit()


@router.get("/me", response_model=ProfileOut)
def me(ctx: Account) -> ProfileOut:
    return _profile(ctx.account)


@router.patch("/me", response_model=ProfileOut)
def update_profile(payload: ProfileIn, ctx: Account, db: DbSession, settings: AppSettings) -> ProfileOut:
    account = ctx.account
    if payload.marketing_consent is not None:
        # Lock the row first (before any change is staged: a refresh discards them), so two parallel saves cannot both
        # record the same change in the consent history.
        db.refresh(account, with_for_update=True)
    if "display_name" in payload.model_fields_set:
        account.display_name = payload.display_name or None
    if payload.locale is not None:
        account.locale = payload.locale
    if payload.marketing_consent is True and account.marketing_consent_at is None:
        account.marketing_consent_at = utcnow()
        account.marketing_consent_version = settings.marketing_consent_version
        record_event(
            db,
            document="marketing_consent",
            action="consented",
            version=settings.marketing_consent_version,
            account_id=account.id,
            locale=account.locale,
            source="account_settings",
        )
    if payload.marketing_consent is False and account.marketing_consent_at is not None:
        record_event(
            db,
            document="marketing_consent",
            action="withdrawn",
            version=account.marketing_consent_version,
            account_id=account.id,
            locale=account.locale,
            source="account_settings",
        )
        account.marketing_consent_at = None
        account.marketing_consent_version = None
    db.commit()
    return _profile(account)


@router.get("/sessions", response_model=list[SessionOut])
def sessions(ctx: Account, db: DbSession) -> list[SessionOut]:
    rows = db.scalars(
        select(CustomerSession)
        .where(
            CustomerSession.account_id == ctx.account.id,
            CustomerSession.revoked_at.is_(None),
            CustomerSession.expires_at > utcnow(),
        )
        .order_by(CustomerSession.last_seen_at.desc())
    ).all()
    return [
        SessionOut(
            id=r.id,
            created_at=r.created_at.isoformat(),
            last_seen_at=r.last_seen_at.isoformat(),
            user_agent=r.user_agent,
            current=r.id == ctx.session.id,
        )
        for r in rows
    ]


@router.post("/sessions/revoke-others", status_code=status.HTTP_204_NO_CONTENT)
def revoke_others(ctx: Account, db: DbSession) -> None:
    _revoke_sessions(db, ctx.account.id, keep=ctx.session.id)
    db.commit()


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(session_id: uuid.UUID, ctx: Account, db: DbSession) -> None:
    row = db.get(CustomerSession, session_id)
    if row is None or row.account_id != ctx.account.id:  # the same answer for someone else's session
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")
    row.revoked_at = utcnow()
    db.commit()
