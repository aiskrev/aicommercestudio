"""Loads and validates every assessment definition shipped with the code.

Layout: `app/assessments/definitions/<key>/<major>.<minor>.<patch>.json`. Every version stays in
the repository: the newest version scores new requests, older versions re-render saved results that
were scored with them. Definitions are never read from the database or from user input.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.assessments.definition import AssessmentDefinition
from app.assessments.extensions import EXTENSIONS, AssessmentExtension

DEFINITIONS_DIR = Path(__file__).resolve().parent / "definitions"


def _version_tuple(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split("."))


@dataclass(frozen=True)
class Registry:
    versions: dict[str, dict[str, AssessmentDefinition]]

    def keys(self) -> list[str]:
        return sorted(self.versions)

    def current(self, key: str) -> AssessmentDefinition | None:
        versions = self.versions.get(key)
        if not versions:
            return None
        return versions[max(versions, key=_version_tuple)]

    def get(self, key: str, version: str) -> AssessmentDefinition | None:
        return self.versions.get(key, {}).get(version)

    def available(self, *, preview_enabled: bool) -> list[AssessmentDefinition]:
        """Current definitions that may be served publicly."""
        current = [self.current(key) for key in self.keys()]
        return [d for d in current if d is not None and (d.status == "live" or preview_enabled)]


def load_definition(path: Path) -> AssessmentDefinition:
    definition = AssessmentDefinition.model_validate(json.loads(path.read_text(encoding="utf-8")))
    if path.parent.name != definition.key or path.stem != definition.version:
        raise ValueError(f"{path}: file location does not match key {definition.key} / version {definition.version}")
    if definition.extension is not None and definition.extension not in EXTENSIONS:
        raise ValueError(f"{path}: unknown extension {definition.extension}")
    return definition


def build_registry(root: Path = DEFINITIONS_DIR) -> Registry:
    versions: dict[str, dict[str, AssessmentDefinition]] = {}
    for path in sorted(root.glob("*/*.json")):
        definition = load_definition(path)
        versions.setdefault(definition.key, {})[definition.version] = definition
    return Registry(versions)


@lru_cache(maxsize=1)
def registry() -> Registry:
    return build_registry()


def extension_for(definition: AssessmentDefinition) -> AssessmentExtension | None:
    return EXTENSIONS.get(definition.extension) if definition.extension else None
