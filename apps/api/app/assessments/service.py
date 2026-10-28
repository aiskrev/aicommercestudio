"""Assessment use cases: score, opt-in save, look up, delete and purge.

Privacy design:
* Scoring needs no personal data and stores nothing.
* Saving is the visitor's explicit choice (`save: true`). The row holds the normalised answers and
  the server-computed result only; it is reachable with a secret token whose SHA-256 hash is
  stored. The visitor can delete it with the same token; otherwise it expires.
* Logs carry the assessment key, version, band and fingerprint — never answers or tokens.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.assessments.answers import AnswerError, Answers, validate_answers
from app.assessments.definition import AssessmentDefinition
from app.assessments.registry import extension_for, registry
from app.assessments.scoring import ScoreResult, score
from app.models import AssessmentResultRecord, utcnow

logger = logging.getLogger(__name__)

MAX_TOKEN_LENGTH = 100


class InvalidAnswers(Exception):
    def __init__(self, errors: list[AnswerError]) -> None:
        super().__init__(", ".join(f"{e.question}:{e.code}" for e in errors))
        self.errors = errors


def assess(definition: AssessmentDefinition, raw_answers: dict[str, Any]) -> tuple[Answers, ScoreResult]:
    """Validate (per question, then the extension's cross-question checks) and score."""
    answers, errors = validate_answers(definition, raw_answers)
    extension = extension_for(definition)
    if not errors and extension is not None:
        errors = extension.validate(definition, answers)
    if errors:
        raise InvalidAnswers(errors)
    result = score(definition, answers)
    if extension is not None:
        result = replace(result, extras=extension.derive(definition, answers, result))
    return answers, result


# --------------------------------------------------------------------------- opt-in persistence


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _stored_answers(answers: Answers) -> dict[str, Any]:
    return {k: list(v) if isinstance(v, tuple) else v for k, v in answers.items()}


def save_result(
    db: Session,
    definition: AssessmentDefinition,
    answers: Answers,
    result: ScoreResult,
    *,
    locale: str,
    retention_days: int,
) -> tuple[AssessmentResultRecord, str]:
    now = utcnow()
    token = secrets.token_urlsafe(32)
    row = AssessmentResultRecord(
        created_at=now,
        expires_at=now + timedelta(days=retention_days),
        token_hash=hash_token(token),
        assessment_key=definition.key,
        definition_version=definition.version,
        algorithm=definition.scoring.algorithm,
        locale=locale,
        fingerprint=result.fingerprint,
        answers=_stored_answers(answers),
        result=result.summary(),
    )
    db.add(row)
    db.commit()
    return row, token


def find_result(db: Session, token: str, now: datetime | None = None) -> AssessmentResultRecord | None:
    if not token or len(token) > MAX_TOKEN_LENGTH:
        return None
    row = db.scalar(select(AssessmentResultRecord).where(AssessmentResultRecord.token_hash == hash_token(token)))
    if row is None or row.expires_at <= (now or utcnow()):
        return None
    return row


def delete_result(db: Session, token: str) -> bool:
    """Delete a saved result by its token (also when it has already expired)."""
    if not token or len(token) > MAX_TOKEN_LENGTH:
        return False
    deleted = db.execute(
        delete(AssessmentResultRecord).where(AssessmentResultRecord.token_hash == hash_token(token))
    ).rowcount
    db.commit()
    return bool(deleted)


def rescore_saved(row: AssessmentResultRecord) -> tuple[AssessmentDefinition, ScoreResult]:
    """Re-score a saved result with the definition version it was saved with.

    The stored result is the record; the re-score proves the versioned definition and algorithm still
    reproduce it. A difference means a version was changed in place, which must never happen.
    """
    definition = registry().get(row.assessment_key, row.definition_version)
    if definition is None or definition.scoring.algorithm != row.algorithm:
        raise LookupError(f"definition {row.assessment_key} {row.definition_version} is no longer available")
    _, result = assess(definition, row.answers)
    if result.summary() != row.result:
        logger.error(
            "assessment_rescore_mismatch",
            extra={"assessment": row.assessment_key, "version": row.definition_version, "reference": row.reference},
        )
        raise LookupError("saved result does not match its definition version")
    return definition, result


# --------------------------------------------------------------------------- retention


@dataclass(frozen=True)
class AssessmentRetention:
    due: int
    deleted: int


def count_expired(db: Session, now: datetime | None = None) -> int:
    cutoff = now or utcnow()
    return (
        db.scalar(
            select(func.count()).select_from(AssessmentResultRecord).where(AssessmentResultRecord.expires_at <= cutoff)
        )
        or 0
    )


def purge_expired(db: Session, *, dry_run: bool = False, now: datetime | None = None) -> AssessmentRetention:
    now = now or utcnow()
    due = count_expired(db, now)
    if dry_run:
        return AssessmentRetention(due, 0)
    deleted = db.execute(delete(AssessmentResultRecord).where(AssessmentResultRecord.expires_at <= now)).rowcount or 0
    db.commit()
    return AssessmentRetention(due, deleted)
