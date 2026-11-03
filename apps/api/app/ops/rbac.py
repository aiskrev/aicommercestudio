"""Role-based access control for the AI operations portal (organisation-scoped roles).

The matrix is the single source of truth: routes declare the permission they need and never test
roles directly. Documented in docs/AI_OPERATIONS_PORTAL.md (RBAC matrix) and tested for completeness
(every permission is granted to owners, every route declares one).

Separation of duties: operators prepare (drafts, datasets, imports, incidents, changes); reviewers
decide (approve versions and changes, label results, review incidents). Owners and admins can do
both, but a decision on their own sensitive work still needs a second person (enforced per module).
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
    REGISTRY_READ = "registry.read"
    REGISTRY_WRITE = "registry.write"
    REGISTRY_APPROVE = "registry.approve"
    EVALS_READ = "evals.read"
    EVALS_WRITE = "evals.write"
    EVALS_LABEL = "evals.label"
    OBSERVABILITY_READ = "observability.read"
    OBSERVABILITY_WRITE = "observability.write"
    INCIDENTS_READ = "incidents.read"
    INCIDENTS_WRITE = "incidents.write"
    INCIDENTS_REVIEW = "incidents.review"
    CHANGES_READ = "changes.read"
    CHANGES_WRITE = "changes.write"
    CHANGES_APPROVE = "changes.approve"
    PORTAL_USERS_READ = "portal_users.read"
    PORTAL_USERS_WRITE = "portal_users.write"


_READ = frozenset(
    {
        Permission.ORG_READ,
        Permission.WORKSPACES_READ,
        Permission.AGENTS_READ,
        Permission.REGISTRY_READ,
        Permission.EVALS_READ,
        Permission.OBSERVABILITY_READ,
        Permission.INCIDENTS_READ,
        Permission.CHANGES_READ,
    }
)

ROLE_PERMISSIONS: dict[OpsRole, frozenset[Permission]] = {
    OpsRole.OWNER: frozenset(Permission),
    OpsRole.ADMIN: frozenset(Permission),
    OpsRole.OPERATOR: _READ
    | {
        Permission.AGENTS_WRITE,
        Permission.REGISTRY_WRITE,
        Permission.EVALS_WRITE,
        Permission.OBSERVABILITY_WRITE,
        Permission.INCIDENTS_WRITE,
        Permission.CHANGES_WRITE,
    },
    OpsRole.REVIEWER: _READ
    | {Permission.REGISTRY_APPROVE, Permission.EVALS_LABEL, Permission.INCIDENTS_REVIEW, Permission.CHANGES_APPROVE},
    OpsRole.VIEWER: _READ,
}

#: Everything that changes data (blocked for suspended organisations).
WRITE_PERMISSIONS = frozenset(p for p in Permission if not p.value.endswith(".read"))

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
