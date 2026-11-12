"""The data map of the commercial expansion covers every table it created, and its claims hold."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.cli import main as cli_main  # noqa: F401  (the commands named in the map)
from app.compliance.data_map import DATA_MAP, FIRST_COMMERCIAL_REVISION
from app.db import Base

VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"
ENTRIES = {"none", "indirect", "direct"}
ERASURE = {
    "cascade_lead",
    "cascade_project",
    "cascade_document",
    "cascade_basket",
    "expires",
    "anonymise_account",
    "contractual",
}
EXPORT = {"account_export", "lead_data_request", "none"}


def commercial_tables() -> set[str]:
    found: set[str] = set()
    for path in sorted(VERSIONS.glob("*.py")):
        match = re.match(r"\d{8}_(\d{4})_", path.name)
        if match and int(match.group(1)) >= FIRST_COMMERCIAL_REVISION:
            found.update(re.findall(r'op\.create_table\(\s*"([a-z_]+)"', path.read_text(encoding="utf-8")))
    return found


def foreign_keys(table: str) -> list[tuple[str, str | None]]:
    metadata_table = Base.metadata.tables[table]
    return [(fk.column.table.name, fk.ondelete) for column in metadata_table.columns for fk in column.foreign_keys]


def test_every_table_of_the_commercial_expansion_has_an_entry_and_none_is_stale():
    tables = commercial_tables()
    # Billing offers got a column (0032), not a table; the demonstrations store nothing: neither needs an entry.
    assert tables, "the migrations were not found"
    assert tables - set(DATA_MAP) == set(), "a table without a data-map entry"
    assert set(DATA_MAP) - tables == set(), "an entry for a table that does not exist"
    assert set(DATA_MAP) <= set(Base.metadata.tables)


def test_the_entries_use_known_words_and_say_something():
    for name, entry in DATA_MAP.items():
        assert entry.personal in ENTRIES and entry.erasure in ERASURE and entry.export in EXPORT, name
        assert all(len(text) > 8 for text in (entry.holder, entry.visible_to, entry.retention)), name


@pytest.mark.parametrize("name", sorted(DATA_MAP))
def test_the_claims_of_an_entry_can_be_checked_in_the_schema(name):
    entry = DATA_MAP[name]
    keys = foreign_keys(name)
    if entry.erasure == "cascade_lead":
        assert ("leads", "CASCADE") in keys, f"{name} does not go with its lead"
    if entry.erasure == "cascade_project":
        assert ("commercial_projects", "CASCADE") in keys, f"{name} does not go with its project"
    if entry.erasure == "cascade_document":
        assert ("project_documents", "CASCADE") in keys, f"{name} does not go with its document"
    if entry.erasure == "expires":
        assert "expires_at" in Base.metadata.tables[name].columns, f"{name} has no expiry"
    if entry.job:
        # The job is a part of the maintenance command, which a test below runs in dry-run mode.
        assert entry.job == "maintenance"


def test_the_maintenance_command_covers_what_the_map_says_it_does(db, capsys, tmp_path, monkeypatch):
    """The scheduled command reports every job the map names (dry run: it deletes nothing)."""
    from app.cli import main
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "project_storage_dir", str(tmp_path / "files"))
    assert main(["maintenance", "--dry-run"]) == 0
    output = capsys.readouterr().out
    for word in ("quote_baskets=", "project_document_files=", "leads="):
        assert word in output, word
