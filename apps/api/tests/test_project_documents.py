"""Project documents (app/projects/documents.py): upload, versions, publication, download, approvals, feedback."""

# ruff: noqa: E501, F811  (long, readable assertions; fixtures imported from test_projects are used as arguments)
from __future__ import annotations

import io
import zipfile
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app import release_gates
from app.accounts.models import CustomerAccount
from app.compliance import service as compliance_service
from app.config import Settings, get_settings
from app.models import AuditLog
from app.projects import documents, storage
from app.projects.doc_models import (
    DocumentApproval,
    DocumentComment,
    ProjectDocument,
    ProjectDocumentVersion,
)
from app.projects.models import CommercialProject, ProjectEvent
from app.workspace.models import CustomerWorkspace, WorkspaceMember
from tests.test_projects import (  # noqa: F401  (fixtures and helpers shared with the project tests)
    API,
    CUSTOMER,
    another_customer,
    configured_lead,
    csrf,
    customer,
    inbox,
    make_project,
    move,
    signup,
)
from tests.test_security import _production

ADMIN = "/api/admin"
OCTET = "application/octet-stream"


def pdf(tag: str = "a") -> bytes:
    return b"%PDF-1.7\n1 0 obj\n<< /Note (" + tag.encode() + b") >>\nendobj\n%%EOF\n"


def ooxml(part: str = "word/document.xml", extra: tuple[str, ...] = ()) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr(part, "<doc/>")
        for name in extra:
            archive.writestr(name, "x")
    return buffer.getvalue()


@pytest.fixture
def docs(customer, inbox, monkeypatch, tmp_path):
    """Documents, staff uploads and customer uploads on, a private directory of their own, scanning not required."""
    settings = get_settings()
    monkeypatch.setattr(settings, "project_documents_enabled", True)
    monkeypatch.setattr(settings, "project_uploads_enabled", True)
    monkeypatch.setattr(settings, "project_client_uploads_enabled", True)
    monkeypatch.setattr(settings, "project_upload_require_scan", False)
    monkeypatch.setattr(settings, "project_storage_dir", str(tmp_path / "files"))
    monkeypatch.setattr(settings, "project_upload_rate_limit", 500)
    monkeypatch.setattr(settings, "project_download_rate_limit", 500)
    monkeypatch.setattr(settings, "project_read_rate_limit", 500)
    return tmp_path / "files"


def headers(
    filename: str, title: str | None = None, category: str | None = None, note: str | None = None, expected=None
):
    out = {"content-type": OCTET, "x-file-name": quote(filename)}
    if title is not None:
        out["x-document-title"] = quote(title)
    if category is not None:
        out["x-document-category"] = category
    if note is not None:
        out["x-version-note"] = quote(note)
    if expected is not None:
        out["x-expected-version"] = str(expected)
    return out


def active_project(admin_client, lead, **overrides) -> dict:
    project = make_project(admin_client, lead, **overrides)
    response = move(admin_client, project, "quotation")
    assert response.status_code == 200, response.text
    return response.json()


def staff_upload(
    admin_client, project_id, data=None, filename="plan.pdf", title="Дизайн на сайта", category="design", **kw
):
    return admin_client.post(
        f"{ADMIN}/projects/{project_id}/documents",
        content=pdf() if data is None else data,
        headers=headers(filename, title, category, **kw),
    )


def staff_version(admin_client, project_id, document_id, data, filename="plan.pdf", expected=None, note=None):
    return admin_client.post(
        f"{ADMIN}/projects/{project_id}/documents/{document_id}/versions",
        content=data,
        headers=headers(filename, expected=expected, note=note),
    )


def staff_docs(admin_client, project_id) -> list[dict]:
    return admin_client.get(f"{ADMIN}/projects/{project_id}/documents").json()["documents"]


def publish(admin_client, project_id, document_id, number=1):
    return admin_client.post(f"{ADMIN}/projects/{project_id}/documents/{document_id}/versions/{number}/publish")


def published_document(admin_client, project_id, **kw) -> dict:
    response = staff_upload(admin_client, project_id, **kw)
    assert response.status_code == 201, response.text
    document = response.json()["documents"][-1]
    assert publish(admin_client, project_id, document["id"]).status_code == 200
    return document


def request_approval(admin_client, project_id, document_id, number=1, message=None):
    return admin_client.post(
        f"{ADMIN}/projects/{project_id}/documents/{document_id}/versions/{number}/approvals",
        json={"message": message} if message else {},
    )


def customer_docs(client, project_id, extra=None) -> dict:
    response = client.get(f"{API}/{project_id}/documents", headers=extra or {})
    assert response.status_code == 200, response.text
    return response.json()


def decide(client, project_id, approval_id, decision, version, comment=None, extra=None):
    body = {"expected_version": version, "decision": decision, **({"comment": comment} if comment else {})}
    return client.post(
        f"{API}/{project_id}/approvals/{approval_id}/decision", json=body, headers={**csrf(client), **(extra or {})}
    )


def client_upload(client, project_id, data, filename="brief.pdf", title="Задание", category="brief", extra=None, **kw):
    return client.post(
        f"{API}/{project_id}/documents",
        content=data,
        headers={**csrf(client), **headers(filename, title, category, **kw), **(extra or {})},
    )


def stored_files(root) -> list:
    return [p for p in root.rglob("*") if p.is_file()] if root.exists() else []


# --- Flags and the release gate ---------------------------------------------------------------------------


def test_everything_answers_404_while_documents_are_off(customer, admin_client, configured_lead, monkeypatch, inbox):
    project = active_project(admin_client, configured_lead)
    settings = get_settings()
    assert (
        settings.project_documents_enabled is False
        and Settings.model_fields["project_uploads_enabled"].default is False
    )
    assert Settings.model_fields["project_client_uploads_enabled"].default is False
    assert customer.get(f"{API}/{project['id']}/documents").status_code == 404
    assert admin_client.get(f"{ADMIN}/projects/{project['id']}/documents").status_code == 404
    assert staff_upload(admin_client, project["id"]).status_code == 404


def test_uploads_have_flags_of_their_own(customer, admin_client, configured_lead, docs, monkeypatch):
    project = active_project(admin_client, configured_lead)
    monkeypatch.setattr(get_settings(), "project_uploads_enabled", False)
    assert staff_upload(admin_client, project["id"]).status_code == 404
    assert client_upload(customer, project["id"], pdf()).status_code == 404
    assert (
        admin_client.get(f"{ADMIN}/projects/{project['id']}/documents").status_code == 200
    )  # listing needs documents only
    limits = customer_docs(customer, project["id"])["limits"]
    assert limits["upload"] is False and limits["client_upload"] is False
    monkeypatch.setattr(get_settings(), "project_uploads_enabled", True)
    monkeypatch.setattr(get_settings(), "project_client_uploads_enabled", False)
    assert staff_upload(admin_client, project["id"]).status_code == 201
    assert client_upload(customer, project["id"], pdf()).status_code == 404
    assert customer_docs(customer, project["id"])["limits"]["client_upload"] is False


def test_production_refuses_documents_without_projects_and_uploads_without_the_review(monkeypatch):
    with pytest.raises(ValidationError, match="PROJECT_DOCUMENTS_ENABLED needs COMMERCIAL_PROJECTS_ENABLED"):
        _production(project_documents_enabled=True)
    with pytest.raises(ValidationError, match="PROJECT_UPLOADS_ENABLED needs PROJECT_DOCUMENTS_ENABLED"):
        _production(project_uploads_enabled=True)
    with pytest.raises(ValidationError, match="PROJECT_CLIENT_UPLOADS_ENABLED needs PROJECT_UPLOADS_ENABLED"):
        _production(project_client_uploads_enabled=True)
    assert release_gates.PROJECT_UPLOAD_REVIEW_APPROVED is False
    blockers = release_gates.open_blockers(customer_accounts_enabled=False, project_uploads_enabled=True)
    assert any(item.startswith("BLOCKER-COM-UPLOAD-01") for item in blockers)
    assert release_gates.open_blockers(customer_accounts_enabled=False, project_uploads_enabled=False) == []


# --- Staff upload, publication and the customer's view ----------------------------------------------------


def test_a_draft_is_invisible_until_an_administrator_publishes_it_and_then_the_bytes_match(
    customer, admin_client, configured_lead, docs
):
    project = active_project(admin_client, configured_lead)
    data = pdf("macket")
    response = staff_upload(admin_client, project["id"], data, filename="Макет v1.pdf", note="Първи вариант")
    assert response.status_code == 201, response.text
    document = response.json()["documents"][0]
    version = document["versions"][0]
    assert version["state"] == "draft" and version["number"] == 1 and version["filename"] == "Макет v1.pdf"
    assert (
        version["content_type"] == "application/pdf"
        and version["size_bytes"] == len(data)
        and len(version["sha256"]) == 64
    )

    assert customer_docs(customer, project["id"])["documents"] == []
    assert customer.get(f"{API}/{project['id']}/documents/{document['id']}/versions/1/download").status_code == 404

    assert publish(admin_client, project["id"], document["id"]).status_code == 200
    listed = customer_docs(customer, project["id"])["documents"]
    assert [d["title"] for d in listed] == ["Дизайн на сайта"] and listed[0]["versions"][0]["downloadable"] is True
    download = customer.get(f"{API}/{project['id']}/documents/{document['id']}/versions/1/download")
    assert download.status_code == 200 and download.content == data
    assert download.headers["content-type"] == "application/pdf"
    assert download.headers["content-disposition"].startswith("attachment;")
    assert "filename*=UTF-8''" + quote("Макет v1.pdf") in download.headers["content-disposition"]
    assert download.headers["x-content-type-options"] == "nosniff" and download.headers["cache-control"] == "no-store"
    assert "default-src 'none'" in download.headers["content-security-policy"]  # the API-wide policy: nothing runs
    # The customer sees the publication in the project history, without the staff member's name.
    history = customer.get(f"{API}/{project['id']}").json()["events"]
    assert any(
        e["kind"] == "delivery"
        and e["meta"] == {"action": "document_published", "document": "Дизайн на сайта", "version": 1}
        for e in history
    )


def test_publishing_twice_changes_nothing_and_a_withdrawn_version_is_gone_for_the_customer(
    customer, admin_client, configured_lead, docs, db
):
    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    again = publish(admin_client, project["id"], document["id"])
    assert again.status_code == 200
    assert db.scalar(select(func.count()).select_from(ProjectEvent).where(ProjectEvent.kind == "delivery")) == 1
    withdrawn = admin_client.post(f"{ADMIN}/projects/{project['id']}/documents/{document['id']}/versions/1/withdraw")
    assert withdrawn.status_code == 200
    assert customer_docs(customer, project["id"])["documents"] == []
    assert customer.get(f"{API}/{project['id']}/documents/{document['id']}/versions/1/download").status_code == 404
    refused = publish(admin_client, project["id"], document["id"])
    assert refused.status_code == 409 and refused.json()["code"] == "version_state"


def test_nothing_is_published_or_asked_on_a_draft_project(admin_client, configured_lead, docs):
    draft = make_project(admin_client, configured_lead)
    response = staff_upload(admin_client, draft["id"])
    assert response.status_code == 201  # staff may prepare documents before the customer sees the project
    document = response.json()["documents"][0]
    refused = publish(admin_client, draft["id"], document["id"])
    assert refused.status_code == 409 and refused.json()["code"] == "project_draft"


def test_only_an_administrator_changes_anything_and_staff_see_drafts(admin_client, configured_lead, docs, db):
    project = active_project(admin_client, configured_lead)
    document = staff_upload(admin_client, project["id"]).json()["documents"][0]
    from tests.test_catalogue_api import staff_client

    for role in ("viewer", "editor"):
        other = staff_client(db, f"{role}.docs@example.com", role)
        assert other.get(f"{ADMIN}/projects/{project['id']}/documents").status_code == 403  # customer data: admin only
        assert (
            other.get(f"{ADMIN}/projects/{project['id']}/documents/{document['id']}/versions/1/download").status_code
            == 403
        )
        assert (
            other.post(f"{ADMIN}/projects/{project['id']}/documents/{document['id']}/versions/1/publish").status_code
            == 403
        )
        assert (
            other.post(
                f"{ADMIN}/projects/{project['id']}/documents", content=pdf(), headers=headers("a.pdf", "T", "design")
            ).status_code
            == 403
        )
    assert staff_docs(admin_client, project["id"])[0]["versions"][0]["state"] == "draft"


# --- Who can do what: sessions, tenants, roles -------------------------------------------------------------


def test_nothing_works_without_the_right_session(customer, admin_client, configured_lead, docs, inbox):
    from app.main import app

    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    nobody = TestClient(app)
    base = f"{API}/{project['id']}"
    assert nobody.get(f"{base}/documents").status_code == 401
    assert nobody.get(f"{base}/documents/{document['id']}/versions/1/download").status_code == 401
    assert nobody.post(f"{base}/documents", content=pdf(), headers=headers("a.pdf", "T", "brief")).status_code == 401
    assert (
        nobody.post(
            f"{base}/approvals/{document['id']}/decision", json={"expected_version": 1, "decision": "approve"}
        ).status_code
        == 401
    )
    staff_base = f"{ADMIN}/projects/{project['id']}/documents"
    assert nobody.get(staff_base).status_code == 401
    assert nobody.post(staff_base, content=pdf(), headers=headers("a.pdf", "T", "design")).status_code in (401, 403)
    # A customer's own browser is not a staff session, and staff cookies do not open the customer routes.
    solo = another_customer(inbox, "solo.docs@example.com")
    assert solo.get(staff_base).status_code in (401, 403)
    assert solo.post(
        staff_base, content=pdf(), headers={**csrf(solo), **headers("a.pdf", "T", "design")}
    ).status_code in (401, 403)
    assert solo.get(f"{base}/documents").status_code == 404  # not their project


def test_a_post_without_the_csrf_header_is_refused(customer, admin_client, configured_lead, docs):
    project = active_project(admin_client, configured_lead)
    response = customer.post(f"{API}/{project['id']}/documents", content=pdf(), headers=headers("a.pdf", "T", "brief"))
    assert response.status_code in (401, 403)


def test_another_customer_and_another_project_see_nothing(customer, admin_client, configured_lead, docs, inbox, db):
    project = active_project(admin_client, configured_lead)
    other_project = active_project(admin_client, configured_lead, title="Друг проект")
    document = published_document(admin_client, project["id"])
    approval_doc = request_approval(admin_client, project["id"], document["id"], message="Моля, прегледайте")
    assert approval_doc.status_code == 201
    approval = approval_doc.json()["documents"][0]["versions"][0]["approval"]
    stranger = another_customer(inbox, "stranger.docs@example.com")

    base = f"{API}/{project['id']}"
    assert stranger.get(f"{base}/documents").status_code == 404
    assert stranger.get(f"{base}/documents/{document['id']}/versions/1/download").status_code == 404
    assert client_upload(stranger, project["id"], pdf()).status_code == 404
    assert decide(stranger, project["id"], approval["id"], "approve", 1).status_code == 404
    assert (
        stranger.post(
            f"{base}/documents/{document['id']}/comments",
            json={"version": 1, "body": "Здравейте"},
            headers=csrf(stranger),
        ).status_code
        == 404
    )

    # A document of one project is not reachable through another project of the same workspace.
    other = f"{API}/{other_project['id']}"
    assert customer.get(f"{other}/documents/{document['id']}/versions/1/download").status_code == 404
    assert decide(customer, other_project["id"], approval["id"], "approve", 1).status_code == 404
    assert (
        customer.post(
            f"{other}/documents/{document['id']}/comments",
            json={"version": 1, "body": "Здравейте"},
            headers=csrf(customer),
        ).status_code
        == 404
    )
    assert (
        admin_client.get(
            f"{ADMIN}/projects/{other_project['id']}/documents/{document['id']}/versions/1/download"
        ).status_code
        == 404
    )
    assert db.scalar(select(DocumentApproval.state).where(DocumentApproval.id == approval["id"])) == "pending"


def test_roles_decide_in_the_workspace_and_members_only_read_comment_and_upload(
    customer, admin_client, configured_lead, docs, inbox, db
):
    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    approval = request_approval(admin_client, project["id"], document["id"]).json()["documents"][0]["versions"][0][
        "approval"
    ]
    workspace = db.scalar(select(CustomerWorkspace))
    member = another_customer(inbox, "member.docs@example.com")
    billing = another_customer(inbox, "billing.docs@example.com")
    for email, role in (("member.docs@example.com", "member"), ("billing.docs@example.com", "billing")):
        account = db.scalar(select(CustomerAccount).where(CustomerAccount.email == email))
        db.add(WorkspaceMember(workspace_id=workspace.id, account_id=account.id, role=role))
    db.commit()
    header = {"X-Workspace": str(workspace.id)}

    view = customer_docs(member, project["id"], header)
    assert view["can_decide"] is False and customer_docs(billing, project["id"], header)["can_decide"] is True
    refused = decide(member, project["id"], approval["id"], "approve", 1, extra=header)
    assert refused.status_code == 403 and refused.json()["code"] == "role_not_allowed"
    commented = member.post(
        f"{API}/{project['id']}/documents/{document['id']}/comments",
        json={"version": 1, "body": "Харесва ми цветът"},
        headers={**csrf(member), **header},
    )
    assert commented.status_code == 201
    assert client_upload(member, project["id"], pdf("m"), extra=header).status_code == 201
    accepted = decide(billing, project["id"], approval["id"], "approve", 1, extra=header)
    assert accepted.status_code == 200
    row = db.get(DocumentApproval, approval["id"])
    db.refresh(row)
    assert row.state == "approved" and row.decided_by_account_id == db.scalar(
        select(CustomerAccount.id).where(CustomerAccount.email == "billing.docs@example.com")
    )


# --- File security ----------------------------------------------------------------------------------------


def test_an_oversized_file_is_refused_and_nothing_is_kept(
    customer, admin_client, configured_lead, docs, monkeypatch, db
):
    project = active_project(admin_client, configured_lead)
    monkeypatch.setattr(get_settings(), "project_upload_max_bytes", 1024)
    big = pdf() + b"x" * 2000
    response = staff_upload(admin_client, project["id"], big)
    assert response.status_code == 413 and response.json()["code"] == "file_too_large"
    declared = admin_client.post(
        f"{ADMIN}/projects/{project['id']}/documents",
        content=b"%PDF-1.7\n",
        headers={**headers("a.pdf", "T", "design"), "content-length": "999999"},
    )
    assert declared.status_code in (400, 413)
    assert client_upload(customer, project["id"], big).status_code == 413
    assert stored_files(docs) == [] and db.scalar(select(func.count()).select_from(ProjectDocumentVersion)) == 0
    assert db.scalar(select(func.count()).select_from(ProjectDocument)) == 0


@pytest.mark.parametrize(
    "filename",
    [
        "run.exe",
        "page.html",
        "image.svg",
        "script.js",
        "archive.zip",
        "macro.docm",
        "noextension",
        "a.pdf.exe",
        "..",
        ".pdf.",
        "shell.php",
    ],
)
def test_a_file_type_that_is_not_on_the_list_is_refused(admin_client, configured_lead, docs, filename):
    project = active_project(admin_client, configured_lead)
    response = staff_upload(admin_client, project["id"], pdf(), filename=filename)
    assert response.status_code == 422 and response.json()["code"] == "file_type_not_allowed", response.text
    assert stored_files(docs) == []


@pytest.mark.parametrize(
    ("filename", "data"),
    [
        ("fake.pdf", b"MZ\x90\x00 this is an executable"),
        ("fake.png", pdf()),
        ("fake.jpg", b"\x89PNG\r\n\x1a\n" + b"0" * 20),
        ("fake.webp", b"RIFF\x00\x00\x00\x00WAVE"),
        ("fake.docx", b"this is not a zip"),
        ("fake.docx", ooxml("xl/workbook.xml")),
        ("macro.docx", ooxml(extra=("word/vbaProject.bin",))),
        ("traversal.docx", ooxml(extra=("../evil.txt",))),
        ("nul.txt", b"hello\x00world"),
        ("latin.csv", "а,б\n".encode("cp1251")),
    ],
)
def test_a_file_whose_content_disagrees_with_its_name_is_refused(admin_client, configured_lead, docs, filename, data):
    project = active_project(admin_client, configured_lead)
    response = staff_upload(admin_client, project["id"], data, filename=filename)
    assert response.status_code == 422 and response.json()["code"] == "file_content_invalid", response.text
    assert stored_files(docs) == []


@pytest.mark.parametrize(
    ("filename", "data", "content_type"),
    [
        ("scan.png", b"\x89PNG\r\n\x1a\n" + b"0" * 20, "image/png"),
        ("photo.JPG", b"\xff\xd8\xff\xe0" + b"0" * 20, "image/jpeg"),
        ("pic.webp", b"RIFF\x04\x00\x00\x00WEBPVP8 ", "image/webp"),
        ("notes.txt", "Бележки за проекта\n".encode(), "text/plain"),
        ("readme.md", b"# Title\n", "text/markdown"),
        ("data.csv", b"a,b\n1,2\n", "text/csv"),
        ("offer.docx", ooxml(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ("sheet.xlsx", ooxml("xl/workbook.xml"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        (
            "deck.pptx",
            ooxml("ppt/presentation.xml"),
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ),
    ],
)
def test_the_allowed_types_are_accepted_and_the_stored_type_comes_from_the_check(
    admin_client, configured_lead, docs, filename, data, content_type
):
    project = active_project(admin_client, configured_lead)
    response = staff_upload(admin_client, project["id"], data, filename=filename)
    assert response.status_code == 201, response.text
    assert response.json()["documents"][0]["versions"][0]["content_type"] == content_type


def test_the_request_shape_is_checked_too(admin_client, configured_lead, docs):
    project = active_project(admin_client, configured_lead)
    url = f"{ADMIN}/projects/{project['id']}/documents"
    assert (
        admin_client.post(
            url, content=pdf(), headers={**headers("a.pdf", "T", "design"), "content-type": "application/pdf"}
        ).status_code
        == 415
    )
    assert (
        admin_client.post(
            url,
            content=pdf(),
            headers={"content-type": OCTET, "x-document-title": "T", "x-document-category": "design"},
        ).status_code
        == 422
    )
    assert staff_upload(admin_client, project["id"], b"", filename="empty.pdf").status_code == 422
    assert staff_upload(admin_client, project["id"], category="secret").status_code == 422
    assert staff_upload(admin_client, project["id"], title="").status_code == 422
    assert staff_upload(admin_client, project["id"], title="<script>alert(1)</script>").status_code == 422
    assert stored_files(docs) == []


def test_a_file_name_is_cleaned_and_storage_keys_cannot_walk_out(admin_client, configured_lead, docs, tmp_path):
    project = active_project(admin_client, configured_lead)
    response = staff_upload(admin_client, project["id"], pdf(), filename="..\\..\\etc/pass\x00wd:*?.pdf")
    assert response.status_code == 201
    name = response.json()["documents"][0]["versions"][0]["filename"]
    assert "/" not in name and "\\" not in name and "\x00" not in name and name.endswith(".pdf")
    files = stored_files(docs)
    assert len(files) == 1 and docs.resolve() in files[0].resolve().parents
    assert all(len(part) == 32 for part in files[0].relative_to(docs).parts)  # random hex only, never the file name

    store = storage.LocalPrivateStorage(tmp_path / "root")
    for bad in (
        "../escape",
        "a/b/c",
        "/etc/passwd",
        "x" * 32,
        "../" * 3 + "z" * 32,
        "g" * 32 + "/" + "0" * 32 + "/" + "0" * 32,
    ):
        with pytest.raises(storage.StorageError):
            store.put(bad, [b"data"], max_bytes=10)
        with pytest.raises(storage.StorageError):
            list(store.open(bad))
        with pytest.raises(storage.StorageError):
            store.delete(bad)
    assert not (tmp_path / "escape").exists() and stored_files(tmp_path / "root") == []
    good = "0" * 32 + "/" + "1" * 32 + "/" + "2" * 32
    size, digest = store.put(good, [b"da", b"ta"], max_bytes=10)
    assert size == 4 and len(digest) == 64 and b"".join(store.open(good)) == b"data"
    with pytest.raises(storage.TooLarge):
        store.put("0" * 32 + "/" + "1" * 32 + "/" + "3" * 32, [b"x" * 11], max_bytes=10)
    assert [p.name for p in (tmp_path / "root").rglob("*") if p.is_file()] == ["2" * 32]  # no partial file left behind
    assert store.delete(good) is True and store.delete(good) is False


def test_customer_downloads_are_attachments_even_for_images(customer, admin_client, configured_lead, docs):
    project = active_project(admin_client, configured_lead)
    document = published_document(
        admin_client, project["id"], data=b"\x89PNG\r\n\x1a\n" + b"1" * 30, filename="logo.png"
    )
    response = customer.get(f"{API}/{project['id']}/documents/{document['id']}/versions/1/download")
    assert response.headers["content-type"] == "image/png" and response.headers["content-disposition"].startswith(
        "attachment"
    )


# --- Versions, duplicates and conflicts -------------------------------------------------------------------


def test_versions_are_numbered_and_a_stale_or_missing_expected_version_is_a_conflict(
    admin_client, configured_lead, docs, db
):
    project = active_project(admin_client, configured_lead)
    document = staff_upload(admin_client, project["id"], pdf("one")).json()["documents"][0]
    url = (project["id"], document["id"])
    missing = staff_version(admin_client, *url, pdf("two"))
    assert missing.status_code == 409 and missing.json()["code"] == "version_conflict"
    wrong = staff_version(admin_client, *url, pdf("two"), expected=5)
    assert wrong.status_code == 409 and wrong.json()["code"] == "version_conflict"
    second = staff_version(admin_client, *url, pdf("two"), expected=1, note="Втори вариант")
    assert second.status_code == 201
    assert [v["number"] for v in second.json()["documents"][0]["versions"]] == [1, 2]
    stale = staff_version(admin_client, *url, pdf("three"), expected=1)  # someone else already added version 2
    assert stale.status_code == 409 and stale.json()["code"] == "version_conflict"
    assert db.scalar(select(func.count()).select_from(ProjectDocumentVersion)) == 2
    assert len(stored_files(docs)) == 2  # the refused uploads left nothing behind


def test_the_same_bytes_again_change_nothing(admin_client, configured_lead, docs, db):
    project = active_project(admin_client, configured_lead)
    document = staff_upload(admin_client, project["id"], pdf("same")).json()["documents"][0]
    again = staff_version(admin_client, project["id"], document["id"], pdf("same"), expected=1)
    assert again.status_code == 200 and len(again.json()["documents"][0]["versions"]) == 1
    assert db.scalar(select(func.count()).select_from(ProjectDocumentVersion)) == 1 and len(stored_files(docs)) == 1


def test_a_new_version_must_come_from_the_same_side_and_the_limits_hold(
    customer, admin_client, configured_lead, docs, monkeypatch
):
    project = active_project(admin_client, configured_lead)
    team_doc = staff_upload(admin_client, project["id"]).json()["documents"][0]
    mine = client_upload(customer, project["id"], pdf("c")).json()["documents"][0]
    cross = customer.post(
        f"{API}/{project['id']}/documents/{team_doc['id']}/versions",
        content=pdf("x"),
        headers={**csrf(customer), **headers("a.pdf", expected=1)},
    )
    assert cross.status_code == 404  # a draft of the team is not even visible; and the origin rule below
    team_published = published_document(admin_client, project["id"], title="Публичен")
    cross = customer.post(
        f"{API}/{project['id']}/documents/{team_published['id']}/versions",
        content=pdf("x"),
        headers={**csrf(customer), **headers("a.pdf", expected=1)},
    )
    assert cross.status_code == 409 and cross.json()["code"] == "document_origin"
    staff_on_client = staff_version(admin_client, project["id"], mine["id"], pdf("y"), expected=1)
    assert staff_on_client.status_code == 409 and staff_on_client.json()["code"] == "document_origin"
    own = customer.post(
        f"{API}/{project['id']}/documents/{mine['id']}/versions",
        content=pdf("c2"),
        headers={**csrf(customer), **headers("brief2.pdf", expected=1)},
    )
    assert own.status_code == 201

    monkeypatch.setattr(get_settings(), "project_documents_per_project", 3)
    refused = staff_upload(admin_client, project["id"], pdf("z"), title="Още един")
    assert refused.status_code == 409 and refused.json()["code"] == "document_limit"
    monkeypatch.setattr(get_settings(), "project_versions_per_document", 2)
    full = staff_version(admin_client, project["id"], team_doc["id"], pdf("v2"), expected=1)
    assert full.status_code == 201
    over = staff_version(admin_client, project["id"], team_doc["id"], pdf("v3"), expected=2)
    assert over.status_code == 409 and over.json()["code"] == "version_limit"


def test_a_customer_uploads_a_brief_only_in_the_categories_open_to_them(customer, admin_client, configured_lead, docs):
    project = active_project(admin_client, configured_lead)
    refused = client_upload(customer, project["id"], pdf(), category="deliverable")
    assert refused.status_code == 422 and refused.json()["code"] == "category_not_allowed"
    ok = client_upload(customer, project["id"], pdf(), category="brief")
    assert ok.status_code == 201
    document = ok.json()["documents"][0]
    assert (
        document["origin"] == "client"
        and document["versions"][0]["state"] == "published"
        and document["versions"][0]["mine"] is True
    )
    # Staff see the customer's upload at once, labelled as the customer's.
    staff = staff_docs(admin_client, project["id"])[0]
    assert staff["origin"] == "client" and staff["versions"][0]["uploaded_by"] == "client"
    # The customer's own file downloads for the customer and for staff.
    assert customer.get(f"{API}/{project['id']}/documents/{document['id']}/versions/1/download").content == pdf()
    assert (
        admin_client.get(f"{ADMIN}/projects/{project['id']}/documents/{document['id']}/versions/1/download").content
        == pdf()
    )


# --- Scanning ---------------------------------------------------------------------------------------------


def test_nothing_reaches_the_customer_before_a_clean_scan_when_scanning_is_required(
    customer, admin_client, configured_lead, docs, monkeypatch
):
    monkeypatch.setattr(get_settings(), "project_upload_require_scan", True)
    project = active_project(admin_client, configured_lead)
    document = staff_upload(admin_client, project["id"]).json()["documents"][0]
    blocked = publish(admin_client, project["id"], document["id"])
    assert blocked.status_code == 409 and blocked.json()["code"] == "document_not_scanned"
    scan = f"{ADMIN}/projects/{project['id']}/documents/{document['id']}/versions/1/scan"
    assert admin_client.post(scan, json={"result": "clean"}).status_code == 200
    assert publish(admin_client, project["id"], document["id"]).status_code == 200
    assert customer.get(f"{API}/{project['id']}/documents/{document['id']}/versions/1/download").status_code == 200

    # A customer's own upload is published at once, yet nobody downloads it before it is scanned.
    theirs = client_upload(customer, project["id"], pdf("mine")).json()["documents"][-1]
    assert theirs["versions"][0]["downloadable"] is False
    blocked_download = customer.get(f"{API}/{project['id']}/documents/{theirs['id']}/versions/1/download")
    assert blocked_download.status_code == 409 and blocked_download.json()["code"] == "document_not_scanned"
    assert (
        admin_client.post(
            f"{ADMIN}/projects/{project['id']}/documents/{theirs['id']}/versions/1/scan", json={"result": "clean"}
        ).status_code
        == 200
    )
    assert customer.get(f"{API}/{project['id']}/documents/{theirs['id']}/versions/1/download").status_code == 200


def test_an_infected_file_is_withdrawn_and_nobody_downloads_it(customer, admin_client, configured_lead, docs):
    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    request_approval(admin_client, project["id"], document["id"])
    scan = f"{ADMIN}/projects/{project['id']}/documents/{document['id']}/versions/1/scan"
    assert admin_client.post(scan, json={"result": "infected"}).status_code == 200
    version = staff_docs(admin_client, project["id"])[0]["versions"][0]
    assert (
        version["state"] == "withdrawn"
        and version["scan_status"] == "infected"
        and version["approval"]["state"] == "withdrawn"
    )
    assert customer.get(f"{API}/{project['id']}/documents/{document['id']}/versions/1/download").status_code == 404
    staff_download = admin_client.get(
        f"{ADMIN}/projects/{project['id']}/documents/{document['id']}/versions/1/download"
    )
    assert staff_download.status_code == 409 and staff_download.json()["code"] == "document_infected"
    refused = admin_client.post(scan, json={"result": "clean"})
    assert refused.status_code == 409 and refused.json()["code"] == "document_infected"


# --- Approvals --------------------------------------------------------------------------------------------


def test_an_approval_records_who_which_version_what_and_when_and_repeats_change_nothing(
    customer, admin_client, configured_lead, docs, db
):
    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    first = request_approval(admin_client, project["id"], document["id"], message="Моля, одобрете макета")
    assert first.status_code == 201
    approval = first.json()["documents"][0]["versions"][0]["approval"]
    assert approval["state"] == "pending" and approval["message"] == "Моля, одобрете макета"
    again = request_approval(admin_client, project["id"], document["id"])
    assert again.status_code == 200 and again.json()["documents"][0]["versions"][0]["approval"]["id"] == approval["id"]
    assert db.scalar(select(func.count()).select_from(DocumentApproval)) == 1

    view = customer_docs(customer, project["id"])["documents"][0]["versions"][0]["approval"]
    assert view["id"] == approval["id"] and view["decided_by"] is None

    stale = decide(customer, project["id"], approval["id"], "approve", 2)
    assert stale.status_code == 409 and stale.json()["code"] == "version_conflict"
    done = decide(customer, project["id"], approval["id"], "approve", 1, comment="Изглежда добре")
    assert done.status_code == 200
    seen = done.json()["documents"][0]["versions"][0]["approval"]
    assert (
        seen["state"] == "approved"
        and seen["decided_by"] == "you"
        and seen["decision_note"] == "Изглежда добре"
        and seen["decided_at"]
    )

    row = db.get(DocumentApproval, approval["id"])
    db.refresh(row)
    account = db.scalar(select(CustomerAccount).where(CustomerAccount.email == CUSTOMER))
    version = db.scalar(select(ProjectDocumentVersion))
    assert (row.state, row.decided_by_account_id, row.version_id, row.project_id) == (
        "approved",
        account.id,
        version.id,
        db.scalar(select(CommercialProject.id)),
    )
    assert row.decided_at is not None

    events_before = db.scalar(select(func.count()).select_from(ProjectEvent).where(ProjectEvent.kind == "approval"))
    repeat = decide(customer, project["id"], approval["id"], "approve", 1)
    assert repeat.status_code == 200
    assert (
        db.scalar(select(func.count()).select_from(ProjectEvent).where(ProjectEvent.kind == "approval"))
        == events_before
    )
    contradiction = decide(customer, project["id"], approval["id"], "reject", 1, comment="Предумах се")
    assert contradiction.status_code == 409 and contradiction.json()["code"] == "approval_closed"
    db.refresh(row)
    assert row.state == "approved" and row.decision_note == "Изглежда добре"

    audit = db.scalars(select(AuditLog).where(AuditLog.action == "project_document.approval_decided")).all()
    assert (
        len(audit) == 1
        and audit[0].actor_label == f"account:{account.id}"
        and audit[0].details["decision"] == "approved"
    )
    history = customer.get(f"{API}/{project['id']}").json()["events"]
    assert any(e["kind"] == "approval" and e["meta"]["action"] == "approved" and e["mine"] for e in history)
    assert any(
        e["kind"] == "approval" and e["meta"]["action"] == "requested" and e["author"] == "team" for e in history
    )


def test_a_rejection_needs_a_reason_and_a_new_request_can_follow_it(customer, admin_client, configured_lead, docs):
    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    approval = request_approval(admin_client, project["id"], document["id"]).json()["documents"][0]["versions"][0][
        "approval"
    ]
    bare = decide(customer, project["id"], approval["id"], "reject", 1)
    assert bare.status_code == 422 and bare.json()["code"] == "note_required"
    done = decide(customer, project["id"], approval["id"], "reject", 1, comment="Логото е твърде малко")
    assert done.status_code == 200 and done.json()["documents"][0]["versions"][0]["approval"]["state"] == "rejected"
    # The team publishes a corrected version and asks again, for version 2.
    assert staff_version(admin_client, project["id"], document["id"], pdf("v2"), expected=1).status_code == 201
    assert publish(admin_client, project["id"], document["id"], 2).status_code == 200
    second = request_approval(admin_client, project["id"], document["id"], 2)
    assert second.status_code == 201
    versions = second.json()["documents"][0]["versions"]
    assert versions[0]["approval"]["state"] == "rejected" and versions[1]["approval"]["state"] == "pending"


def test_a_newer_published_version_supersedes_an_open_request(customer, admin_client, configured_lead, docs):
    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    approval = request_approval(admin_client, project["id"], document["id"]).json()["documents"][0]["versions"][0][
        "approval"
    ]
    assert staff_version(admin_client, project["id"], document["id"], pdf("v2"), expected=1).status_code == 201
    assert publish(admin_client, project["id"], document["id"], 2).status_code == 200
    superseded = decide(customer, project["id"], approval["id"], "approve", 1)
    assert superseded.status_code == 409 and superseded.json()["code"] == "approval_superseded"
    old = request_approval(admin_client, project["id"], document["id"], 1)
    assert old.status_code == 409 and old.json()["code"] == "version_not_current"
    staff = staff_docs(admin_client, project["id"])[0]["versions"][0]
    assert staff["approval"]["state"] == "superseded"


def test_withdrawing_a_request_a_version_or_a_document_closes_the_request(
    customer, admin_client, configured_lead, docs
):
    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    approval = request_approval(admin_client, project["id"], document["id"]).json()["documents"][0]["versions"][0][
        "approval"
    ]
    withdrawn = admin_client.post(f"{ADMIN}/projects/{project['id']}/approvals/{approval['id']}/withdraw")
    assert (
        withdrawn.status_code == 200
        and withdrawn.json()["documents"][0]["versions"][0]["approval"]["state"] == "withdrawn"
    )
    assert (
        admin_client.post(f"{ADMIN}/projects/{project['id']}/approvals/{approval['id']}/withdraw").status_code == 200
    )  # a repeat
    closed = decide(customer, project["id"], approval["id"], "approve", 1)
    assert closed.status_code == 409 and closed.json()["code"] == "approval_closed"

    second = request_approval(admin_client, project["id"], document["id"]).json()["documents"][0]["versions"][0][
        "approval"
    ]
    assert admin_client.post(f"{ADMIN}/projects/{project['id']}/documents/{document['id']}/archive").status_code == 200
    assert admin_client.post(f"{ADMIN}/projects/{project['id']}/documents/{document['id']}/archive").status_code == 200
    assert decide(customer, project["id"], second["id"], "approve", 1).status_code == 409
    assert customer_docs(customer, project["id"])["documents"] == []
    assert customer.get(f"{API}/{project['id']}/documents/{document['id']}/versions/1/download").status_code == 404
    assert staff_version(admin_client, project["id"], document["id"], pdf("late"), expected=1).status_code == 409


def test_only_the_team_asks_and_only_for_the_latest_published_version(customer, admin_client, configured_lead, docs):
    project = active_project(admin_client, configured_lead)
    draft = staff_upload(admin_client, project["id"]).json()["documents"][0]
    refused = request_approval(admin_client, project["id"], draft["id"])
    assert refused.status_code == 409 and refused.json()["code"] == "version_not_current"
    theirs = client_upload(customer, project["id"], pdf("c")).json()["documents"][-1]
    refused = request_approval(admin_client, project["id"], theirs["id"])
    assert refused.status_code == 409 and refused.json()["code"] == "document_origin"
    for path in (f"{API}/{project['id']}/approvals", f"{API}/{project['id']}/approvals/{draft['id']}"):
        assert customer.post(path, json={}, headers=csrf(customer)).status_code in (404, 405)


def test_simultaneous_decisions_record_one_and_the_other_repeats_it(customer, admin_client, configured_lead, docs, db):
    from concurrent.futures import ThreadPoolExecutor

    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    approval = request_approval(admin_client, project["id"], document["id"]).json()["documents"][0]["versions"][0][
        "approval"
    ]
    from app.main import app

    twin = TestClient(app)
    twin.cookies.update(customer.cookies)
    token = csrf(customer)

    def go(client):
        body = {"expected_version": 1, "decision": "approve"}
        return client.post(
            f"{API}/{project['id']}/approvals/{approval['id']}/decision", json=body, headers=token
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(go, (customer, twin)))
    assert codes == [200, 200]
    assert (
        db.scalar(
            select(func.count())
            .select_from(ProjectEvent)
            .where(ProjectEvent.kind == "approval", ProjectEvent.author_kind == "client")
        )
        == 1
    )


# --- Feedback ---------------------------------------------------------------------------------------------


def test_feedback_is_per_version_without_identities_and_only_on_published_versions(
    customer, admin_client, configured_lead, docs, db
):
    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    base = f"{API}/{project['id']}/documents/{document['id']}/comments"
    sent = customer.post(base, json={"version": 1, "body": "Може ли по-голям шрифт?"}, headers=csrf(customer))
    assert sent.status_code == 201
    reply = admin_client.post(
        f"{ADMIN}/projects/{project['id']}/documents/{document['id']}/comments",
        json={"version": 1, "body": "Да, ще го променим."},
    )
    assert reply.status_code == 201
    comments = customer_docs(customer, project["id"])["documents"][0]["comments"]
    assert [(c["author"], c["mine"], c["version"]) for c in comments] == [("client", True, 1), ("team", False, 1)]
    assert "@" not in str(comments)
    assert customer.post(base, json={"version": 9, "body": "Здравейте"}, headers=csrf(customer)).status_code == 404
    assert customer.post(base, json={"version": 1, "body": "<b>x</b>"}, headers=csrf(customer)).status_code == 422
    assert customer.post(base, json={"version": 1, "body": "ab"}, headers=csrf(customer)).status_code == 422
    draft = staff_upload(admin_client, project["id"], pdf("d"), title="Чернова").json()["documents"][-1]
    hidden = customer.post(
        f"{API}/{project['id']}/documents/{draft['id']}/comments",
        json={"version": 1, "body": "Здравейте"},
        headers=csrf(customer),
    )
    assert hidden.status_code == 404


# --- Access log, retention, privacy -----------------------------------------------------------------------


def test_every_download_and_upload_is_logged_without_file_names(customer, admin_client, configured_lead, docs, db):
    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"], filename="тайно-име.pdf")
    customer.get(f"{API}/{project['id']}/documents/{document['id']}/versions/1/download")
    admin_client.get(f"{ADMIN}/projects/{project['id']}/documents/{document['id']}/versions/1/download")
    rows = db.scalars(
        select(AuditLog).where(AuditLog.action.like("project_document.%")).order_by(AuditLog.created_at)
    ).all()
    actions = [r.action for r in rows]
    assert (
        actions.count("project_document.download") == 2
        and "project_document.upload" in actions
        and "project_document.publish" in actions
    )
    labels = {r.actor_label.split(":")[0] for r in rows if r.action == "project_document.download"}
    assert labels == {"account", "admin"}
    assert "тайно-име" not in str([r.details for r in rows]) and all(
        r.details["project"] == project["id"] for r in rows
    )


def test_retention_removes_the_bytes_but_keeps_the_records_and_waits_for_open_requests(
    customer, admin_client, configured_lead, docs, db
):
    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    approval = request_approval(admin_client, project["id"], document["id"]).json()["documents"][0]["versions"][0][
        "approval"
    ]
    db.execute(text("UPDATE project_documents SET retain_until = now() - interval '1 day'"))
    db.commit()
    assert documents.purge_expired(db) == 0 and len(stored_files(docs)) == 1  # an open request keeps the file
    assert decide(customer, project["id"], approval["id"], "approve", 1).status_code == 200
    assert documents.purge_expired(db) == 1 and stored_files(docs) == []
    assert documents.purge_expired(db) == 0
    version = db.scalar(select(ProjectDocumentVersion))
    db.refresh(version)
    assert version.purged_at is not None and version.sha256 and version.filename  # the record stays
    gone = customer.get(f"{API}/{project['id']}/documents/{document['id']}/versions/1/download")
    assert gone.status_code == 410 and gone.json()["code"] == "document_purged"
    assert customer_docs(customer, project["id"])["documents"][0]["versions"][0]["downloadable"] is False
    assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "project_document.purge")) == 1


def test_the_export_lists_the_account_s_own_activity_and_erasure_removes_its_text(
    customer, admin_client, configured_lead, docs, db
):
    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    approval = request_approval(admin_client, project["id"], document["id"]).json()["documents"][0]["versions"][0][
        "approval"
    ]
    decide(customer, project["id"], approval["id"], "reject", 1, comment="Моля, друг цвят")
    customer.post(
        f"{API}/{project['id']}/documents/{document['id']}/comments",
        json={"version": 1, "body": "Лична забележка"},
        headers=csrf(customer),
    )
    client_upload(customer, project["id"], pdf("mine"), filename="мое-задание.pdf")
    account = db.scalar(select(CustomerAccount).where(CustomerAccount.email == CUSTOMER))
    export = compliance_service.build_export(db, account)["project_documents"]
    assert [u["file"] for u in export["uploads"]] == ["мое-задание.pdf"]
    assert [(d["decision"], d["note"]) for d in export["decisions"]] == [("rejected", "Моля, друг цвят")]
    assert [c["text"] for c in export["comments"]] == ["Лична забележка"]
    assert compliance_service.erase_account(db, account) == "anonymized"
    db.commit()
    db.expire_all()
    assert all(
        c.body == "[erased]" for c in db.scalars(select(DocumentComment).where(DocumentComment.author_kind == "client"))
    )
    assert db.scalar(select(DocumentApproval.decision_note)) in (None, "[erased]")


# --- Database rules and grants ----------------------------------------------------------------------------


def test_the_tables_hold_the_rules_and_the_grants(customer, admin_client, configured_lead, docs, db):
    project = active_project(admin_client, configured_lead)
    document = published_document(admin_client, project["id"])
    approval = request_approval(admin_client, project["id"], document["id"]).json()["documents"][0]["versions"][0][
        "approval"
    ]
    version = db.scalar(select(ProjectDocumentVersion))
    for statement in (
        "UPDATE document_approvals SET state = 'approved' WHERE id = :a",  # a decision needs its time
        "UPDATE document_approvals SET state = 'maybe' WHERE id = :a",
        "UPDATE project_documents SET category = 'secret'",
        "UPDATE project_documents SET origin = 'robot'",
        "UPDATE project_document_versions SET state = 'hidden'",
        "UPDATE project_document_versions SET scan_status = 'ok'",
        "UPDATE project_document_versions SET size_bytes = 0",
        "UPDATE project_document_versions SET sha256 = 'short'",
        "UPDATE project_document_versions SET number = 0",
        "UPDATE project_documents SET revision = 0",
    ):
        with pytest.raises(DBAPIError):
            db.execute(text(statement), {"a": approval["id"]})
        db.rollback()
    # Two open requests for one version, or a second version with the same number or key, cannot exist.
    with pytest.raises(IntegrityError):
        db.add(DocumentApproval(project_id=version.document_id, document_id=version.document_id, version_id=version.id))
        db.flush()
    db.rollback()
    with pytest.raises(IntegrityError):
        db.execute(
            text(
                "INSERT INTO project_document_versions (id, document_id, number, filename, content_type, size_bytes, sha256, storage_key, uploaded_by_kind)"
                " VALUES (gen_random_uuid(), :d, 1, 'x.pdf', 'application/pdf', 1, repeat('a', 64), 'k', 'staff')"
            ),
            {"d": version.document_id},
        )
    db.rollback()

    def may(role: str, table: str, privilege: str) -> bool:
        return db.scalar(text("SELECT has_table_privilege(:r, :t, :p)"), {"r": role, "t": table, "p": privilege})

    for table in ("project_documents", "project_document_versions", "document_approvals", "document_comments"):
        assert (
            may("acs_app_api", table, "SELECT")
            and may("acs_app_api", table, "INSERT")
            and may("acs_app_api", table, "UPDATE")
        )
        assert not may("acs_app_api", table, "DELETE")
        assert not may("acs_app_runtime", table, "SELECT")


# --- Upload transport: the request-size guard must agree with the upload limit (audit finding F-02) --------------

LARGE = 200 * 1024  # well above the 64 KiB cap of every JSON endpoint, well below PROJECT_UPLOAD_MAX_BYTES


def test_a_file_above_the_json_cap_but_within_the_upload_limit_is_accepted(
    customer, admin_client, configured_lead, docs, db
):
    """The global 64 KiB guard used to refuse every real document before the upload route could look at it."""
    project = active_project(admin_client, configured_lead)
    big = pdf() + b"x" * LARGE
    staff = staff_upload(admin_client, project["id"], big)
    assert staff.status_code == 201, staff.text
    assert client_upload(customer, project["id"], big, filename="brief.pdf").status_code == 201
    versions = db.scalars(select(ProjectDocumentVersion)).all()
    assert sorted(v.size_bytes for v in versions) == [len(big), len(big)]


def test_a_file_new_version_above_the_json_cap_is_accepted(customer, admin_client, configured_lead, docs):
    project = active_project(admin_client, configured_lead)
    document = staff_upload(admin_client, project["id"]).json()["documents"][-1]
    big = pdf("v2") + b"x" * LARGE
    response = staff_version(admin_client, project["id"], document["id"], big, expected=1)
    assert response.status_code == 201, response.text


def test_the_larger_cap_applies_to_the_upload_routes_only(customer, admin_client, configured_lead, docs):
    project = active_project(admin_client, configured_lead)
    document = staff_upload(admin_client, project["id"]).json()["documents"][-1]
    # Same size, same project, but a JSON route and a non-octet-stream body: the 64 KiB guard still answers.
    oversized_json = admin_client.post(
        f"{ADMIN}/projects/{project['id']}/documents/{document['id']}/versions/1/publish",
        content=b"{" + b" " * LARGE + b"}",
        headers={"content-type": "application/json"},
    )
    assert oversized_json.status_code == 413 and oversized_json.json()["code"] == "payload_too_large"
    wrong_type = admin_client.post(
        f"{ADMIN}/projects/{project['id']}/documents",
        content=pdf() + b"x" * LARGE,
        headers={**headers("a.pdf", "T", "design"), "content-type": "application/pdf"},
    )
    assert wrong_type.status_code == 413 and wrong_type.json()["code"] == "payload_too_large"
    # And a GET with a body, or any other method on the upload path, gets no allowance.
    patched = admin_client.patch(
        f"{ADMIN}/projects/{project['id']}/documents", content=b"x" * LARGE, headers={"content-type": OCTET}
    )
    assert patched.status_code in (404, 405, 413)


def test_the_upload_cap_is_not_granted_while_uploads_are_off(customer, admin_client, configured_lead, docs, monkeypatch):
    project = active_project(admin_client, configured_lead)
    monkeypatch.setattr(get_settings(), "project_uploads_enabled", False)
    response = staff_upload(admin_client, project["id"], pdf() + b"x" * LARGE)
    assert response.status_code == 413 and response.json()["code"] == "payload_too_large"
