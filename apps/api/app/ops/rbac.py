"""Role-based access control for the AI operations portal (organisation-scoped roles).

The matrix is the single source of truth: routes declare the permission they need and never test
roles directly. Documented in docs/AI_OPERATIONS_PORTAL.md (RBAC matrix), including the permissions
reserved for later modules.
"""

from __future__ import annotations

import enum

from app.models import OpsRole


class Permission(enum.StrEnum):
    ORG_READ = "org.read"
    WORKSPACES_READ = "workspaces.read"
    WORKSPACES_WRITE = "workspaces.write"
    AGENTS_READ = "agents.read"
    AGENTS_WRITE = "agents.write"
    MEMBERS_READ = "members.read"
    MEMBERS_WRITE = "members.write"
    AUDIT_READ = "audit.read"


_READ = {Permission.ORG_READ, Permission.WORKSPACES_READ, Permission.AGENTS_READ}

ROLE_PERMISSIONS: dict[OpsRole, frozenset[Permission]] = {
    OpsRole.OWNER: frozenset(Permission),
    OpsRole.ADMIN: frozenset(Permission),
    OpsRole.OPERATOR: frozenset(_READ | {Permission.AGENTS_WRITE}),
    # Reviewers will additionally decide human-review items (V2); today they read like viewers.
    OpsRole.REVIEWER: frozenset(_READ),
    OpsRole.VIEWER: frozenset(_READ),
}

WRITE_PERMISSIONS = frozenset(p for p in Permission if p.value.endswith(".write"))

# Higher rank may manage lower or equal ranks; only owners manage owners.
ROLE_RANK: dict[OpsRole, int] = {
    OpsRole.VIEWER: 1,
    OpsRole.REVIEWER: 2,
    OpsRole.OPERATOR: 3,
    OpsRole.ADMIN: 4,
    OpsRole.OWNER: 5,
}


def can(role: OpsRole | str, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS[OpsRole(role)]


def can_assign(actor: OpsRole | str, target: OpsRole | str) -> bool:
    """Whether `actor` may give someone the role `target` (or change/remove someone who has it)."""
    actor, target = OpsRole(actor), OpsRole(target)
    if not can(actor, Permission.MEMBERS_WRITE):
        return False
    if target is OpsRole.OWNER:
        return actor is OpsRole.OWNER
    return ROLE_RANK[actor] >= ROLE_RANK[target]
