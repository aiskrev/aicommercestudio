"""Regenerate the AI readiness golden vectors (tests/fixtures/readiness_vectors.json); copy the file to
apps/web/src/lib/readiness.vectors.json afterwards (scripts/test.ps1 checks both copies are identical).

    docker compose --profile test run --rm --no-deps -v "${PWD}/apps/api:/app" -e PYTHONPATH=/app
        api-tests python scripts/gen_readiness_vectors.py   (one command)

The set is deterministic: the minimum and the maximum, every uniform level, answer sets that land
exactly on both sides of each band threshold, each blocker on its own, and seeded random sets.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.readiness.scoring import BAND_THRESHOLDS, MAX_ANSWER, MODEL_VERSION, QUESTION_ORDER, score

OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "readiness_vectors.json"

# One trigger per blocker, applied to an otherwise perfect answer set.
BLOCKER_TRIGGERS: tuple[dict[str, int], ...] = (
    {"gov_data_protection": 1},
    {"gov_oversight": 0},
    {"data_quality": 1},
    {"tech_integration": 1},
    {"talent_support": 0},
    {"people_ownership": 1},
    {"people_change": 0},
)


class Lcg:
    def __init__(self, seed: int) -> None:
        self.state = seed

    def next(self, n: int) -> int:
        self.state = (self.state * 1103515245 + 12345) % 2**31
        return self.state % n


def uniform(level: int) -> dict[str, int]:
    return {q: level for q in QUESTION_ORDER}


def main() -> None:
    answer_sets: list[dict[str, int]] = [uniform(level) for level in range(MAX_ANSWER + 1)]
    answer_sets += [{**uniform(MAX_ANSWER), **trigger} for trigger in BLOCKER_TRIGGERS]

    # Exactly on, and just below, every band minimum (searched with a fixed seed).
    targets = {minimum + offset for _, minimum in BAND_THRESHOLDS if minimum > 0 for offset in (-1, 0)}
    rng = Lcg(20261101)
    while targets:
        candidate = {q: rng.next(MAX_ANSWER + 1) for q in QUESTION_ORDER}
        overall = score(candidate).overall
        if overall in targets:
            targets.discard(overall)
            answer_sets.append(candidate)

    random = Lcg(7)
    answer_sets += [{q: random.next(MAX_ANSWER + 1) for q in QUESTION_ORDER} for _ in range(40)]

    vectors = [{"answers": dict(sorted(a.items())), "expected": score(a).summary()} for a in answer_sets]
    payload = {"model_version": MODEL_VERSION, "vectors": vectors}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(vectors)} vectors, model {MODEL_VERSION})")


if __name__ == "__main__":
    main()
