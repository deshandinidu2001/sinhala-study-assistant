from collections.abc import Iterator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from backend.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def test_health_requires_a_migrated_vector_database(client: TestClient) -> None:
    with patch("backend.main.database_is_ready", return_value=True):
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_reports_missing_schema(client: TestClient) -> None:
    with patch("backend.main.database_is_ready", return_value=False):
        assert client.get("/health").status_code == 503


def test_health_does_not_expose_database_credentials(client: TestClient) -> None:
    error = OperationalError("secret connection string", {}, Exception("private failure"))
    with patch("backend.main.database_is_ready", side_effect=error):
        response = client.get("/health")
    assert response.status_code == 503
    assert "secret" not in response.text
    assert "private" not in response.text


def test_cors_allows_configured_frontend(client: TestClient) -> None:
    response = client.options("/health", headers={
        "Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET",
    })
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_cors_rejects_unknown_origin(client: TestClient) -> None:
    response = client.options("/health", headers={
        "Origin": "https://untrusted.example", "Access-Control-Request-Method": "GET",
    })
    assert "access-control-allow-origin" not in response.headers
