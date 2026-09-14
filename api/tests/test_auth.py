from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models.entities import (
    AuthAccount,
    AuthSession,
    Base,
    EmailVerificationToken,
    PasswordResetToken,
    User,
)
from app.routes import auth as auth_routes


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
AUTH_TABLES = [
    AuthSession.__table__,
    PasswordResetToken.__table__,
    EmailVerificationToken.__table__,
    AuthAccount.__table__,
    User.__table__,
]


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    Base.metadata.drop_all(bind=engine, tables=AUTH_TABLES)
    Base.metadata.create_all(bind=engine, tables=list(reversed(AUTH_TABLES)))

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[auth_routes.get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_register_login_me_and_logout(client: TestClient) -> None:
    register_response = client.post(
        "/auth/register",
        json={
            "email": "Student@Example.com",
            "password": "correct-horse",
            "full_name": "Ada Student",
        },
    )

    assert register_response.status_code == 201
    register_body = register_response.json()
    assert register_body["token_type"] == "bearer"
    assert register_body["access_token"]
    assert register_body["expires_in"] > 0
    assert register_body["user"]["email"] == "student@example.com"
    assert register_body["user"]["full_name"] == "Ada Student"
    assert register_body["user"]["is_active"] is True
    assert register_body["user"]["is_email_verified"] is False

    login_response = client.post(
        "/auth/login",
        json={"email": "student@example.com", "password": "correct-horse"},
    )

    assert login_response.status_code == 200
    login_body = login_response.json()
    assert login_body["access_token"]
    assert login_body["user"]["id"] == register_body["user"]["id"]

    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {login_body['access_token']}"},
    )

    assert me_response.status_code == 200
    assert me_response.json() == login_body["user"]

    logout_response = client.post(
        "/auth/logout", headers={"Authorization": f"Bearer {login_body['access_token']}"}
    )
    me_after_logout = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {login_body['access_token']}"},
    )

    assert logout_response.status_code == 200
    assert logout_response.json() == {"status": "ok", "message": "Logged out."}
    assert me_after_logout.status_code == 401


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    payload = {"email": "student@example.com", "password": "correct-horse"}

    assert client.post("/auth/register", json=payload).status_code == 201
    response = client.post("/auth/register", json=payload)

    assert response.status_code == 409
    assert response.json()["error"]["message"] == "Email is already registered."


def test_login_rejects_invalid_credentials(client: TestClient) -> None:
    client.post(
        "/auth/register",
        json={"email": "student@example.com", "password": "correct-horse"},
    )
    response = client.post(
        "/auth/login",
        json={"email": "student@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Invalid email or password."


def test_forgot_and_reset_password_flow(client: TestClient) -> None:
    client.post(
        "/auth/register",
        json={"email": "student@example.com", "password": "old-password"},
    )

    captured: dict[str, str] = {}

    def capture_otp(**kwargs) -> None:
        captured["code"] = kwargs["code"]

    with patch("app.services.auth.send_auth_otp", side_effect=capture_otp):
        forgot_response = client.post(
            "/auth/forgot-password",
            json={"email": "student@example.com"},
        )

    reset_code = captured["code"]
    reset_response = client.post(
        "/auth/reset-password",
        json={
            "email": "student@example.com",
            "code": reset_code,
            "new_password": "new-password",
        },
    )
    login_response = client.post(
        "/auth/login",
        json={"email": "student@example.com", "password": "new-password"},
    )
    reuse_response = client.post(
        "/auth/reset-password",
        json={
            "email": "student@example.com",
            "code": reset_code,
            "new_password": "another-pass",
        },
    )

    assert forgot_response.status_code == 200
    assert forgot_response.json()["status"] == "pending_verification"
    assert reset_code
    assert reset_response.status_code == 200
    assert reset_response.json()["message"] == "Password has been reset."
    assert login_response.status_code == 200
    assert reuse_response.status_code == 401


def test_email_verification_request_and_confirm(client: TestClient) -> None:
    client.post(
        "/auth/register",
        json={"email": "student@example.com", "password": "correct-horse"},
    )

    captured: dict[str, str] = {}

    def capture_otp(**kwargs) -> None:
        captured["code"] = kwargs["code"]

    with patch("app.services.auth.send_auth_otp", side_effect=capture_otp):
        request_response = client.post(
            "/auth/email-verification/request",
            json={"email": "student@example.com"},
        )

    code = captured["code"]
    confirm_response = client.post(
        "/auth/email-verification/confirm",
        json={"email": "student@example.com", "code": code},
    )
    reuse_response = client.post(
        "/auth/email-verification/confirm",
        json={"email": "student@example.com", "code": code},
    )

    assert request_response.status_code == 200
    assert request_response.json()["status"] == "pending_verification"
    assert request_response.json()["email"] == "student@example.com"
    assert code
    assert confirm_response.status_code == 200
    assert confirm_response.json()["is_email_verified"] is True
    assert reuse_response.status_code == 401


def test_oauth_authorize_placeholder(client: TestClient) -> None:
    response = client.get("/auth/oauth/google/authorize")

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "google"
    assert body["state"]
    assert body["authorization_url"].startswith("https://oauth.local/google/authorize")


def test_invalid_tokens_are_rejected(client: TestClient) -> None:
    me_response = client.get("/auth/me", headers={"Authorization": "Bearer missing-token"})
    reset_response = client.post(
        "/auth/reset-password",
        json={
            "email": "missing@example.com",
            "code": "000000",
            "new_password": "new-password",
        },
    )
    verification_response = client.post(
        "/auth/email-verification/confirm",
        json={"email": "missing@example.com", "code": "000000"},
    )

    assert me_response.status_code == 401
    assert reset_response.status_code == 401
    assert verification_response.status_code == 401
