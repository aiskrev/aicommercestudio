"""Release blockers that must be resolved in code (not by a setting) before a feature may go live in production.

A blocker is closed by a code change that fixes the problem AND sets its constant to True in the same commit; the
production configuration guard (app/config.py) refuses to start while a blocker for an enabled feature is open.
"""

from __future__ import annotations

# BLOCKER-ACC-HEADER-01 (docs/ACCOUNTS_RELEASE_CHECKLIST.md, docs/ACCESSIBILITY.md)
# With customer accounts on, the Bulgarian header is wider than the screen at 1024 px (~14 px) and 1440 px (~150 px):
# with accounts off only ~19 px are free between 1280 and 1440 px, so the sign-in and sign-up links do not fit without
# a design decision (move the consultation button or the account links into a menu). The browser test
# `responsive-legal.spec.ts › KNOWN DEFECT BLOCKER-ACC-HEADER-01: …` is marked test.fail() until it is fixed.
ACCOUNT_HEADER_LAYOUT_FIXED = False


def open_blockers(*, customer_accounts_enabled: bool) -> list[str]:
    blockers: list[str] = []
    if customer_accounts_enabled and not ACCOUNT_HEADER_LAYOUT_FIXED:
        blockers.append(
            "BLOCKER-ACC-HEADER-01: the Bulgarian header overflows with accounts on "
            "(docs/ACCOUNTS_RELEASE_CHECKLIST.md)"
        )
    return blockers
