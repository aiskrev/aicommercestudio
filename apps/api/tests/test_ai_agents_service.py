"""AI agent development as a lead service (migration 0005)."""

from sqlalchemy import select

from app.ai.mock import _NEXT_STEPS as NEXT_STEPS
from app.models import Lead
from app.notifications import SERVICE_LABELS
from tests.conftest import lead_payload


def test_ai_agents_inquiry_is_accepted_and_stored(client, db):
    payload = lead_payload(
        service="ai_agents",
        message="We want an agent that triages support e-mails and drafts replies for approval.",
    )
    response = client.post("/api/public/leads", json=payload)
    assert response.status_code == 201, response.text

    lead = db.scalar(select(Lead))
    assert lead.service == "ai_agents"
    assert lead.submitted_service == "ai_agents"


def test_ai_agents_has_a_label_and_a_next_step():
    assert SERVICE_LABELS["ai_agents"]
    assert NEXT_STEPS["ai_agents"]
