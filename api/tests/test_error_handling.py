from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import ApiError, RateLimitError, install_error_handlers
from app.main import app


def test_not_found_returns_structured_error() -> None:
    client = TestClient(app)

    response = client.get("/missing-route", headers={"x-request-id": "test-request-id"})

    assert response.status_code == 404
    assert response.headers["x-request-id"] == "test-request-id"
    assert response.json()["error"] == {
        "code": "http_error",
        "message": "Not Found",
        "request_id": "test-request-id",
    }


def test_validation_error_returns_field_errors() -> None:
    client = TestClient(app)

    response = client.post("/auth/login", json={})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["message"] == "Please fix the highlighted fields and try again."
    assert "request_id" in body["error"]
    assert "email" in body["error"]["fields"]
    assert "password" in body["error"]["fields"]


def test_unhandled_error_is_masked_from_client() -> None:
    test_app = FastAPI()
    install_error_handlers(test_app)

    @test_app.get("/boom")
    def boom() -> None:
        raise RuntimeError("database password leaked")

    client = TestClient(test_app, raise_server_exceptions=False)

    response = client.get("/boom", headers={"x-request-id": "boom-request-id"})

    assert response.status_code == 500
    assert response.headers["x-request-id"] == "boom-request-id"
    assert response.json()["error"] == {
        "code": "internal_server_error",
        "message": "Something went wrong. Please try again.",
        "request_id": "boom-request-id",
    }


def test_api_error_uses_typed_code_and_fields() -> None:
    test_app = FastAPI()
    install_error_handlers(test_app)

    @test_app.get("/typed")
    def typed_error() -> None:
        raise ApiError(
            message="The study set name is already taken.",
            code="study_set_duplicate",
            status_code=409,
            fields={"name": ["Choose a different name."]},
        )

    client = TestClient(test_app)

    response = client.get("/typed", headers={"x-request-id": "typed-request-id"})

    assert response.status_code == 409
    assert response.headers["x-request-id"] == "typed-request-id"
    assert response.json()["error"] == {
        "code": "study_set_duplicate",
        "message": "The study set name is already taken.",
        "request_id": "typed-request-id",
        "fields": {"name": ["Choose a different name."]},
    }


def test_rate_limit_error_preserves_retry_after_header() -> None:
    test_app = FastAPI()
    install_error_handlers(test_app)

    @test_app.get("/limited")
    def limited() -> None:
        raise RateLimitError(retry_after=30)

    client = TestClient(test_app)

    response = client.get("/limited")

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "30"
    assert response.json()["error"]["code"] == "rate_limited"
