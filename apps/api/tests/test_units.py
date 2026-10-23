"""Pure unit tests (no HTTP): spam tokens and rate limiter."""

from app.rate_limit import RateLimiter
from app.spam import check_form_token, issue_form_token, looks_like_link_spam

SECRET = "unit-test-secret-key-0123456789abcdef"


def test_form_token_lifecycle():
    token = issue_form_token(SECRET, now=1_000)
    assert check_form_token(token, SECRET, 3, 7200, now=1_001) == "too_fast"
    assert check_form_token(token, SECRET, 3, 7200, now=1_010) is None
    assert check_form_token(token, SECRET, 3, 7200, now=1_000 + 7201) == "expired"


def test_form_token_tampering():
    token = issue_form_token(SECRET, now=1_000)
    ts, nonce, sig = token.split(".")
    assert check_form_token(f"999.{nonce}.{sig}", SECRET, 0, 10**9, now=2_000) == "bad_signature"
    assert check_form_token(token, "other-secret-key-0123456789abcdef", 0, 10**9, now=2_000) == "bad_signature"
    assert check_form_token("a.b", SECRET, 0, 10, now=0) == "malformed"
    assert check_form_token(None, SECRET, 0, 10, now=0) == "missing"


def test_link_spam_heuristic():
    assert not looks_like_link_spam("Вижте https://example.com за повече информация.")
    assert looks_like_link_spam(" ".join(["http://a.example"] * 4))


def test_rate_limiter_sliding_window():
    limiter = RateLimiter()
    for i in range(3):
        assert limiter.hit("k", 3, 60, now=100 + i).allowed
    blocked = limiter.hit("k", 3, 60, now=110)
    assert not blocked.allowed and blocked.retry_after > 0
    assert limiter.hit("other", 3, 60, now=110).allowed
    assert limiter.hit("k", 3, 60, now=161).allowed  # first hit left the window
