from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

MAX_EVENTS = 20


class EventIn(BaseModel):
    type: Literal["view", "click", "tool"]
    path: str = Field(max_length=300)
    locale: Literal["bg", "en"]
    label: str | None = Field(default=None, max_length=200)
    target: str | None = Field(default=None, max_length=300)
    referrer: str | None = Field(default=None, max_length=500)


class CollectIn(BaseModel):
    events: list[EventIn] = Field(min_length=1, max_length=MAX_EVENTS)


class CollectOut(BaseModel):
    enabled: bool


class DayPoint(BaseModel):
    date: date
    views: int
    visits: int


class PageRow(BaseModel):
    path: str
    views: int
    visits: int


class ClickRow(BaseModel):
    page: str
    label: str
    target: str | None
    clicks: int


class CountRow(BaseModel):
    name: str
    count: int


class Summary(BaseModel):
    enabled: bool
    retention_days: int
    days: int
    first_event_at: datetime | None
    views: int
    visits: int
    clicks: int
    tool_events: int
    daily: list[DayPoint]
    top_pages: list[PageRow]
    top_clicks: list[ClickRow]
    referrers: list[CountRow]
    devices: list[CountRow]
    locales: list[CountRow]
    tools: list[CountRow]


class VisitEvent(BaseModel):
    at: datetime
    kind: Literal["view", "click", "tool"]
    path: str
    label: str | None
    target: str | None


class VisitOut(BaseModel):
    id: str
    started_at: datetime
    device: str
    locale: str
    referrer_host: str | None
    events: list[VisitEvent]


class VisitsOut(BaseModel):
    day: date
    visits: list[VisitOut]
