"""Privacy and access logging of the commercial areas (Phase 16): who read what, and the retention job that actually runs."""

# ruff: noqa: E501, F811  (long, readable assertions; fixtures imported from the project tests are used as arguments)
from __future__ import annotations

from sqlalchemy import func, select, text

from app.models import AuditLog
from tests.test_project_documents import ADMIN, active_project, docs, published_document, stored_files  # noqa: F401
from tests.test_projects import configured_lead, customer, inbox  # noqa: F401


def test_a_staff_member_reading_a_customer_project_is_logged_once_per_window_with_ids_only(
    customer, admin_client, configured_lead, db, docs
):
    project = active_project(admin_client, configured_lead)
    for _ in range(3):
        assert admin_client.get(f"{ADMIN}/projects/{project['id']}").status_code == 200
    rows = db.scalars(select(AuditLog).where(AuditLog.action == "project.viewed")).all()
    assert len(rows) == 1 and rows[0].entity_id == project["id"] and rows[0].actor_id is not None
    assert set(rows[0].details) == {"reference"}
    for _ in range(2):
        assert admin_client.get(f"{ADMIN}/projects/{project['id']}/documents").status_code == 200
    listed = db.scalars(select(AuditLog).where(AuditLog.action == "project_document.listed")).all()
    assert len(listed) == 1 and listed[0].entity_id == project["id"]
    # After the window the next read is logged again.
    db.execute(text("UPDATE audit_logs SET created_at = now() - interval '1 hour' WHERE action = 'project.viewed'"))
    db.commit()
    admin_client.get(f"{ADMIN}/projects/{project['id']}")
    assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "project.viewed")) == 2


def test_an_editor_or_viewer_reading_a_project_is_refused_and_leaves_no_view_entry(
    customer, admin_client, configured_lead, db, docs
):
    from tests.test_catalogue_api import staff_client

    project = active_project(admin_client, configured_lead)
    viewer = staff_client(db, "privacy.viewer@example.com", "viewer")
    assert viewer.get(f"{ADMIN}/projects/{project['id']}").status_code == 403
    assert viewer.get(f"{ADMIN}/projects/{project['id']}/documents").status_code == 403
    assert (
        db.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.action.in_(("project.viewed", "project_document.listed")))
        )
        == 0
    )


def test_the_scheduled_maintenance_removes_expired_document_files_and_the_dry_run_only_counts_them(
    customer, admin_client, configured_lead, db, docs, capsys
):
    from app.cli import main

    project = active_project(admin_client, configured_lead)
    published_document(admin_client, project["id"])
    db.execute(text("UPDATE project_documents SET retain_until = now() - interval '1 day'"))
    db.commit()
    assert len(stored_files(docs)) == 1
    assert main(["maintenance", "--dry-run"]) == 0
    assert "project_document_files=1" in capsys.readouterr().out and len(stored_files(docs)) == 1
    assert main(["maintenance"]) == 0
    assert "project_document_files=1" in capsys.readouterr().out and stored_files(docs) == []
    db.expire_all()
    assert (
        db.scalar(text("SELECT count(*) FROM project_document_versions WHERE purged_at IS NOT NULL")) == 1
    )  # the record stays
    assert main(["maintenance"]) == 0
    assert "project_document_files=0" in capsys.readouterr().out
