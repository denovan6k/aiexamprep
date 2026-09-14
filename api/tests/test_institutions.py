from collections.abc import Generator
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models.entities import (
    AuthSession,
    Base,
    Institution,
    InstitutionMembership,
    Material,
    MaterialChunk,
    User,
)
from app.routes import auth as auth_routes
from app.routes import institutions as institutions_routes
from app.services.extraction import chunk_text, normalize_extracted_text
from app.services.institutions import institutions_service
from app.services.materials import materials_service


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
TABLES = [
    MaterialChunk.__table__,
    Material.__table__,
    InstitutionMembership.__table__,
    Institution.__table__,
    AuthSession.__table__,
    User.__table__,
]


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    Base.metadata.drop_all(bind=engine, tables=TABLES)
    Base.metadata.create_all(bind=engine, tables=list(reversed(TABLES)))

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[auth_routes.get_db] = override_get_db
    app.dependency_overrides[institutions_routes.get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _register(client: TestClient, email: str, password: str = "correct-horse") -> dict:
    response = client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": "Test User"},
    )
    assert response.status_code == 201
    return response.json()


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_register_without_institution_on_signup(client: TestClient) -> None:
    with TestingSessionLocal() as db:
        institutions_service.create_institution(db, "North Ridge University", "north-ridge")
        db.commit()

    response = client.post(
        "/auth/register",
        json={
            "email": "student@northridge.edu",
            "password": "correct-horse",
            "full_name": "Campus Student",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["role"] == "user"
    assert body["user"]["institution"] is None


def test_list_and_update_institution(client: TestClient) -> None:
    with TestingSessionLocal() as db:
        institutions_service.create_institution(db, "Knorvex Academy", "knorvex-academy")
        db.commit()

    auth = _register(client, "member@knorvex.edu")
    token = auth["access_token"]

    list_response = client.get("/institutions")
    assert list_response.status_code == 200
    assert any(item["slug"] == "knorvex-academy" for item in list_response.json())

    patch_response = client.patch(
        "/institutions/me",
        headers=_auth_headers(token),
        json={"institution_slug": "knorvex-academy"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["institution"]["slug"] == "knorvex-academy"


def test_institution_admin_bulk_upload(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr("app.services.jobs.redis_available", lambda: False)

    with TestingSessionLocal() as db:
        institution = institutions_service.create_institution(
            db, "Admin College", "admin-college"
        )
        db.commit()
        institution_id = str(institution.id)

    admin_auth = _register(client, "real-admin@admin-college.edu")
    token = admin_auth["access_token"]
    with TestingSessionLocal() as db:
        user = db.query(User).filter(User.email == "real-admin@admin-college.edu").one()
        user.institution_id = institution.id
        institutions_service.grant_institution_admin(db, user.id, institution.id)
        db.commit()

    upload_response = client.post(
        f"/institutions/{institution_id}/materials",
        headers=_auth_headers(token),
        files=[
            ("files", ("campus-guide.txt", b"Institutional syllabus content for all students.", "text/plain")),
            ("files", ("policy.txt", b"Campus academic integrity policy.", "text/plain")),
        ],
    )
    assert upload_response.status_code == 201
    body = upload_response.json()
    assert len(body["uploaded"]) == 2
    assert body["uploaded"][0]["institution_id"] == institution_id


def test_bulk_upload_requires_admin(client: TestClient) -> None:
    with TestingSessionLocal() as db:
        institution = institutions_service.create_institution(db, "Member School", "member-school")
        db.commit()
        institution_id = str(institution.id)

    auth = _register(client, "student@member-school.edu")
    client.patch(
        "/institutions/me",
        headers=_auth_headers(auth["access_token"]),
        json={"institution_slug": "member-school"},
    )

    response = client.post(
        f"/institutions/{institution_id}/materials",
        headers=_auth_headers(auth["access_token"]),
        files=[("files", ("notes.txt", b"personal notes", "text/plain"))],
    )
    assert response.status_code == 403


def test_retrieval_blends_personal_and_institutional_chunks() -> None:
    with TestingSessionLocal() as db:
        institution = Institution(name="Blend University", slug="blend-u")
        user = User(name="Student", email="blend@example.com", password_hash="x", is_active=True)
        db.add_all([institution, user])
        db.flush()
        user.institution_id = institution.id

        personal = Material(
            user_id=user.id,
            title="My Notes",
            file_name="notes.txt",
            file_type="text/plain",
            storage_path="/tmp/notes.txt",
            status="processed",
        )
        shared = Material(
            user_id=user.id,
            institution_id=institution.id,
            title="Campus Handbook",
            file_name="handbook.txt",
            file_type="text/plain",
            storage_path="/tmp/handbook.txt",
            status="processed",
        )
        db.add_all([personal, shared])
        db.flush()

        personal_text = normalize_extracted_text("Personal mitochondria notes.")
        shared_text = normalize_extracted_text("Institutional policy on lab safety.")
        for index, chunk in enumerate(chunk_text(personal_text)):
            db.add(
                MaterialChunk(
                    material_id=personal.id,
                    chunk_index=index,
                    text=chunk,
                    token_count=10,
                )
            )
        for index, chunk in enumerate(chunk_text(shared_text)):
            db.add(
                MaterialChunk(
                    material_id=shared.id,
                    chunk_index=index,
                    text=chunk,
                    token_count=10,
                )
            )
        db.commit()

        chunks = materials_service.retrieve_blended_chunks(
            db, user.id, user.institution_id, None, [], 6
        )
        sources = {chunk["source"] for chunk in chunks}
        assert "personal" in sources
        assert "institution" in sources
