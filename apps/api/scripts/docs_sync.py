"""Keep the API documentation in sync with the code.

Check (run by scripts/test.ps1 as part of the API suite; the repository is mounted read-only at /repo):

    docker compose --profile test run --rm --no-deps -v "${PWD}:/repo:ro" api-tests python scripts/docs_sync.py

Regenerate docs/openapi.json (writes the file; mount the repository read-write):

    docker compose --profile test run --rm --no-deps -v "${PWD}:/repo" api-tests python scripts/docs_sync.py --write

Checks:
1. docs/openapi.json is valid JSON and identical to the spec generated from the code.
2. docs/API_REFERENCE.md mentions every route (method and path on the same line; path parameters may
   use any name, e.g. `{id}` for `{lead_id}`).
3. README.md links every document in docs/.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO = Path("/repo")
PARAM = re.compile(r"\{[^}/]+\}")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # the API package (apps/api)


def generated_spec() -> str:
    from app.main import app

    return json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n"


def operations(spec: dict) -> list[tuple[str, str]]:
    return [(method.upper(), path) for path, ops in sorted(spec["paths"].items()) for method in ops]


def missing_from_reference(ops: list[tuple[str, str]], reference: str) -> list[str]:
    lines = [PARAM.sub("{}", line) for line in reference.splitlines()]
    missing = []
    for method, path in ops:
        pattern = re.compile(re.escape(PARAM.sub("{}", path)) + r"(?![\w/{])")
        if not any(method in line and pattern.search(line) for line in lines):
            missing.append(f"{method} {path}")
    return missing


def unlinked_docs(readme: str, docs: Path) -> list[str]:
    return sorted(p.name for p in docs.glob("*.md") if f"docs/{p.name}" not in readme)


def main(argv: list[str]) -> int:
    spec_text = generated_spec()
    target = REPO / "docs" / "openapi.json"
    if "--write" in argv:
        target.write_text(spec_text, encoding="utf-8")
        print(f"wrote {target} ({len(json.loads(spec_text)['paths'])} paths)")
        return 0

    problems: list[str] = []
    try:
        if target.read_text(encoding="utf-8") != spec_text:
            problems.append("docs/openapi.json differs from the code; regenerate it with docs_sync.py --write")
    except (OSError, UnicodeDecodeError) as exc:
        problems.append(f"docs/openapi.json cannot be read: {exc}")

    reference = (REPO / "docs" / "API_REFERENCE.md").read_text(encoding="utf-8")
    undocumented = missing_from_reference(operations(json.loads(spec_text)), reference)
    problems += [f"API_REFERENCE.md does not document {op}" for op in undocumented]

    readme = (REPO / "README.md").read_text(encoding="utf-8")
    problems += [f"README.md does not link docs/{name}" for name in unlinked_docs(readme, REPO / "docs")]

    for problem in problems:
        print(f"docs out of sync: {problem}")
    if not problems:
        print("docs in sync: openapi.json, API_REFERENCE.md routes, README links")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
