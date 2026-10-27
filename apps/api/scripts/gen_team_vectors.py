"""Regenerate the AI team golden vectors (tests/fixtures/team_vectors.json); copy the file to
apps/web/src/lib/team.vectors.json afterwards (scripts/test.ps1 checks both copies are identical).

    docker compose --profile test run --rm --no-deps -v "${PWD}/apps/api:/app" -e PYTHONPATH=/app
        api-tests python scripts/gen_team_vectors.py   (one command)
"""

from __future__ import annotations

import json
from pathlib import Path

from app.team.model import (
    AGENT_KEYS,
    AGENTS,
    CHALLENGES,
    CHECKPOINTS,
    COMPANY_SIZES,
    DEPARTMENTS,
    DEPLOYMENTS,
    INDUSTRIES,
    MODEL_VERSION,
    OPERATIONS,
    VOLUMES,
    TeamConfig,
    selected_agents,
    selection_issues,
    summary,
)

OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "team_vectors.json"


class Lcg:
    def __init__(self, seed: int) -> None:
        self.state = seed

    def next(self, n: int) -> int:
        self.state = (self.state * 1103515245 + 12345) % 2**31
        return self.state % n

    def pick(self, items):
        return items[self.next(len(items))]


def random_config(rng: Lcg) -> TeamConfig:
    context = {
        "industry": rng.pick(INDUSTRIES),
        "size": rng.pick(COMPANY_SIZES),
        "lead_department": rng.pick(DEPARTMENTS),
        "challenge": rng.pick(CHALLENGES),
        "volume": rng.pick(VOLUMES),
    }
    departments = sorted(
        {context["lead_department"], *(rng.pick(DEPARTMENTS) for _ in range(rng.next(3)))}, key=DEPARTMENTS.index
    )
    chosen = sorted({rng.pick(AGENT_KEYS) for _ in range(1 + rng.next(5))}, key=AGENT_KEYS.index)
    agents = {}
    for agent in chosen:
        if rng.next(2):
            definition = AGENTS[agent]
            optional = [i for i in definition.optional_integrations if rng.next(2)]
            agents[agent] = {
                "volume": rng.pick(VOLUMES),
                "checkpoint": rng.pick(CHECKPOINTS),
                "integrations": [*definition.integrations, *optional],
            }
    return TeamConfig(context, departments, chosen, agents, rng.pick(DEPLOYMENTS), rng.pick(OPERATIONS))


def edge_cases() -> list[TeamConfig]:
    base = {
        "industry": "ecommerce",
        "size": "s1_10",
        "lead_department": "support",
        "challenge": "slow_response",
        "volume": "v_gt10k",
    }
    return [
        TeamConfig(base, ["support"], ["customer_support"], {}, "managed_cloud", "shared"),
        TeamConfig(base, ["support", "finance"], list(AGENT_KEYS), {}, "on_premise", "internal"),
        TeamConfig(
            {**base, "volume": "v_lt100"}, ["sales"], ["sales_research"], {}, "customer_cloud", "studio_managed"
        ),
        TeamConfig(
            base,
            ["operations"],
            ["document_processing", "reporting_insights", "workflow_coordinator"],
            {"document_processing": {"volume": "v1k_10k", "checkpoint": "every_action", "integrations": ["erp"]}},
            "managed_cloud",
            "shared",
        ),
    ]


def main() -> None:
    rng = Lcg(20261027)
    configs = edge_cases()
    while len(configs) < 64:
        config = random_config(rng)
        if not selection_issues(selected_agents(config)):
            configs.append(config)
    vectors = [{"config": c.to_dict(), "expected": summary(c)} for c in configs]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"model_version": MODEL_VERSION, "vectors": vectors}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    print(len(vectors), "vectors ->", OUT)


if __name__ == "__main__":
    main()
