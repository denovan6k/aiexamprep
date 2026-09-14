from __future__ import annotations

import os

# Tests use in-memory SQLite. Set this before importing app modules so local pytest
# does not require Postgres, libpq, or psycopg wheels (e.g. on Windows/Python 3.14).
os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("APP_ENV", "test")

from collections.abc import Generator
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.rate_limit import reset_rate_limits_for_tests
from app.main import app
from app.models.entities import Base, Material
from helpers import register_user, seed_material_with_chunks

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    reset_rate_limits_for_tests()

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client: TestClient) -> dict[str, str]:
    headers, _user = register_user(client)
    return headers


@pytest.fixture()
def material(db_session: Session, client: TestClient) -> Material:
    _headers, user = register_user(client, email="materials@example.com")
    return seed_material_with_chunks(db_session, UUID(user["id"]))
