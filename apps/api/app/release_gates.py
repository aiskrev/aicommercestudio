"""Release blockers that must be resolved in code (not by a setting) before a feature may go live in production.

A blocker is closed by a code change that fixes the problem AND sets its constant to True in the same commit; the
production configuration guard (app/config.py) refuses to start while a blocker for an enabled feature is open.
"""

from __future__ import annotations

# BLOCKER-ACC-HEADER-01 (docs/ACCOUNTS_RELEASE_CHECKLIST.md, docs/ACCESSIBILITY.md) - CLOSED 2026-11-11.
# With customer accounts on, the Bulgarian header was wider than the screen at 1024 px (~14 px) and 1440 px (~150 px).
# Fixed in the same change that set this constant: the desktop bar shows one compact sign-in control instead of a text
# link plus a sign-up button (components/layout/AccountEntry.tsx), and the bar gaps are tighter at the lg breakpoint.
# The browser test `responsive-legal.spec.ts > BLOCKER-ACC-HEADER-01: ...` now runs without test.fail() and keeps it
# fixed. The layout choice itself is recorded for the owner as D-01 in docs/COMMERCIAL_EXPANSION_DECISIONS.md.
ACCOUNT_HEADER_LAYOUT_FIXED = True


# BLOCKER-COM-STORAGE-01 (docs/COOKIE_AUDIT.md, docs/COMMERCIAL_EXPANSION_DECISIONS.md D-15) - OPEN.
# The project configurator keeps the visitor's answers in sessionStorage (`acs.configurator.<version>`) and the quote
# basket keeps a secret token in localStorage (`acs.quote-basket`). Neither holds personal data and both exist only
# after the visitor uses the feature, but the published cookie policy (a draft awaiting a lawyer) describes the
# browser storage the site uses and does not mention them yet. The policy text must be updated and approved first;
# then set this constant to True in the same change that updates the policy and its registry entry.
COMMERCIAL_STORAGE_DISCLOSED = False


def open_blockers(
    *,
    customer_accounts_enabled: bool,
    project_configurator_enabled: bool = False,
    quote_basket_enabled: bool = False,
) -> list[str]:
    blockers: list[str] = []
    if (project_configurator_enabled or quote_basket_enabled) and not COMMERCIAL_STORAGE_DISCLOSED:
        blockers.append(
            "BLOCKER-COM-STORAGE-01: the cookie policy does not yet describe the browser storage of the project "
            "configurator and the quote basket (docs/COOKIE_AUDIT.md)"
        )
    if customer_accounts_enabled and not ACCOUNT_HEADER_LAYOUT_FIXED:
        blockers.append(
            "BLOCKER-ACC-HEADER-01: the Bulgarian header overflows with accounts on "
            "(docs/ACCOUNTS_RELEASE_CHECKLIST.md)"
        )
    return blockers
