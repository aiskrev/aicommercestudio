"""AI Solution Builder composition rules — Python port of apps/web/src/lib/solution.ts.

The browser designs the solution; the API only receives its enumerated share code and re-derives
everything it stores from that code: whether the composition is valid, the approval floor, the
proposed agents, the complexity band and where a person approves. Parity with the web model is
tested with golden vectors (tests/fixtures/solution_vectors.json ↔ apps/web/src/lib/solution.vectors.json).
Change both implementations together and bump MODEL_VERSION in both.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from app.team.model import AGENT_KEYS, AGENTS, CHECKPOINTS, DEPLOYMENTS

MODEL_VERSION = "2026-11.1"
ACCEPTED_SCHEMAS = ("1", "2")
MAX_CODE_LENGTH = 200

OBJECTIVES = (
    "reduce_handling_time",
    "faster_response",
    "grow_revenue",
    "fewer_errors",
    "scale_capacity",
    "knowledge_access",
)
CAPABILITIES = (
    "rag",
    "extraction",
    "classification",
    "generation",
    "decision_support",
    "tool_execution",
    "orchestration",
    "business_rules",
)
INTEGRATION_CATEGORIES = ("crm", "erp", "email_calendar", "helpdesk", "databases", "document_storage", "internal_apis")
SENSITIVITIES = ("public", "internal", "personal", "regulated")

# Library-only archetypes (apps/web/src/lib/agent-library.ts → LIBRARY_ONLY): role and dependencies.
_LIBRARY_ONLY = {"proposal_generation": ("task", ()), "catalog_assistant": ("task", ())}
LIBRARY_KEYS: tuple[str, ...] = tuple(
    key
    for agent in AGENT_KEYS
    for key in (
        (agent, "proposal_generation")
        if agent == "sales_research"
        else (agent, "catalog_assistant")
        if agent == "content_operations"
        else (agent,)
    )
)


def _role(key: str) -> str:
    return AGENTS[key].role if key in AGENTS else _LIBRARY_ONLY[key][0]


def _requires(key: str) -> tuple[str, ...]:
    return tuple(AGENTS[key].requires) if key in AGENTS else _LIBRARY_ONLY[key][1]


# (key, core agent, chain) — the team workflows plus the library-only ones.
WORKFLOWS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("lead_to_meeting", "lead_qualification", ("lead_qualification", "sales_research", "scheduling")),
    ("support_resolution", "customer_support", ("knowledge_assistant", "customer_support")),
    ("document_intake", "document_processing", ("document_processing", "reporting_insights")),
    ("content_pipeline", "content_operations", ("content_operations",)),
    ("insight_reporting", "reporting_insights", ("reporting_insights",)),
    ("knowledge_answers", "knowledge_assistant", ("knowledge_assistant",)),
    ("proposal_drafting", "proposal_generation", ("sales_research", "proposal_generation")),
    ("catalog_enrichment", "catalog_assistant", ("catalog_assistant",)),
)
WORKFLOW_KEYS = tuple(w[0] for w in WORKFLOWS)
_CHAIN = {key: chain for key, _core, chain in WORKFLOWS}

EXTERNAL_WORKFLOWS = frozenset(
    {"lead_to_meeting", "support_resolution", "content_pipeline", "proposal_drafting", "catalog_enrichment"}
)
WORKFLOW_CAPABILITY = {
    "lead_to_meeting": "classification",
    "support_resolution": "rag",
    "document_intake": "extraction",
    "content_pipeline": "generation",
    "insight_reporting": "decision_support",
    "knowledge_answers": "rag",
    "proposal_drafting": "generation",
    "catalog_enrichment": "generation",
}
WRITABLE = frozenset({"crm", "erp", "email_calendar", "helpdesk", "document_storage", "internal_apis"})
_KNOWLEDGE_SOURCES = frozenset({"document_storage", "databases", "internal_apis"})
_DOCUMENT_SOURCES = frozenset({"document_storage", "email_calendar", "helpdesk"})
_DATA_SOURCES = frozenset({"databases", "crm", "erp"})
_CAPABILITY_AGENT = {
    "rag": "knowledge_assistant",
    "extraction": "document_processing",
    "decision_support": "reporting_insights",
    "orchestration": "workflow_coordinator",
}

COMPOSITION_RULES = (
    "workflow_capability",
    "orchestration_needs_agents",
    "rag_needs_source",
    "extraction_needs_documents",
    "decision_support_needs_data",
    "tool_execution_needs_target",
    "regulated_needs_residency",
    "approval_below_minimum",
)

CAPABILITY_POINTS = {
    "rag": 2,
    "extraction": 2,
    "classification": 1,
    "generation": 1,
    "decision_support": 2,
    "tool_execution": 3,
    "orchestration": 3,
    "business_rules": 1,
}
INTEGRATION_POINTS = {
    "crm": 1,
    "erp": 3,
    "email_calendar": 1,
    "helpdesk": 1,
    "databases": 2,
    "document_storage": 1,
    "internal_apis": 3,
}
_SENSITIVITY_POINTS = {"public": 0, "internal": 0, "personal": 2, "regulated": 3}
_DEPLOYMENT_POINTS = {"managed_cloud": 0, "customer_cloud": 1, "on_premise": 3}
_BANDS = (("high", 15), ("medium", 8), ("low", 0))


@dataclass(frozen=True)
class SolutionConfig:
    objective: str | None
    workflow: str | None
    capabilities: tuple[str, ...]
    integrations: tuple[str, ...]
    sensitivity: str | None
    approval: str | None
    deployment: str | None
    residency: bool
    redaction: bool


def _rank(checkpoint: str) -> int:
    return CHECKPOINTS.index(checkpoint)


def minimum_approval(config: SolutionConfig) -> str:
    checkpoint = "sample_review"
    caps = set(config.capabilities)
    if config.workflow in EXTERNAL_WORKFLOWS and "generation" in caps:
        checkpoint = "before_external"
    if "tool_execution" in caps:
        checkpoint = "before_external"
    if config.sensitivity == "regulated" and "tool_execution" in caps:
        checkpoint = "every_action"
    return checkpoint


def redaction_required(config: SolutionConfig) -> bool:
    return config.sensitivity in ("personal", "regulated")


def normalise(config: SolutionConfig) -> SolutionConfig:
    base = replace(
        config,
        capabilities=tuple(c for c in CAPABILITIES if c in config.capabilities),
        integrations=tuple(i for i in INTEGRATION_CATEGORIES if i in config.integrations),
    )
    floor = minimum_approval(base)
    approval = base.approval
    if approval is not None and _rank(approval) < _rank(floor):
        approval = floor
    return replace(base, approval=approval, redaction=base.redaction or redaction_required(base))


def _with_dependencies(selected: set[str], key: str) -> None:
    selected.add(key)
    for required in _requires(key):
        if required not in selected:
            _with_dependencies(selected, required)


def proposed_agents(config: SolutionConfig) -> list[tuple[str, str]]:
    """(agent, reason) in library order."""
    reasons: dict[str, str] = {}
    if config.workflow:
        for agent in _CHAIN[config.workflow]:
            reasons.setdefault(agent, "workflow")
    for capability in CAPABILITIES:
        agent = _CAPABILITY_AGENT.get(capability) if capability in config.capabilities else None
        if agent:
            reasons.setdefault(agent, "capability")
    for agent in list(reasons):
        deps: set[str] = set()
        _with_dependencies(deps, agent)
        for dep in (k for k in LIBRARY_KEYS if k in deps):
            reasons.setdefault(dep, "dependency")
    workers = [a for a in reasons if _role(a) == "task"]
    if config.approval in ("before_external", "every_action") and len(workers) >= 2:
        reasons.setdefault("approval_supervisor", "approval")
    return [(agent, reasons[agent]) for agent in LIBRARY_KEYS if agent in reasons]


def composition_issues(config: SolutionConfig) -> list[str]:
    """Broken composition rules, in rule order (on the raw configuration, like the web model)."""
    caps = set(config.capabilities)
    ints = set(config.integrations)
    tasks = [a for a, _ in proposed_agents(config) if _role(a) == "task"]
    broken = {
        "workflow_capability": bool(config.workflow) and WORKFLOW_CAPABILITY[config.workflow] not in caps,
        "orchestration_needs_agents": "orchestration" in caps and len(tasks) < 2,
        "rag_needs_source": "rag" in caps and not ints & _KNOWLEDGE_SOURCES,
        "extraction_needs_documents": "extraction" in caps and not ints & _DOCUMENT_SOURCES,
        "decision_support_needs_data": "decision_support" in caps and not ints & _DATA_SOURCES,
        "tool_execution_needs_target": "tool_execution" in caps and not ints & WRITABLE,
        "regulated_needs_residency": config.sensitivity == "regulated" and not config.residency,
        "approval_below_minimum": config.approval is not None
        and _rank(config.approval) < _rank(minimum_approval(config)),
    }
    return [rule for rule in COMPOSITION_RULES if broken[rule]]


def is_complete(config: SolutionConfig) -> bool:
    return all(
        (
            config.objective,
            config.workflow,
            config.capabilities,
            config.sensitivity,
            config.approval,
            config.deployment,
        )
    )


def complexity(config: SolutionConfig) -> dict[str, object]:
    c = normalise(config)
    points = sum(CAPABILITY_POINTS[x] for x in c.capabilities) + sum(INTEGRATION_POINTS[x] for x in c.integrations)
    points += _SENSITIVITY_POINTS.get(c.sensitivity or "", 0)
    points += 1 if c.approval == "every_action" else 0
    points += _DEPLOYMENT_POINTS.get(c.deployment or "", 0)
    band = next(name for name, minimum in _BANDS if points >= minimum)
    return {"band": band, "points": points}


def approval_points(config: SolutionConfig) -> list[str]:
    """Components a person approves ("before") or reviews on a sample, in flow order (web: humanApprovalPoints)."""
    c = normalise(config)
    gated = c.approval in ("before_external", "every_action")
    out: list[str] = []
    if gated:
        out.append("review:gate")
    elif c.approval == "sample_review":
        out.append("review:sample_review")
    if c.workflow:
        external = c.workflow in EXTERNAL_WORKFLOWS
        if c.approval == "every_action" or (gated and external) or c.approval == "sample_review":
            out.append(f"output:{c.workflow}")
    if "tool_execution" in c.capabilities and c.approval in ("before_external", "every_action", "sample_review"):
        out.extend(f"action:{i}" for i in c.integrations if i in WRITABLE)
    return out


# --------------------------------------------------------------------------------------- share code


def _indexes(values: list[str], raw: str) -> tuple[str, ...] | None:
    if raw == "-":
        return ()
    if not raw.isdigit() or not raw.isascii():
        return None
    picked = [values[int(d)] if int(d) < len(values) else None for d in raw]
    if any(p is None for p in picked) or len(set(picked)) != len(picked):
        return None
    return tuple(p for p in picked if p is not None)


def parse_code(code: str | None) -> SolutionConfig | None:
    """The configuration a share code describes, before any rule is applied (None when malformed)."""
    if not code or len(code) > MAX_CODE_LENGTH:
        return None
    parts = code.split(".")
    if len(parts) != 9 or parts[0] not in ACCEPTED_SCHEMAS or parts[8] not in ("00", "01", "10", "11"):
        return None
    capabilities = _indexes(list(CAPABILITIES), parts[3])
    integrations = _indexes(list(INTEGRATION_CATEGORIES), parts[4])
    if capabilities is None or integrations is None:
        return None
    for value, allowed in (
        (parts[1], OBJECTIVES),
        (parts[2], WORKFLOW_KEYS),
        (parts[5], SENSITIVITIES),
        (parts[6], CHECKPOINTS),
        (parts[7], DEPLOYMENTS),
    ):
        if value and value not in allowed:
            return None
    return SolutionConfig(
        objective=parts[1] or None,
        workflow=parts[2] or None,
        capabilities=capabilities,
        integrations=integrations,
        sensitivity=parts[5] or None,
        approval=parts[6] or None,
        deployment=parts[7] or None,
        residency=parts[8][0] == "1",
        redaction=parts[8][1] == "1",
    )


def decode(code: str | None) -> tuple[SolutionConfig | None, list[str]]:
    """(normalised design, []) for a complete and valid code; (None, broken rules) otherwise.

    A malformed or incomplete code gives (None, ["malformed"]) / (None, ["incomplete"]).
    """
    raw = parse_code(code)
    if raw is None:
        return None, ["malformed"]
    issues = composition_issues(raw)
    if issues:
        return None, issues
    config = normalise(raw)
    if not is_complete(config):
        return None, ["incomplete"]
    return config, []


def summary(config: SolutionConfig) -> dict[str, object]:
    """What the API stores with an enquiry — derived from the code alone."""
    c = normalise(config)
    return {
        "objective": c.objective,
        "workflow": c.workflow,
        "capabilities": list(c.capabilities),
        "integrations": list(c.integrations),
        "sensitivity": c.sensitivity,
        "approval": c.approval,
        "minimum_approval": minimum_approval(c),
        "deployment": c.deployment,
        "residency": c.residency,
        "redaction": c.redaction,
        "agents": [agent for agent, _ in proposed_agents(c)],
        "complexity": complexity(c),
        "approval_points": approval_points(c),
    }


def encode(config: SolutionConfig) -> str:
    """Share code of a design (web: encodeSolution), normalised first."""
    c = normalise(config)

    def idx(values: tuple[str, ...], chosen: tuple[str, ...]) -> str:
        return "".join(str(values.index(v)) for v in chosen) or "-"

    return ".".join(
        (
            ACCEPTED_SCHEMAS[-1],
            c.objective or "",
            c.workflow or "",
            idx(CAPABILITIES, c.capabilities),
            idx(INTEGRATION_CATEGORIES, c.integrations),
            c.sensitivity or "",
            c.approval or "",
            c.deployment or "",
            f"{int(c.residency)}{int(c.redaction)}",
        )
    )
