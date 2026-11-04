"""Transaction-local tenant context for PostgreSQL row-level security.

`bind(db, organization_id=…, user_id=…)` marks a request's session as tenant-scoped. From then on,
every transaction of that session starts with

    SET LOCAL ROLE acs_app_runtime;
    SELECT set_config('app.ops_org', '<org>', true), set_config('app.ops_user', '<user>', true);

`acs_app_runtime` is a NOLOGIN, NOBYPASSRLS role that owns nothing (migration 0013), so the policies
`organization_id = ops_current_org()` apply to every statement: a query that forgot its tenant filter
still sees only the bound organisation, and a write into another organisation fails WITH CHECK.
Both settings and the role are transaction-local (`SET LOCAL`, `set_config(..., true)`), so they can
never leak to the next request on a pooled connection.

The API connects as `acs_app_api` (migration 0018), which has no privilege on tenant tables: an
unbound query fails instead of returning data. A staff member's memberships are read with a user-only
binding. Portal identities, which are needed before the tenant is known (a sign-in, a session or a
one-time link), are read through `bootstrap()`. Migrations and the CLI run as the schema owner. This is
the single place that switches roles.
"""

from __future__ import annotations

import uuid

from sqlalchemy import event, text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session, SessionTransaction

RUNTIME_ROLE = "acs_app_runtime"
BOOTSTRAP_ROLE = "acs_app_bootstrap"
_SCOPE = "ops_rls_scope"


def _apply(connection: Connection, scope: dict[str, str]) -> None:
    connection.exec_driver_sql(f"SET LOCAL ROLE {scope['role']}")
    connection.execute(
        text("SELECT set_config('app.ops_org', :org, true), set_config('app.ops_user', :user, true)"),
        {"org": scope["org"], "user": scope["user"]},
    )


@event.listens_for(Session, "after_begin")
def _after_begin(session: Session, transaction: SessionTransaction, connection: Connection) -> None:
    scope = session.info.get(_SCOPE)
    if scope:
        _apply(connection, scope)


def bind(db: Session, *, organization_id: uuid.UUID | None = None, user_id: uuid.UUID | None = None) -> None:
    """Scope the rest of this session to one organisation (and/or one staff user)."""
    _scope(
        db,
        {
            "role": RUNTIME_ROLE,
            "org": str(organization_id) if organization_id else "",
            "user": str(user_id) if user_id else "",
        },
    )


def bootstrap(db: Session) -> None:
    """Read portal identities before the tenant is known. `bind()` replaces this once it is."""
    _scope(db, {"role": BOOTSTRAP_ROLE, "org": "", "user": ""})


def _scope(db: Session, scope: dict[str, str]) -> None:
    db.info[_SCOPE] = scope
    if db.in_transaction():
        _apply(db.connection(), scope)


def is_bound(db: Session) -> bool:
    return bool(db.info.get(_SCOPE))
