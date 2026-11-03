"""Regenerate the AI Solution Builder golden vectors (tests/fixtures/solution_vectors.json); copy the
file to apps/web/src/lib/solution.vectors.json afterwards (scripts/test.ps1 checks both copies are identical).

    docker compose --profile test run --rm --no-deps -v "${PWD}/apps/api:/app" -e PYTHONPATH=/app
        api-tests python scripts/gen_solution_vectors.py   (one command)
"""

from __future__ import annotations

import json
from pathlib import Path

from app.solution.model import (
    CAPABILITIES,
    CHECKPOINTS,
    DEPLOYMENTS,
    INTEGRATION_CATEGORIES,
    MODEL_VERSION,
    OBJECTIVES,
    SENSITIVITIES,
    WORKFLOW_KEYS,
    SolutionConfig,
    composition_issues,
    decode,
    encode,
    minimum_approval,
    parse_code,
    summary,
)

OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "solution_vectors.json"
SUPPORT = "2.faster_response.support_resolution.023.35.personal.before_external.managed_cloud.01"


class Lcg:
    def __init__(self, seed: int) -> None:
        self.state = seed

    def next(self, n: int) -> int:
        self.state = (self.state * 1103515245 + 12345) % 2**31
        return self.state % n

    def pick(self, items):
        return items[self.next(len(items))]

    def subset(self, items, chance: int) -> tuple[str, ...]:
        return tuple(i for i in items if self.next(chance) == 0)


def random_code(rng: Lcg) -> str:
    """Raw codes (not normalised), so tampered approvals and broken compositions are covered too."""
    config = SolutionConfig(
        objective=rng.pick(OBJECTIVES),
        workflow=rng.pick(WORKFLOW_KEYS),
        capabilities=rng.subset(CAPABILITIES, 3),
        integrations=rng.subset(INTEGRATION_CATEGORIES, 3),
        sensitivity=rng.pick(SENSITIVITIES),
        approval=rng.pick(CHECKPOINTS),
        deployment=rng.pick(DEPLOYMENTS),
        residency=bool(rng.next(2)),
        redaction=bool(rng.next(2)),
    )
    idx = lambda values, chosen: "".join(str(values.index(v)) for v in chosen) or "-"  # noqa: E731
    return ".".join(
        (
            "2",
            config.objective or "",
            config.workflow or "",
            idx(CAPABILITIES, config.capabilities),
            idx(INTEGRATION_CATEGORIES, config.integrations),
            config.sensitivity or "",
            config.approval or "",
            config.deployment or "",
            f"{int(config.residency)}{int(config.redaction)}",
        )
    )


def edge_cases() -> list[str]:
    return [
        SUPPORT,
        SUPPORT.replace("2.", "1.", 1),
        SUPPORT.replace(".before_external.", ".none."),
        SUPPORT.replace(".023.", ".0023."),
        SUPPORT.replace(".023.", ".09."),
        SUPPORT.replace(".managed_cloud.", ".."),
        "2.fewer_errors.document_intake.125.15.regulated.every_action.on_premise.10",
        "2.fewer_errors.document_intake.125.15.regulated.every_action.on_premise.00",
        "2.grow_revenue.proposal_drafting.037.15.personal.before_external.customer_cloud.11",
        "2.scale_capacity.catalog_enrichment.2357.15.internal.before_external.managed_cloud.00",
        "2.knowledge_access.knowledge_answers.06.5.internal.sample_review.managed_cloud.00",
        "3.x",
        "",
    ]


def expected(code: str) -> dict:
    raw = parse_code(code)
    config, _ = decode(code)
    return {
        "parsed": raw is not None,
        "issues": composition_issues(raw) if raw else None,
        "minimum_approval": minimum_approval(raw) if raw else None,
        "valid": config is not None,
        "code": encode(config) if config else None,
        "summary": summary(config) if config else None,
    }


def main() -> None:
    rng = Lcg(20261103)
    codes = edge_cases()
    valid = sum(1 for c in codes if decode(c)[0])
    # Enough valid designs as well as rejected ones.
    while len(codes) < 120 or valid < 30:
        code = random_code(rng)
        if code in codes:
            continue
        ok = decode(code)[0] is not None
        if not ok and len(codes) - valid >= 90:
            continue
        codes.append(code)
        valid += ok
    vectors = [{"code": c, "expected": expected(c)} for c in codes]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"model_version": MODEL_VERSION, "vectors": vectors}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    print(len(vectors), "vectors,", valid, "valid ->", OUT)


if __name__ == "__main__":
    main()
