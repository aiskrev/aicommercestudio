"""Read-only client portal (disabled unless CLIENT_PORTAL_ENABLED=true; docs/CLIENT_PORTAL.md).

Two routers:

* staff — `/api/ops/organizations/{org}/portal-users`: invite, issue a recovery link, disable. Needs the
  `portal_users.*` permissions; refused for demo organisations.
* client — `/api/portal/*`: activation with password + TOTP, login (password, then code), logout, and
  GET-only data views of the session's own organisation: agents, evaluation summaries, incidents.

The organisation is always the authenticated session's: no client route takes an organisation id.
Data views run under row-level security bound to that organisation, never return prompt content,
credentials or internal notes, and every view is recorded in the organisation's audit trail.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Request, Response, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.deps import CSRF_HEADER, AppSettings, DbSession, client_ip, enforce_rate_limit
from app.errors import ApiError
from app.models import OpsAgent, OpsOrganization, OpsOrganizationStatus, OpsWorkspace, utcnow
from app.ops import rls
from app.ops.models import (
    IncidentStatus,
    OpsAgentVersion,
    OpsEvalDataset,
    OpsEvalRun,
    OpsIncident,
    OpsIncidentEvent,
    PortalSession,
    PortalTokenPurpose,
    PortalUser,
    PortalUserStatus,
    VersionStatus,
)
from app.ops.rbac import Permission
from app.ops.tenancy import OpsContext, audit_details, get_scoped, require, scoped
from app.portal import service
from app.schemas import StrictModel, _clean_text, _no_secrets
from app.security import hash_token, tokens_match, verify_password

_SAFE = {"GET", "HEAD", "OPTIONS"}


def _enabled() -> None:
    if not get_settings().client_portal_enabled:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


staff = APIRouter(
    prefix="/api/ops/organizations/{organization_id}/portal-users",
    tags=["portal-admin"],
    dependencies=[Depends(_enabled)],
)
client = APIRouter(prefix="/api/portal", tags=["portal"], dependencies=[Depends(_enabled)])


# ===================================================================== staff management


class PortalUserCreate(StrictModel):
    email: EmailStr = Field(max_length=254)
    full_name: str = Field(min_length=2, max_length=120)

    @field_validator("full_name")
    @classmethod
    def _name(cls, value: str) -> str:
        return _no_secrets(_clean_text(value))

    @field_validator("email")
    @classmethod
    def _lower(cls, value: str) -> str:
        return value.lower()


class PortalUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    status: str
    mfa_enabled: bool
    created_at: datetime
    activated_at: datetime | None
    last_login_at: datetime | None


class LinkOut(BaseModel):
    user: PortalUserOut
    # Shown once; only the hash is stored. The token is in the fragment so it never reaches access logs.
    path: str
    expires_in_hours: int


def _staff_audit(db, ctx: OpsContext, action: str, user: PortalUser) -> None:
    from app import audit

    audit.record(
        db,
        action,
        actor=ctx.admin.user,
        entity_type="portal_user",
        entity_id=str(user.id),
        details=audit_details(ctx, portal_user=str(user.id)),
        ip_hash=ctx.admin.ip_hash,
    )


@staff.get("", response_model=list[PortalUserOut])
def list_portal_users(
    ctx: Annotated[OpsContext, Depends(require(Permission.PORTAL_USERS_READ))], db: DbSession
) -> list[PortalUserOut]:
    return [
        PortalUserOut.model_validate(u) for u in db.scalars(scoped(ctx, PortalUser).order_by(PortalUser.created_at))
    ]


@staff.post("", response_model=LinkOut, status_code=status.HTTP_201_CREATED)
def invite(
    body: PortalUserCreate,
    ctx: Annotated[OpsContext, Depends(require(Permission.PORTAL_USERS_WRITE))],
    db: DbSession,
    settings: AppSettings,
) -> LinkOut:
    if ctx.organization.is_demo:
        raise ApiError(status.HTTP_409_CONFLICT, "Demo organisations have no client access.", "ops_demo_portal")
    user = PortalUser(
        organization_id=ctx.organization_id,
        email=body.email,
        full_name=body.full_name,
        status=PortalUserStatus.INVITED,
        mfa_enabled=False,
        failed_login_count=0,
        created_by=ctx.admin.user.id,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise ApiError(
            status.HTTP_409_CONFLICT, "A client account with this e-mail already exists.", "ops_conflict"
        ) from None
    token = service.issue_token(
        db, user, PortalTokenPurpose.INVITATION, settings.portal_invitation_hours, ctx.admin.user.id
    )
    _staff_audit(db, ctx, "ops.portal_user_invited", user)
    db.commit()
    return LinkOut(
        user=PortalUserOut.model_validate(user),
        path=f"/portal/activate#{token}",
        expires_in_hours=settings.portal_invitation_hours,
    )


@staff.post("/{user_id}/recovery", response_model=LinkOut)
def recovery(
    user_id: uuid.UUID,
    ctx: Annotated[OpsContext, Depends(require(Permission.PORTAL_USERS_WRITE))],
    db: DbSession,
    settings: AppSettings,
) -> LinkOut:
    """Account recovery is staff-assisted: a one-time link resets the password and the second factor."""
    user = get_scoped(db, ctx, PortalUser, user_id)
    if user.status == PortalUserStatus.DISABLED:
        raise ApiError(status.HTTP_409_CONFLICT, "The account is disabled.", "portal_disabled")
    token = service.issue_token(
        db, user, PortalTokenPurpose.RECOVERY, settings.portal_invitation_hours, ctx.admin.user.id
    )
    _staff_audit(db, ctx, "ops.portal_recovery_issued", user)
    db.commit()
    return LinkOut(
        user=PortalUserOut.model_validate(user),
        path=f"/portal/recover#{token}",
        expires_in_hours=settings.portal_invitation_hours,
    )


@staff.post("/{user_id}/disable", response_model=PortalUserOut)
def disable(
    user_id: uuid.UUID, ctx: Annotated[OpsContext, Depends(require(Permission.PORTAL_USERS_WRITE))], db: DbSession
) -> PortalUserOut:
    user = get_scoped(db, ctx, PortalUser, user_id)
    user.status = PortalUserStatus.DISABLED
    service.revoke_sessions(db, user)
    _staff_audit(db, ctx, "ops.portal_user_disabled", user)
    db.commit()
    return PortalUserOut.model_validate(user)


# ========================================================================= client auth


class EnrolIn(StrictModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=1, max_length=256)


class ConfirmIn(StrictModel):
    token: str = Field(min_length=10, max_length=200)
    code: str = Field(min_length=6, max_length=6)


class LoginIn(StrictModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=1, max_length=256)


class CodeIn(StrictModel):
    code: str = Field(min_length=6, max_length=6)


class EnrolOut(BaseModel):
    otpauth_uri: str
    secret: str


class LoginOut(BaseModel):
    mfa_required: bool = True


def _limit(request: Request, kind: str) -> None:
    settings = get_settings()
    enforce_rate_limit(
        f"portal-{kind}:{client_ip(request)}", settings.login_rate_limit, settings.login_rate_window_seconds
    )


@client.post("/activate", response_model=EnrolOut)
def activate(body: EnrolIn, request: Request, db: DbSession, settings: AppSettings) -> EnrolOut:
    rls.bootstrap(db)
    _limit(request, "token")
    return EnrolOut(**service.start_enrolment(db, settings, body.token, PortalTokenPurpose.INVITATION, body.password))


@client.post("/activate/confirm", status_code=status.HTTP_204_NO_CONTENT)
def activate_confirm(body: ConfirmIn, request: Request, db: DbSession, settings: AppSettings) -> Response:
    rls.bootstrap(db)
    _limit(request, "token")
    service.confirm_enrolment(db, settings, body.token, PortalTokenPurpose.INVITATION, body.code)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@client.post("/recover", response_model=EnrolOut)
def recover(body: EnrolIn, request: Request, db: DbSession, settings: AppSettings) -> EnrolOut:
    rls.bootstrap(db)
    _limit(request, "token")
    return EnrolOut(**service.start_enrolment(db, settings, body.token, PortalTokenPurpose.RECOVERY, body.password))


@client.post("/recover/confirm", status_code=status.HTTP_204_NO_CONTENT)
def recover_confirm(body: ConfirmIn, request: Request, db: DbSession, settings: AppSettings) -> Response:
    rls.bootstrap(db)
    _limit(request, "token")
    service.confirm_enrolment(db, settings, body.token, PortalTokenPurpose.RECOVERY, body.code)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _set_cookies(response: Response, settings, token: str, csrf: str) -> None:
    max_age = settings.portal_session_hours * 3600
    response.set_cookie(
        settings.portal_session_cookie_name,
        token,
        max_age=max_age,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="strict",
        path="/",
    )
    response.set_cookie(
        settings.portal_csrf_cookie_name,
        csrf,
        max_age=max_age,
        httponly=False,
        secure=settings.secure_cookies,
        samesite="strict",
        path="/",
    )


def _clear_cookies(response: Response, settings) -> None:
    for name in (settings.portal_session_cookie_name, settings.portal_csrf_cookie_name):
        response.delete_cookie(name, path="/", secure=settings.secure_cookies, samesite="strict")


@client.post("/login", response_model=LoginOut)
def login(body: LoginIn, request: Request, response: Response, db: DbSession, settings: AppSettings) -> LoginOut:
    _limit(request, "login")
    now = utcnow()
    rls.bootstrap(db)
    user = db.scalar(select(PortalUser).where(func.lower(PortalUser.email) == body.email.lower()))
    org = db.get(OpsOrganization, user.organization_id) if user else None
    ok = verify_password(user.password_hash if user else None, body.password)
    if user is not None and service.locked(user, now):
        ok = False
    if (
        not ok
        or user is None
        or user.status != PortalUserStatus.ACTIVE
        or not user.mfa_enabled
        or org is None
        or org.status != OpsOrganizationStatus.ACTIVE
    ):
        if user is not None and not service.locked(user, now):
            service.register_failure(user, now)
            service.record(db, "ops.portal_login_failed", user, user.organization_id)
            db.commit()
        # One answer for every reason: no account enumeration.
        raise service.unauthorized("portal_invalid_login")
    token, csrf = service.create_session(db, settings, user)
    user.failed_login_count = 0
    db.commit()
    _set_cookies(response, settings, token, csrf)
    return LoginOut()


class PortalPrincipal:
    def __init__(self, user: PortalUser, session: PortalSession) -> None:
        self.user, self.session = user, session

    @property
    def organization_id(self) -> uuid.UUID:
        return self.user.organization_id


def _session(request: Request, db: DbSession, *, mfa: bool) -> PortalPrincipal:
    settings = get_settings()
    raw = request.cookies.get(settings.portal_session_cookie_name)
    if not raw or len(raw) > 200:
        raise service.unauthorized()
    rls.bootstrap(db)
    session = db.scalar(select(PortalSession).where(PortalSession.token_hash == hash_token(raw)))
    now = utcnow()
    if session is None or session.revoked_at is not None or session.expires_at <= now:
        raise service.unauthorized()
    if now - session.last_seen_at > timedelta(minutes=settings.portal_session_idle_minutes):
        session.revoked_at = now
        db.commit()
        raise service.unauthorized("portal_session_expired")
    user = db.get(PortalUser, session.user_id)
    org = db.get(OpsOrganization, session.organization_id)
    if (
        user is None
        or user.status != PortalUserStatus.ACTIVE
        or org is None
        or org.status != OpsOrganizationStatus.ACTIVE
    ):
        session.revoked_at = now
        db.commit()
        raise service.unauthorized()
    if mfa and not session.mfa_verified:
        raise service.unauthorized("portal_mfa_required")
    if request.method not in _SAFE:
        header = request.headers.get(CSRF_HEADER)
        if not header or not tokens_match(header, session.csrf_hash):
            raise ApiError(status.HTTP_403_FORBIDDEN, "Invalid CSRF token. Reload the page.", "csrf_failed")
    session.last_seen_at = now
    db.commit()
    # From here on the request sees only its own organisation, enforced by the database.
    rls.bind(db, organization_id=session.organization_id)
    return PortalPrincipal(user, session)


def pending_session(request: Request, db: DbSession) -> PortalPrincipal:
    return _session(request, db, mfa=False)


def portal_session(request: Request, db: DbSession) -> PortalPrincipal:
    return _session(request, db, mfa=True)


Pending = Annotated[PortalPrincipal, Depends(pending_session)]
Client = Annotated[PortalPrincipal, Depends(portal_session)]


@client.post("/login/mfa", response_model=LoginOut)
def login_mfa(body: CodeIn, principal: Pending, db: DbSession, settings: AppSettings, request: Request) -> LoginOut:
    _limit(request, "mfa")
    from app.portal import totp

    user, session = principal.user, principal.session
    now = utcnow()
    step = totp.verify(
        totp.secret_for(settings.secret_key, user.id, user.mfa_nonce or ""), body.code, user.mfa_last_step
    )
    if step is None:
        service.register_failure(user, now)
        if user.locked_until and user.locked_until > now:
            session.revoked_at = now
        service.record(db, "ops.portal_mfa_failed", user, user.organization_id)
        db.commit()
        raise ApiError(status.HTTP_400_BAD_REQUEST, "The code is not valid.", "portal_code_invalid")
    session.mfa_verified = True
    user.mfa_last_step, user.last_login_at, user.failed_login_count = step, now, 0
    service.record(db, "ops.portal_login", user, user.organization_id)
    db.commit()
    return LoginOut(mfa_required=False)


@client.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(principal: Pending, db: DbSession, settings: AppSettings) -> Response:
    principal.session.revoked_at = utcnow()
    db.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_cookies(response, settings)
    return response


# ========================================================================== client data


class MeOut(BaseModel):
    email: str
    full_name: str
    organization: str


class TelemetryNote(BaseModel):
    connected: bool = False
    note: str = "No monitoring source is connected. This portal shows only records entered by the studio team."


class PortalAgent(BaseModel):
    name: str
    status: str
    environment: str
    approved_version: int | None
    updated_at: datetime


class PortalEvaluation(BaseModel):
    agent: str
    dataset: str
    dataset_version: int
    agent_version: int
    passed: int
    total: int
    simulated: bool
    finished_at: datetime


class PortalIncident(BaseModel):
    number: int
    title: str
    severity: str
    impact: str
    status: str
    client_summary: str | None
    detected_at: datetime
    resolved_at: datetime | None
    updated_at: datetime


class StatusStep(BaseModel):
    from_status: str | None
    to_status: str | None
    at: datetime


class PortalIncidentDetail(PortalIncident):
    history: list[StatusStep]


class Dashboard(BaseModel):
    organization: str
    agents_by_status: dict[str, int]
    open_incidents: int
    evaluations: int
    telemetry: TelemetryNote = Field(default_factory=TelemetryNote)


def _viewed(db, principal: PortalPrincipal, resource: str) -> None:
    service.record(db, "ops.portal_viewed", principal.user, principal.organization_id, resource=resource)
    db.commit()


@client.get("/me", response_model=MeOut)
def me(principal: Client, db: DbSession) -> MeOut:
    org = db.get(OpsOrganization, principal.organization_id)
    return MeOut(email=principal.user.email, full_name=principal.user.full_name, organization=org.name if org else "")


def _agents(db, principal: PortalPrincipal) -> list[PortalAgent]:
    org = principal.organization_id
    workspaces = {
        w.id: w.environment for w in db.scalars(select(OpsWorkspace).where(OpsWorkspace.organization_id == org))
    }
    approved = dict(
        db.execute(
            select(OpsAgentVersion.agent_id, OpsAgentVersion.number).where(
                OpsAgentVersion.organization_id == org, OpsAgentVersion.status == VersionStatus.APPROVED
            )
        ).all()
    )
    agents = db.scalars(select(OpsAgent).where(OpsAgent.organization_id == org).order_by(OpsAgent.name))
    return [
        PortalAgent(
            name=a.name,
            status=a.status,
            environment=workspaces.get(a.workspace_id, ""),
            approved_version=approved.get(a.id),
            updated_at=a.updated_at,
        )
        for a in agents
    ]


@client.get("/dashboard", response_model=Dashboard)
def dashboard(principal: Client, db: DbSession, response: Response) -> Dashboard:
    response.headers["Cache-Control"] = "no-store"
    org = principal.organization_id
    by_status: dict[str, int] = {}
    for agent in _agents(db, principal):
        by_status[agent.status] = by_status.get(agent.status, 0) + 1
    open_incidents = (
        db.scalar(
            select(func.count())
            .select_from(OpsIncident)
            .where(
                OpsIncident.organization_id == org,
                OpsIncident.status.notin_([IncidentStatus.RESOLVED, IncidentStatus.REVIEWED]),
            )
        )
        or 0
    )
    evaluations = db.scalar(select(func.count()).select_from(OpsEvalRun).where(OpsEvalRun.organization_id == org)) or 0
    name = db.get(OpsOrganization, org)
    _viewed(db, principal, "dashboard")
    return Dashboard(
        organization=name.name if name else "",
        agents_by_status=by_status,
        open_incidents=open_incidents,
        evaluations=evaluations,
    )


@client.get("/agents", response_model=list[PortalAgent])
def agents(principal: Client, db: DbSession, response: Response) -> list[PortalAgent]:
    response.headers["Cache-Control"] = "no-store"
    out = _agents(db, principal)
    _viewed(db, principal, "agents")
    return out


@client.get("/evaluations", response_model=list[PortalEvaluation])
def evaluations(principal: Client, db: DbSession, response: Response) -> list[PortalEvaluation]:
    response.headers["Cache-Control"] = "no-store"
    org = principal.organization_id
    rows = db.execute(
        select(OpsEvalRun, OpsEvalDataset, OpsAgentVersion, OpsAgent)
        .join(OpsEvalDataset, OpsEvalDataset.id == OpsEvalRun.dataset_id)
        .join(OpsAgentVersion, OpsAgentVersion.id == OpsEvalRun.agent_version_id)
        .join(OpsAgent, OpsAgent.id == OpsAgentVersion.agent_id)
        .where(OpsEvalRun.organization_id == org)
        .order_by(OpsEvalRun.finished_at.desc())
        .limit(50)
    ).all()
    out = [
        PortalEvaluation(
            agent=a.name,
            dataset=d.name,
            dataset_version=d.version,
            agent_version=v.number,
            passed=r.passed,
            total=r.total,
            simulated=r.simulated,
            finished_at=r.finished_at,
        )
        for r, d, v, a in rows
    ]
    _viewed(db, principal, "evaluations")
    return out


@client.get("/incidents", response_model=list[PortalIncident])
def incidents(principal: Client, db: DbSession, response: Response) -> list[PortalIncident]:
    response.headers["Cache-Control"] = "no-store"
    rows = db.scalars(
        select(OpsIncident)
        .where(OpsIncident.organization_id == principal.organization_id)
        .order_by(OpsIncident.number.desc())
    )
    out = [PortalIncident.model_validate(i, from_attributes=True) for i in rows]
    _viewed(db, principal, "incidents")
    return out


@client.get("/incidents/{number}", response_model=PortalIncidentDetail)
def incident(
    number: Annotated[int, Path(ge=1, le=10_000_000)], principal: Client, db: DbSession, response: Response
) -> PortalIncidentDetail:
    response.headers["Cache-Control"] = "no-store"
    row = db.scalar(
        select(OpsIncident).where(
            OpsIncident.organization_id == principal.organization_id, OpsIncident.number == number
        )
    )
    if row is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")
    events = db.scalars(
        select(OpsIncidentEvent)
        .where(OpsIncidentEvent.incident_id == row.id, OpsIncidentEvent.kind.in_(["created", "status"]))
        .order_by(OpsIncidentEvent.created_at)
    )
    history = [StatusStep(from_status=e.from_status, to_status=e.to_status, at=e.created_at) for e in events]
    _viewed(db, principal, f"incident:{number}")
    return PortalIncidentDetail(
        **PortalIncident.model_validate(row, from_attributes=True).model_dump(), history=history
    )
