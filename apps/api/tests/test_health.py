def test_liveness(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_checks_database(client):
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"


def test_request_id_header_is_returned(client):
    response = client.get("/api/health")
    assert len(response.headers["X-Request-ID"]) >= 8


def test_openapi_schema_available_outside_production(client):
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    assert "/api/public/leads" in response.json()["paths"]
