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


# BLOCKER-COM-STORAGE-01 (docs/COOKIE_AUDIT.md, docs/COMMERCIAL_EXPANSION_DECISIONS.md D-15) - CLOSED 2026-11-13.
# The project configurator keeps the visitor's answers in sessionStorage (`acs.configurator.<version>`) and the quote
# basket keeps a secret token in localStorage (`acs.quote-basket`). Neither holds personal data and both exist only
# after the visitor uses the feature. Closed in the change that added both keys to section 2 of the cookie policy
# (BG and EN) and refreshed its registry hashes; the owner approved the wording by merging it (the owner reported on
# 2026-11-13 that the lawyer had agreed). The registry still says `pending_lawyer_review` for the whole document:
# this constant does not stand in for the lawyer's signature on the exact text, it only lets the two features start.
COMMERCIAL_STORAGE_DISCLOSED = True


# BLOCKER-COM-ACCEPT-01 (docs/QUOTATIONS.md, docs/COMMERCIAL_EXPANSION_DECISIONS.md D-06) - OPEN.
# A client can answer a published quotation with "we want to proceed" or "we decline". What that answer means in law
# (an expression of intent, or acceptance that forms a contract) and the exact wording next to the button are for the
# owner and a lawyer to decide. Until then the page says the answer does not replace a written contract, and the
# feature stays out of production. Set to True in the change that records the approved wording.
QUOTATION_ACCEPTANCE_WORDING_APPROVED = False


# BLOCKER-COM-UPLOAD-01 (docs/PROJECT_DOCUMENTS.md, docs/COMMERCIAL_EXPANSION_DECISIONS.md D-31) - OPEN.
# Uploading files is the riskiest feature of the customer area. The code checks the type by name and by content, limits
# the size, stores files privately and authorizes every download, but no malware scanner is connected, the upload
# policy (types, sizes, retention) is the owner's decision and the security review of uploads is not recorded. Until
# then uploads stay out of production. Set to True in the change that records the review and the policy.
PROJECT_UPLOAD_REVIEW_APPROVED = False


def open_blockers(
    *,
    customer_accounts_enabled: bool,
    project_configurator_enabled: bool = False,
    quote_basket_enabled: bool = False,
    quotations_enabled: bool = False,
    project_uploads_enabled: bool = False,
) -> list[str]:
    blockers: list[str] = []
    if quotations_enabled and not QUOTATION_ACCEPTANCE_WORDING_APPROVED:
        blockers.append(
            "BLOCKER-COM-ACCEPT-01: the wording and the legal meaning of a client's answer to a quotation are not "
            "approved (docs/QUOTATIONS.md)"
        )
    if (project_configurator_enabled or quote_basket_enabled) and not COMMERCIAL_STORAGE_DISCLOSED:
        blockers.append(
            "BLOCKER-COM-STORAGE-01: the cookie policy does not yet describe the browser storage of the project "
            "configurator and the quote basket (docs/COOKIE_AUDIT.md)"
        )
    if project_uploads_enabled and not PROJECT_UPLOAD_REVIEW_APPROVED:
        blockers.append(
            "BLOCKER-COM-UPLOAD-01: the security review and the policy for project file uploads are not recorded "
            "(docs/PROJECT_DOCUMENTS.md)"
        )
    if customer_accounts_enabled and not ACCOUNT_HEADER_LAYOUT_FIXED:
        blockers.append(
            "BLOCKER-ACC-HEADER-01: the Bulgarian header overflows with accounts on "
            "(docs/ACCOUNTS_RELEASE_CHECKLIST.md)"
        )
    return blockers
