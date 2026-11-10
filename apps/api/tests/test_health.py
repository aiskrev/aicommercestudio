def test_liveness(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_checks_database(client):
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"


def test_readiness_reports_the_host_self_check(client, settings, monkeypatch, tmp_path):
    from app.routers.health import host_status

    assert "host" not in client.get("/api/health/ready").json()  # not configured: not reported
    status_file = tmp_path / "status.json"
    monkeypatch.setattr(settings, "host_selfcheck_file", str(status_file))
    assert client.get("/api/health/ready").json()["host"] == "unknown"  # no result yet

    status_file.write_text('{"checked_at": 1000, "ok": true}')
    assert host_status(str(status_file), now=1000 + 60) == "ok"
    assert host_status(str(status_file), now=1000 + 46 * 60) == "stale"
    status_file.write_text('{"checked_at": 1000, "ok": false}')
    assert host_status(str(status_file), now=1060) == "degraded"
    status_file.write_text("not json")
    assert host_status(str(status_file), now=1060) == "unknown"

    import time

    status_file.write_text(f'{{"checked_at": {time.time()}, "ok": false}}')
    response = client.get("/api/health/ready")
    # A degraded host is reported but does not fail readiness (that would restart the API).
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok", "host": "degraded"}


def test_request_id_header_is_returned(client):
    response = client.get("/api/health")
    assert len(response.headers["X-Request-ID"]) >= 8


def test_openapi_schema_available_outside_production(client):
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    assert "/api/public/leads" in response.json()["paths"]
