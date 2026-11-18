"""SEC-05: request counters shared between API processes and kept across restarts (RATE_LIMIT_BACKEND=postgres).

The default stays the in-memory limiter. These tests run the shared one on the real PostgreSQL of the test
database, through the same `limiter` the routes use.
"""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import text

from app.config import Settings, get_settings
from app.db import get_sessionmaker
from app.deps import enforce_rate_limit
from app.errors import ApiError
from app.main import rate_limit_backend_error
from app.rate_limit import Limiter, limiter


@pytest.fixture
def shared(monkeypatch):
    monkeypatch.setattr(get_settings(), "rate_limit_backend", "postgres")
    limiter.reset()
    return limiter


def test_the_default_backend_is_the_in_memory_limiter():
    assert Settings.model_fields["rate_limit_backend"].default == "memory"
    assert get_settings().rate_limit_backend == "memory"


def test_the_shared_limit_blocks_after_the_limit_and_reports_retry_after(shared):
    results = [shared.hit("form:203.0.113.7", 3, 60) for _ in range(5)]
    assert [r.allowed for r in results] == [True, True, True, False, False]
    assert 1 <= results[-1].retry_after <= 60
    assert shared.hit("form:203.0.113.8", 3, 60).allowed  # another client is unaffected


def test_the_limit_survives_a_restart_of_the_process(shared):
    for _ in range(3):
        assert shared.hit("restart-key", 3, 60).allowed
    restarted = Limiter()  # a new process: empty memory, same database
    assert not restarted.hit("restart-key", 3, 60).allowed
    # The same restart under the in-memory limiter forgets everything: the reason the shared one exists.
    assert Limiter().memory.hit("restart-key", 3, 60).allowed


def test_concurrent_requests_never_exceed_the_limit(shared):
    with ThreadPoolExecutor(max_workers=16) as pool:
        outcomes = list(pool.map(lambda _: shared.hit("burst", 10, 60).allowed, range(60)))
    assert outcomes.count(True) == 10
    assert outcomes.count(False) == 50


def test_two_processes_share_one_budget(shared):
    first, second = Limiter(), Limiter()
    allowed = []
    for _ in range(3):
        allowed += [first.hit("budget", 4, 60).allowed, second.hit("budget", 4, 60).allowed]
    assert allowed.count(True) == 4


def test_the_window_resets_after_it_ends(shared):
    assert shared.hit("short", 1, 1).allowed
    assert not shared.hit("short", 1, 1).allowed
    time.sleep(1.2)
    assert shared.hit("short", 1, 1).allowed


def test_the_table_keeps_no_address_or_e_mail(shared):
    shared.hit("login-ip:198.51.100.23", 5, 60)
    shared.hit("login-email:someone@example.com", 5, 60)
    with get_sessionmaker()() as db:
        keys = db.execute(text("SELECT key FROM rate_limit_buckets")).scalars().all()
    assert keys and all(len(k) == 64 and set(k) <= set("0123456789abcdef") for k in keys)


def test_routes_get_a_429_with_retry_after_from_the_shared_limit(shared):
    for _ in range(2):
        enforce_rate_limit("route-key", 2, 60)
    with pytest.raises(ApiError) as caught:
        enforce_rate_limit("route-key", 2, 60)
    assert caught.value.status_code == 429
    assert caught.value.headers and int(caught.value.headers["Retry-After"]) >= 1


def test_a_database_fault_falls_back_to_the_per_process_limit_instead_of_failing(shared, monkeypatch):
    def broken(*_args, **_kwargs):
        raise RuntimeError("database unavailable")

    monkeypatch.setattr("app.accounts.limits.consume", broken)
    assert shared.hit("fallback", 2, 60).allowed
    assert shared.hit("fallback", 2, 60).allowed
    assert not shared.hit("fallback", 2, 60).allowed  # still limited, no exception


def _production(**overrides) -> Settings:
    values = {
        "app_env": "production",
        "secret_key": "Zx8k2P0q-unique-production-grade-key-9f3a1c7e",
        "cors_origins": "https://shop-studio.invalid",
        "site_url": "https://shop-studio.invalid",
        "database_url": "postgresql+psycopg://acs_app_api:p@localhost/db",
        "seed_sample_data": False,
        "cookie_secure": None,
        "enable_api_docs": None,
    }
    values.update(overrides)
    return Settings(**values)


def test_production_refuses_several_workers_with_per_process_counters():
    assert rate_limit_backend_error(_production(), None) is None
    assert rate_limit_backend_error(_production(), "1") is None
    assert "WEB_CONCURRENCY=2" in rate_limit_backend_error(_production(), "2")
    assert rate_limit_backend_error(_production(rate_limit_backend="postgres"), "4") is None
    assert rate_limit_backend_error(_production(), "not-a-number") is None
