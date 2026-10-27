"""AI team configuration model — Python port of apps/web/src/lib/ai-team.ts (same rules, same output).

The browser builds the configuration; the API re-derives everything it prints or stores from the
enumerated configuration alone (never from browser-supplied results). Parity with the web model is
tested with golden vectors (tests/fixtures/team_vectors.json ↔ apps/web/src/lib/team.vectors.json).
Change both implementations together and bump MODEL_VERSION in both.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

MODEL_VERSION = "2026-10.1"

INDUSTRIES = (
    "ecommerce",
    "professional_services",
    "manufacturing",
    "logistics",
    "saas",
    "financial_services",
    "healthcare",
    "other",
)
COMPANY_SIZES = ("s1_10", "s11_50", "s51_250", "s251_1000", "s1000_plus")
DEPARTMENTS = ("sales", "marketing", "support", "operations", "finance", "hr", "it_knowledge", "custom")
CHALLENGES = (
    "slow_response",
    "lead_followup",
    "manual_documents",
    "scattered_knowledge",
    "content_volume",
    "reporting_effort",
    "scheduling_overhead",
    "handoffs",
)
VOLUMES = ("v_lt100", "v100_1k", "v1k_10k", "v_gt10k")
INTEGRATIONS = (
    "crm",
    "email",
    "helpdesk",
    "chat",
    "calendar",
    "cms",
    "ecommerce_platform",
    "erp",
    "accounting",
    "hris",
    "knowledge_base",
    "document_storage",
    "analytics_warehouse",
)
DATA_SOURCES = frozenset({"knowledge_base", "document_storage", "analytics_warehouse"})
AGENT_KEYS = (
    "lead_qualification",
    "sales_research",
    "customer_support",
    "content_operations",
    "document_processing",
    "knowledge_assistant",
    "scheduling",
    "reporting_insights",
    "workflow_coordinator",
    "approval_supervisor",
)
CHECKPOINTS = ("none", "sample_review", "before_external", "every_action")
DEPLOYMENTS = ("managed_cloud", "customer_cloud", "on_premise")
OPERATIONS = ("studio_managed", "shared", "internal")
COORDINATOR_MIN_TASK_AGENTS = 2


@dataclass(frozen=True)
class AgentDefinition:
    key: str
    role: str  # task | coordination | oversight
    departments: tuple[str, ...]
    integrations: tuple[str, ...]
    optional_integrations: tuple[str, ...]
    external: bool
    sensitivity: str  # low | medium | high
    min_checkpoint: str
    requires: tuple[str, ...]
    pairs_with: tuple[str, ...]
    complexity: str  # low | medium | high


def _agent(
    key: str,
    role: str,
    departments,
    integrations,
    optional,
    external,
    sensitivity,
    min_checkpoint,
    requires,
    pairs,
    complexity,
):
    return AgentDefinition(
        key,
        role,
        tuple(departments),
        tuple(integrations),
        tuple(optional),
        external,
        sensitivity,
        min_checkpoint,
        tuple(requires),
        tuple(pairs),
        complexity,
    )


AGENTS: dict[str, AgentDefinition] = {
    a.key: a
    for a in (
        _agent(
            "lead_qualification",
            "task",
            ["sales", "marketing"],
            ["crm"],
            ["email", "chat", "ecommerce_platform"],
            False,
            "medium",
            "sample_review",
            [],
            ["sales_research", "scheduling"],
            "low",
        ),
        _agent(
            "sales_research",
            "task",
            ["sales"],
            ["crm"],
            ["knowledge_base"],
            False,
            "low",
            "sample_review",
            [],
            ["lead_qualification"],
            "low",
        ),
        _agent(
            "customer_support",
            "task",
            ["support"],
            ["helpdesk", "knowledge_base"],
            ["email", "chat", "ecommerce_platform", "crm"],
            True,
            "high",
            "sample_review",
            ["knowledge_assistant"],
            ["approval_supervisor"],
            "medium",
        ),
        _agent(
            "content_operations",
            "task",
            ["marketing"],
            ["cms"],
            ["ecommerce_platform", "document_storage", "analytics_warehouse"],
            True,
            "low",
            "sample_review",
            [],
            ["approval_supervisor", "reporting_insights"],
            "medium",
        ),
        _agent(
            "document_processing",
            "task",
            ["operations", "finance", "hr"],
            ["document_storage"],
            ["erp", "accounting", "hris", "email"],
            False,
            "high",
            "sample_review",
            [],
            ["approval_supervisor"],
            "high",
        ),
        _agent(
            "knowledge_assistant",
            "task",
            ["it_knowledge", "support", "hr", "operations"],
            ["knowledge_base"],
            ["document_storage", "chat"],
            False,
            "medium",
            "sample_review",
            [],
            ["customer_support"],
            "medium",
        ),
        _agent(
            "scheduling",
            "task",
            ["sales", "support", "hr", "operations"],
            ["calendar"],
            ["email", "crm", "hris"],
            True,
            "medium",
            "sample_review",
            [],
            ["lead_qualification"],
            "low",
        ),
        _agent(
            "reporting_insights",
            "task",
            ["operations", "finance", "sales", "marketing"],
            ["analytics_warehouse"],
            ["crm", "erp", "accounting", "ecommerce_platform"],
            False,
            "medium",
            "sample_review",
            [],
            [],
            "medium",
        ),
        _agent(
            "workflow_coordinator",
            "coordination",
            ["operations", "it_knowledge"],
            [],
            ["email", "chat"],
            False,
            "medium",
            "sample_review",
            [],
            [],
            "high",
        ),
        _agent(
            "approval_supervisor",
            "oversight",
            ["operations", "it_knowledge"],
            [],
            ["email", "chat"],
            False,
            "medium",
            "every_action",
            [],
            [],
            "medium",
        ),
    )
}

CHALLENGE_AGENTS = {
    "slow_response": ["customer_support", "knowledge_assistant"],
    "lead_followup": ["lead_qualification", "scheduling"],
    "manual_documents": ["document_processing"],
    "scattered_knowledge": ["knowledge_assistant"],
    "content_volume": ["content_operations"],
    "reporting_effort": ["reporting_insights"],
    "scheduling_overhead": ["scheduling"],
    "handoffs": ["workflow_coordinator"],
}
DEPARTMENT_AGENTS = {
    "sales": ["lead_qualification", "sales_research"],
    "marketing": ["content_operations", "lead_qualification"],
    "support": ["customer_support", "knowledge_assistant"],
    "operations": ["document_processing", "reporting_insights"],
    "finance": ["document_processing", "reporting_insights"],
    "hr": ["knowledge_assistant", "scheduling"],
    "it_knowledge": ["knowledge_assistant"],
    "custom": [],
}

AGENT_POINTS = {"low": 1, "medium": 2, "high": 3}
VOLUME_POINTS = {"v_lt100": 0, "v100_1k": 1, "v1k_10k": 2, "v_gt10k": 3}
DEPLOYMENT_POINTS = {"managed_cloud": 0, "customer_cloud": 1, "on_premise": 3}
COMPLEXITY_BANDS = (("high", 14), ("medium", 7), ("low", 0))
PHASE_WEEKS = {"low": (3, 5), "medium": (5, 8), "high": (8, 12)}


@dataclass
class TeamConfig:
    """Enumerated configuration only — no free text (the custom department name never reaches the API)."""

    context: dict[str, str]  # industry, size, lead_department, challenge, volume
    departments: list[str]
    chosen: list[str]
    agents: dict[str, dict[str, Any]] = field(default_factory=dict)  # agent -> {volume, integrations, checkpoint}
    deployment: str | None = None
    operations: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "context": dict(self.context),
            "departments": list(self.departments),
            "chosen": list(self.chosen),
            "agents": {k: dict(v) for k, v in self.agents.items()},
            "deployment": self.deployment,
            "operations": self.operations,
        }


# ------------------------------------------------------------------------------------ selection


def recommend_agents(context: dict[str, str], departments: list[str]) -> list[dict[str, Any]]:
    by_agent: dict[str, list[dict[str, str]]] = {}
    challenge = context.get("challenge")
    if challenge:
        for agent in CHALLENGE_AGENTS[challenge]:
            by_agent.setdefault(agent, []).append({"kind": "challenge", "challenge": challenge})
    for department in DEPARTMENTS:
        if department not in departments:
            continue
        for agent in DEPARTMENT_AGENTS[department]:
            by_agent.setdefault(agent, []).append({"kind": "department", "department": department})

    def weight(reasons: list[dict[str, str]]) -> int:
        return sum(10 if r["kind"] == "challenge" else 1 for r in reasons)

    ordered = sorted(by_agent.items(), key=lambda item: (-weight(item[1]), AGENT_KEYS.index(item[0])))
    return [{"agent": agent, "reasons": reasons} for agent, reasons in ordered]


def add_agent(selected: list[str], agent: str) -> list[str]:
    chosen = set(selected)

    def visit(key: str) -> None:
        if key in chosen and key != agent:
            return
        chosen.add(key)
        for required in AGENTS[key].requires:
            visit(required)

    visit(agent)
    return [key for key in AGENT_KEYS if key in chosen]


def required_by(selected: list[str], agent: str) -> list[str]:
    return [key for key in selected if key != agent and agent in AGENTS[key].requires]


def selected_agents(config: TeamConfig) -> list[str]:
    team: list[str] = []
    for agent in config.chosen:
        team = add_agent(team, agent)
    return team


def selection_issues(selected: list[str]) -> list[dict[str, Any]]:
    tasks = sum(1 for a in selected if AGENTS[a].role == "task")
    issues: list[dict[str, Any]] = []
    if tasks == 0:
        issues.append({"kind": "no_task_agent"})
    if "workflow_coordinator" in selected and tasks < COORDINATOR_MIN_TASK_AGENTS:
        issues.append({"kind": "coordinator_needs_agents", "have": tasks, "need": COORDINATOR_MIN_TASK_AGENTS})
    return issues


# --------------------------------------------------------------------------------- configuration


def minimum_checkpoint(agent: str) -> dict[str, str]:
    definition = AGENTS[agent]
    checkpoint, reason = definition.min_checkpoint, "role"

    def raise_to(to: str, why: str) -> None:
        nonlocal checkpoint, reason
        if CHECKPOINTS.index(to) > CHECKPOINTS.index(checkpoint):
            checkpoint, reason = to, why

    if definition.external:
        raise_to("before_external", "external")
    if definition.sensitivity == "high":
        raise_to("sample_review", "sensitive")
    return {"checkpoint": checkpoint, "reason": reason}


def default_agent_config(agent: str, context: dict[str, str]) -> dict[str, Any]:
    return {
        "volume": context.get("volume") or "v100_1k",
        "integrations": list(AGENTS[agent].integrations),
        "checkpoint": minimum_checkpoint(agent)["checkpoint"],
    }


def normalise_agent_config(agent: str, config: dict[str, Any]) -> dict[str, Any]:
    definition = AGENTS[agent]
    allowed = set(definition.integrations) | set(definition.optional_integrations)
    given = set(config.get("integrations") or [])
    integrations = [i for i in INTEGRATIONS if i in definition.integrations or (i in allowed and i in given)]
    floor = CHECKPOINTS.index(minimum_checkpoint(agent)["checkpoint"])
    checkpoint = CHECKPOINTS[max(floor, CHECKPOINTS.index(config["checkpoint"]))]
    return {"volume": config["volume"], "integrations": integrations, "checkpoint": checkpoint}


def agent_configs(config: TeamConfig) -> dict[str, dict[str, Any]]:
    return {
        agent: normalise_agent_config(agent, config.agents.get(agent) or default_agent_config(agent, config.context))
        for agent in selected_agents(config)
    }


def team_integrations(configs: dict[str, dict[str, Any]]) -> list[str]:
    used = {i for c in configs.values() for i in c["integrations"]}
    return [i for i in INTEGRATIONS if i in used]


def _highest_volume(configs: dict[str, dict[str, Any]]) -> str:
    return VOLUMES[max([0, *(VOLUMES.index(c["volume"]) for c in configs.values())])]


# --------------------------------------------------------------------------------------- results


def complexity(config: TeamConfig) -> dict[str, Any]:
    configs = agent_configs(config)
    agents = list(configs)
    integrations = team_integrations(configs)
    factors: list[dict[str, Any]] = [
        {"kind": "agents", "count": len(agents), "points": sum(AGENT_POINTS[AGENTS[a].complexity] for a in agents)},
        {"kind": "integrations", "count": len(integrations), "points": len(integrations)},
    ]
    if agents:
        volume = _highest_volume(configs)
        if VOLUME_POINTS[volume] > 0:
            factors.append({"kind": "volume", "volume": volume, "points": VOLUME_POINTS[volume]})
    if any(AGENTS[a].sensitivity == "high" for a in agents):
        factors.append({"kind": "sensitive_data", "points": 2})
    if any(AGENTS[a].external for a in agents):
        factors.append({"kind": "external_actions", "points": 1})
    if "workflow_coordinator" in agents:
        factors.append({"kind": "coordination", "points": 2})
    if config.deployment and DEPLOYMENT_POINTS[config.deployment] > 0:
        factors.append(
            {"kind": "deployment", "deployment": config.deployment, "points": DEPLOYMENT_POINTS[config.deployment]}
        )
    points = sum(f["points"] for f in factors)
    band = next(band for band, minimum in COMPLEXITY_BANDS if points >= minimum)
    return {"band": band, "points": points, "factors": factors}


def risks(config: TeamConfig) -> list[str]:
    configs = agent_configs(config)
    agents = list(configs)
    tasks = [a for a in agents if AGENTS[a].role == "task"]
    out: list[str] = []
    if any(AGENTS[a].sensitivity == "high" for a in agents):
        out.append("personal_data")
    if any(AGENTS[a].external for a in agents):
        out.append("customer_facing_errors")
    if len(team_integrations(configs)) >= 4:
        out.append("integration_fragility")
    if any(
        configs[a]["checkpoint"] == "every_action" and VOLUMES.index(configs[a]["volume"]) >= VOLUMES.index("v1k_10k")
        for a in agents
    ):
        out.append("approval_bottleneck")
    if len(tasks) >= 3 and "workflow_coordinator" not in agents:
        out.append("coordination_gap")
    if config.context.get("size") == "s1_10" and len(agents) >= 4:
        out.append("ownership_capacity")
    if "knowledge_assistant" in agents:
        out.append("knowledge_quality")
    if "finance" in config.departments or "hr" in config.departments:
        out.append("regulated_department")
    if config.deployment == "on_premise":
        out.append("infrastructure_effort")
    return out


def prerequisites(config: TeamConfig) -> list[str]:
    configs = agent_configs(config)
    agents = list(configs)
    out = ["process_owner"]
    if any(i not in DATA_SOURCES for i in team_integrations(configs)):
        out.append("system_access")
    if any("knowledge_base" in configs[a]["integrations"] for a in agents):
        out.append("knowledge_curation")
    if any(configs[a]["checkpoint"] != "none" for a in agents):
        out.append("approval_owners")
    out.append("test_cases")
    if any(AGENTS[a].sensitivity != "low" for a in agents):
        out.append("data_processing_terms")
    if config.deployment in ("customer_cloud", "on_premise"):
        out.append("infrastructure")
    return out


WORKFLOWS = (
    ("lead_to_meeting", "lead_qualification", ("lead_qualification", "sales_research", "scheduling")),
    ("support_resolution", "customer_support", ("knowledge_assistant", "customer_support")),
    ("document_intake", "document_processing", ("document_processing", "reporting_insights")),
    ("content_pipeline", "content_operations", ("content_operations",)),
    ("insight_reporting", "reporting_insights", ("reporting_insights",)),
    ("knowledge_answers", "knowledge_assistant", ("knowledge_assistant",)),
)


def suggested_workflows(config: TeamConfig) -> list[dict[str, Any]]:
    configs = agent_configs(config)
    agents = set(configs)
    out = []
    for key, core, chain in WORKFLOWS:
        if core not in agents:
            continue
        if key == "knowledge_answers" and "customer_support" in agents:
            continue
        if key == "insight_reporting" and "document_processing" in agents:
            continue
        steps: list[dict[str, str]] = [{"kind": "trigger"}]
        if "workflow_coordinator" in agents:
            steps.append({"kind": "agent", "agent": "workflow_coordinator"})
        for agent in chain:
            if agent not in agents:
                continue
            steps.append({"kind": "agent", "agent": agent})
            checkpoint = configs[agent]["checkpoint"]
            if checkpoint in ("before_external", "every_action"):
                steps.append({"kind": "human", "checkpoint": checkpoint})
        steps.append({"kind": "outcome"})
        out.append({"key": key, "steps": steps})
    return out


def rollout_plan(config: TeamConfig) -> list[dict[str, Any]]:
    agents = selected_agents(config)
    if not agents:
        return []
    recommended = [r["agent"] for r in recommend_agents(config.context, config.departments)]

    def rank(agent: str) -> int:
        return recommended.index(agent) if agent in recommended else len(recommended)

    def points(agent: str) -> int:
        return AGENT_POINTS[AGENTS[agent].complexity]

    tasks = sorted(
        (a for a in agents if AGENTS[a].role == "task"), key=lambda a: (points(a), rank(a), AGENT_KEYS.index(a))
    )
    pilot_core = sorted(tasks, key=lambda a: (rank(a), points(a)))[0] if tasks else None
    assigned: set[str] = set()

    def take(keys: list[str]) -> list[str]:
        out = [a for key in keys for a in add_agent([], key) if a in agents and a not in assigned]
        assigned.update(out)
        return [k for k in AGENT_KEYS if k in out]

    pilot = take([pilot_core] if pilot_core else [])
    expand = take([a for a in tasks if a not in assigned][:2])
    scale = take([a for a in agents if a not in assigned])

    def phase_complexity(keys: list[str]) -> str:
        total = sum(points(a) for a in keys)
        return "high" if total >= 5 else "medium" if total >= 3 else "low"

    phases = []
    for key, keys in (("pilot", pilot), ("expand", expand), ("scale", scale)):
        if keys:
            band = phase_complexity(keys)
            phases.append({"key": key, "agents": keys, "complexity": band, "weeks": list(PHASE_WEEKS[band])})
    return phases


def related_services(config: TeamConfig) -> list[str]:
    configs = agent_configs(config)
    out = ["ai_agents"]
    if any(i not in DATA_SOURCES for i in team_integrations(configs)):
        out.append("integrations")
    if config.operations in ("studio_managed", "shared"):
        out.append("ai_managed")
    return out


def build_architecture(config: TeamConfig) -> dict[str, list[dict[str, Any]]]:
    configs = agent_configs(config)
    selected = selected_agents(config)
    workers = [a for a in selected if AGENTS[a].role == "task"]
    nodes: list[dict[str, Any]] = [{"id": "users:team", "lane": "users", "kind": "team"}]
    edges: list[dict[str, str]] = []
    if any(AGENTS[a].external for a in workers):
        nodes.append({"id": "users:customers", "lane": "users", "kind": "customers"})
    nodes.append(
        {
            "id": "orchestration",
            "lane": "orchestration",
            "kind": "coordinator" if "workflow_coordinator" in selected else "router",
        }
    )
    for user in [n for n in nodes if n["lane"] == "users"]:
        edges.append({"from": user["id"], "to": "orchestration", "kind": "request"})
    supervised = "approval_supervisor" in selected
    if supervised:
        nodes.append({"id": "approvals:supervisor", "lane": "approvals", "kind": "supervisor"})

    used: set[str] = set()
    for agent in workers:
        node_id = f"agent:{agent}"
        nodes.append({"id": node_id, "lane": "agents", "kind": "agent", "agent": agent})
        edges.append({"from": "orchestration", "to": node_id, "kind": "route"})
        checkpoint = configs[agent]["checkpoint"]
        actor = node_id
        if checkpoint in ("before_external", "every_action"):
            approval = f"approval:{agent}"
            nodes.append(
                {"id": approval, "lane": "approvals", "kind": "approval", "agent": agent, "checkpoint": checkpoint}
            )
            edges.append({"from": node_id, "to": approval, "kind": "review"})
            if supervised:
                edges.append({"from": "approvals:supervisor", "to": approval, "kind": "supervise"})
            actor = approval
        for integration in configs[agent]["integrations"]:
            used.add(integration)
            if integration in DATA_SOURCES:
                edges.append({"from": node_id, "to": f"data:{integration}", "kind": "read"})
            else:
                edges.append({"from": actor, "to": f"systems:{integration}", "kind": "act"})
    for agent in ("workflow_coordinator", "approval_supervisor"):
        if agent not in selected:
            continue
        source = "orchestration" if agent == "workflow_coordinator" else "approvals:supervisor"
        for integration in configs[agent]["integrations"]:
            used.add(integration)
            edges.append({"from": source, "to": f"systems:{integration}", "kind": "act"})
    for integration in INTEGRATIONS:
        if integration in used:
            lane = "data" if integration in DATA_SOURCES else "systems"
            nodes.append(
                {"id": f"{lane}:{integration}", "lane": lane, "kind": "integration", "integration": integration}
            )
    return {"nodes": nodes, "edges": edges}


def is_complete(config: TeamConfig) -> bool:
    context = config.context
    return bool(
        all(context.get(k) for k in ("industry", "size", "lead_department", "challenge", "volume"))
        and config.departments
        and not selection_issues(selected_agents(config))
        and config.deployment
        and config.operations
    )


def summary(config: TeamConfig) -> dict[str, Any]:
    """Everything derived from the configuration, in the shape the parity vectors use."""
    return {
        "selected": selected_agents(config),
        "configs": agent_configs(config),
        "complexity": complexity(config),
        "risks": risks(config),
        "prerequisites": prerequisites(config),
        "workflows": suggested_workflows(config),
        "rollout": rollout_plan(config),
        "services": related_services(config),
        "architecture": build_architecture(config),
    }
