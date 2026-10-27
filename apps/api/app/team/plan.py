"""Architecture output that exists only on the server: security considerations and data flows.

Rule-based like the rest of the model: each consideration has an explicit condition. Texts live in
app/team/texts.py (PDF) and apps/web/src/content/*/tool-team.ts (UI) under the same keys.
"""

from __future__ import annotations

from typing import Any

from app.team.model import AGENTS, DATA_SOURCES, TeamConfig, agent_configs, build_architecture, team_integrations

#: Agents that read content written by outsiders (e-mails, forms, documents, public web pages).
UNTRUSTED_INPUT_AGENTS = frozenset({"customer_support", "document_processing", "lead_qualification", "sales_research"})

SECURITY_KEYS = (
    "least_privilege",
    "secrets",
    "audit_log",
    "provider_terms",
    "personal_data",
    "untrusted_input",
    "external_actions",
    "document_permissions",
    "regulated_data",
    "data_location",
)


def security_considerations(config: TeamConfig) -> list[str]:
    configs = agent_configs(config)
    agents = list(configs)
    out = ["least_privilege", "secrets", "audit_log", "provider_terms"]
    if any(AGENTS[a].sensitivity == "high" for a in agents):
        out.append("personal_data")
    if UNTRUSTED_INPUT_AGENTS & set(agents):
        out.append("untrusted_input")
    if any(AGENTS[a].external for a in agents):
        out.append("external_actions")
    if "knowledge_assistant" in agents:
        out.append("document_permissions")
    if "finance" in config.departments or "hr" in config.departments:
        out.append("regulated_data")
    out.append("data_location")
    return out


def data_flows(config: TeamConfig) -> list[dict[str, Any]]:
    """Reads from shared data and actions in systems, per agent (orchestration edges omitted)."""
    configs = agent_configs(config)
    graph = build_architecture(config)
    flows = []
    for edge in graph["edges"]:
        if edge["kind"] not in ("read", "act"):
            continue
        source = edge["from"]
        agent = source.split(":", 1)[1] if source.startswith(("agent:", "approval:")) else None
        integration = edge["to"].split(":", 1)[1]
        flows.append(
            {
                "kind": edge["kind"],
                "agent": agent,
                "via": "orchestration"
                if source == "orchestration"
                else "supervisor"
                if source == "approvals:supervisor"
                else None,
                "integration": integration,
                "approval": configs[agent]["checkpoint"] if agent and source.startswith("approval:") else None,
            }
        )
    return flows


def systems(config: TeamConfig) -> dict[str, list[str]]:
    used = team_integrations(agent_configs(config))
    return {"data": [i for i in used if i in DATA_SOURCES], "systems": [i for i in used if i not in DATA_SOURCES]}
