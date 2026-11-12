"""Interactive demonstrations on simulated data (docs/AI_DEMONSTRATIONS.md). Public, stateless and deterministic.

Nothing is stored and no cookie is set: a run is a pure function of its input. No AI provider is called. The only
free text is a short note that is validated as plain text and only ever *flagged*, never obeyed, echoed or kept.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import AfterValidator, BaseModel, Field

from app.demos import engine
from app.deps import AppSettings, client_ip, enforce_rate_limit
from app.errors import ApiError
from app.ops.workflows import sanitize
from app.schemas import StrictModel


def demo_rate_limit(request: Request, settings: AppSettings) -> None:
    enforce_rate_limit(f"demo:{client_ip(request)}", settings.demo_rate_limit, settings.demo_rate_window_seconds)
    enforce_rate_limit("demo:global", settings.demo_global_rate_limit, settings.demo_rate_window_seconds)


router = APIRouter(prefix="/api/public/demos", tags=["public-demos"])


class FieldOut(BaseModel):
    key: str
    options: list[str]


class ScenarioOut(BaseModel):
    key: str
    fields: list[FieldOut]
    service: str
    configurator: bool


class RunIn(StrictModel):
    # Exactly the scenario's fields, each one of its listed options (checked by the engine, which refuses the rest).
    inputs: dict[str, Annotated[str, Field(max_length=40)]] = Field(max_length=10)
    note: Annotated[str, Field(max_length=engine.NOTE_MAX), AfterValidator(sanitize)] | None = None


class StepOut(BaseModel):
    key: Literal["trigger", "validation", "logic", "output_check", "approval", "proposal"]
    status: Literal["ok", "flagged", "blocked", "skipped", "required", "not_required", "proposed"]
    code: str
    items: list[str]


class RunOut(BaseModel):
    scenario: str
    simulated: Literal[True]
    executed: Literal[False]
    steps: list[StepOut]
    risk: Literal["low", "high", "critical"] | None
    requires_approval: bool
    params: dict[str, Any]
    service: str
    configurator: bool
    limitations: list[str]


def _out(scenario: engine.Scenario) -> ScenarioOut:
    return ScenarioOut(
        key=scenario.key,
        fields=[FieldOut(key=f.key, options=list(f.options)) for f in scenario.fields],
        service=scenario.service,
        configurator=scenario.configurator,
    )


@router.get("", response_model=list[ScenarioOut], summary="The demonstration scenarios and their choices")
def scenarios(response: Response) -> list[ScenarioOut]:
    response.headers["Cache-Control"] = "public, max-age=300"
    return [_out(s) for s in engine.SCENARIOS.values()]


@router.post(
    "/{scenario}/run",
    response_model=RunOut,
    dependencies=[Depends(demo_rate_limit)],
    summary="Run one simulated scenario: the same input always gives the same answer; nothing is executed",
)
def run(scenario: str, payload: RunIn, response: Response) -> RunOut:
    response.headers["Cache-Control"] = "no-store"
    item = engine.SCENARIOS.get(scenario)
    if item is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Unknown demonstration.", "demo_not_found")
    try:
        inputs = engine.validate_inputs(item, payload.inputs)
    except engine.DemoInputError as exc:
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose one of the listed options.", exc.code) from exc
    return RunOut(**engine.run(item, inputs, payload.note))
