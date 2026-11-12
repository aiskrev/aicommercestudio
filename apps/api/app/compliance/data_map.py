"""Data map of the commercial expansion (docs/SECURITY_GDPR_REVIEW_COMMERCIAL.md).

One entry for every table added by migrations 0026 to 0032: what personal data it can hold, who owns it, who can read it,
how it is erased, how the person gets it back and how long it is kept. A test (`tests/test_data_map.py`) fails when a table
created by those migrations has no entry, and checks the claims that can be checked in code: a table that "goes with its
lead" has a cascading foreign key to leads, one that "goes with its project" has one to the project, one that "expires" has
an `expires_at` column, and a retention job named here exists as a command.

It is a map, not a mechanism: the erasure and export code lives in `app/compliance/service.py` and the retention jobs in
`app/cli.py`. Adding a table without an entry is the one thing that cannot happen unnoticed.
"""

# ruff: noqa: E501  (a table of prose cells)
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Entry:
    # "none": no personal data; "indirect": ids and text a person could be recognised by; "direct": names, contact details.
    personal: str
    holder: str
    visible_to: str
    # "cascade_lead", "cascade_project", "cascade_document", "cascade_basket", "expires", "anonymise_account" or "contractual"
    erasure: str
    # Where the person gets their data: "account_export", "lead_data_request" or "none"
    export: str
    retention: str
    # The command that applies the retention, when there is one.
    job: str | None = None


DATA_MAP: dict[str, Entry] = {
    "quote_baskets": Entry(
        "none",
        "an anonymous visitor (a secret token, only its hash is stored)",
        "nobody but the visitor and, after sending, staff through the enquiry",
        "expires",
        "none",
        "30 days after the last change as a draft, 1 day after it was sent",
        "maintenance",
    ),
    "quotations": Entry(
        "indirect",
        "the enquiry (the contact who answered gives a name and a short note)",
        "administrators",
        "cascade_lead",
        "lead_data_request",
        "with the enquiry (lead retention); an accepted quotation also lives on as the scope of a project",
        "maintenance",
    ),
    "commercial_projects": Entry(
        "indirect",
        "a customer workspace (title, summary and a copy of the approved scope)",
        "the workspace's members (not drafts); administrators",
        "anonymise_account",
        "account_export",
        "kept as a contractual record; the period is the owner's and the accountant's decision (D-28)",
    ),
    "project_milestones": Entry(
        "none",
        "a commercial project",
        "as the project",
        "cascade_project",
        "account_export",
        "as the project",
    ),
    "project_events": Entry(
        "direct",
        "a commercial project (the customer's own messages and the team's replies)",
        "the workspace's members for client-visible entries; administrators for all",
        "anonymise_account",
        "account_export",
        "as the project; the customer's own text becomes '[erased]' on erasure",
    ),
    "project_documents": Entry(
        "indirect",
        "a commercial project (titles; the files are the customer's or the team's work)",
        "the workspace's members for published documents; administrators",
        "cascade_project",
        "account_export",
        "`retain_until` (730 days by default); the stored bytes are deleted by the job, the records stay",
        "maintenance",
    ),
    "project_document_versions": Entry(
        "indirect",
        "a project document (a file name, a checksum and a storage key; the file itself is outside the database)",
        "as the document",
        "cascade_document",
        "account_export",
        "bytes deleted at `retain_until` unless a decision is open; the record stays",
        "maintenance",
    ),
    "document_approvals": Entry(
        "indirect",
        "a project document (who decided, which version, what, when)",
        "the workspace's members; administrators",
        "cascade_project",
        "account_export",
        "kept with the project: an approval is a record of a decision",
    ),
    "document_comments": Entry(
        "direct",
        "a project document (feedback written by the customer or the team)",
        "the workspace's members; administrators",
        "cascade_document",
        "account_export",
        "as the document; the customer's own text becomes '[erased]' on erasure",
    ),
    "lead_tasks": Entry(
        "indirect",
        "an enquiry (a short staff-written title, a date and an assignee)",
        "administrators only",
        "cascade_lead",
        "lead_data_request",
        "with the enquiry; a task is cancelled, never deleted",
        "maintenance",
    ),
}

#: The tables the map must cover: those created by migrations 0026 to 0032 (found by the test from the migration files).
FIRST_COMMERCIAL_REVISION = 26
