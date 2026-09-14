from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.entities import Material, MaterialChunk


def register_user(
    client: TestClient,
    *,
    email: str = "student@example.com",
    password: str = "correct-horse",
    full_name: str = "Ada Student",
) -> tuple[dict[str, str], dict[str, Any]]:
    response = client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    return headers, body["user"]


def seed_material_with_chunks(
    db_session: Session,
    user_id: UUID,
    *,
    text: str = (
        "A stack supports last-in first-out access through push and pop operations. "
        "Queues use first-in first-out ordering. "
        "This lecture material powers quiz generation and answer scoring."
    ),
) -> Material:
    material = Material(
        user_id=user_id,
        title="Lecture notes",
        file_name="notes.txt",
        file_type="text/plain",
        storage_path="/tmp/notes.txt",
        # Test helpers must match the backend retrieval filter:
        # quiz/flashcard generation only retrieves `Material.status == "processed"`.
        status="processed",
    )
    db_session.add(material)
    db_session.flush()
    db_session.add(
        MaterialChunk(
            material_id=material.id,
            chunk_index=0,
            text=text,
            token_count=len(text.split()),
        )
    )
    db_session.commit()
    db_session.refresh(material)
    return material
