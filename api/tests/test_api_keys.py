from collections.abc import Generator
from sqlalchemy import select
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decrypt_secret, encrypt_secret
from app.main import app
from app.models.entities import AuthSession, Base, ChatThread, User, UserApiKey
from app.services.api_keys import create_api_key, list_api_keys, mask_key_last4
from app.schemas.settings import ApiKeyCreateRequest


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

TABLES = [
    AuthSession.__table__,
    ChatThread.__table__,
    UserApiKey.__table__,
    User.__table__,
]


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    Base.metadata.drop_all(bind=engine, tables=TABLES)
    Base.metadata.create_all(bind=engine, tables=list(reversed(TABLES)))
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client: TestClient, db: Session) -> dict[str, str]:
    from app.core.security import hash_token

    user = User(name="Ada", email="ada@example.com", password_hash="x")
    db.add(user)
    db.flush()
    token = "test-token"
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime(2099, 1, 1, tzinfo=UTC),
        )
    )
    db.commit()
    return {"Authorization": f"Bearer {token}"}


def test_encrypt_decrypt_roundtrip() -> None:
    secret = "test-secret"
    encrypted = encrypt_secret("sk-openai-test-key", secret=secret)
    assert encrypted != "sk-openai-test-key"
    assert decrypt_secret(encrypted, secret=secret) == "sk-openai-test-key"


def test_mask_key_last4() -> None:
    assert mask_key_last4("sk-abcdefghijklmnop") == "mnop"


@patch("app.services.api_keys.get_adapter")
def test_create_api_key_validates_and_stores(mock_get_adapter: MagicMock, db: Session) -> None:
    user = User(name="Ada", email="ada@example.com", password_hash="x")
    db.add(user)
    db.commit()

    adapter = MagicMock()
    mock_get_adapter.return_value = adapter

    response = create_api_key(
        db,
        user,
        ApiKeyCreateRequest(provider="openai", api_key="sk-openai-test-key-1234", label="Personal"),
    )

    adapter.validate_key.assert_called_once_with("sk-openai-test-key-1234")
    assert response.provider == "openai"
    assert response.key_last4 == "1234"
    assert response.is_valid is True

    stored = db.scalars(
        select(UserApiKey).where(UserApiKey.user_id == user.id)
    ).first()
    assert stored is not None


@patch("app.services.api_keys.get_adapter")
def test_list_and_delete_api_keys(mock_get_adapter: MagicMock, client: TestClient, auth_headers: dict[str, str], db: Session) -> None:
    adapter = MagicMock()
    mock_get_adapter.return_value = adapter

    create_response = client.post(
        "/settings/api-keys",
        headers=auth_headers,
        json={"provider": "openai", "api_key": "sk-openai-test-key-9999", "label": "Mine"},
    )
    assert create_response.status_code == 201
    key_id = create_response.json()["id"]
    assert create_response.json()["key_last4"] == "9999"
    assert "api_key" not in create_response.json()

    list_response = client.get("/settings/api-keys", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    delete_response = client.delete(f"/settings/api-keys/{key_id}", headers=auth_headers)
    assert delete_response.status_code == 204
    assert client.get("/settings/api-keys", headers=auth_headers).json() == []


@patch("app.services.api_keys.get_adapter")
def test_create_api_key_rejects_invalid_key(mock_get_adapter: MagicMock, client: TestClient, auth_headers: dict[str, str]) -> None:
    from app.services.providers.base import ProviderAuthError

    adapter = MagicMock()
    adapter.validate_key.side_effect = ProviderAuthError("Your API key is invalid or expired. Update it in Settings.")
    mock_get_adapter.return_value = adapter

    response = client.post(
        "/settings/api-keys",
        headers=auth_headers,
        json={"provider": "anthropic", "api_key": "sk-ant-invalid-key-0000"},
    )
    assert response.status_code == 400
    assert "invalid" in response.json()["error"]["message"].lower()
