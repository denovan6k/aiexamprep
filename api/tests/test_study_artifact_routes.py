from __future__ import annotations

from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import StudyArtifact
from helpers import register_user


def _seed_mind_map(
    db_session: Session,
    user_id: str | UUID,
    *,
    content: dict,
    schema_version: int = 1,
) -> StudyArtifact:
    artifact = StudyArtifact(
        user_id=UUID(str(user_id)),
        thread_id=None,
        message_id=None,
        material_id=None,
        artifact_type="mind_map",
        title="Photosynthesis",
        content=content,
        schema_version=schema_version,
    )
    db_session.add(artifact)
    db_session.commit()
    db_session.refresh(artifact)
    return artifact


def test_get_study_artifact_normalizes_v1_tree(client: TestClient, db_session: Session) -> None:
    headers, user = register_user(client, email="mindmap-get@example.com")
    artifact = _seed_mind_map(
        db_session,
        user["id"],
        content={
            "title": "Photosynthesis",
            "root": {
                "label": "Photosynthesis",
                "children": [
                    {"label": "Light reactions", "children": [{"label": "Thylakoids", "children": []}]},
                ],
            },
        },
    )

    response = client.get(f"/study-artifacts/{artifact.id}", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["schema_version"] == 2
    assert "# Photosynthesis" in body["content"]["markdown"]
    assert "## Light reactions" in body["content"]["markdown"]


def test_patch_study_artifact_updates_markdown(client: TestClient, db_session: Session) -> None:
    headers, user = register_user(client, email="mindmap-patch@example.com")
    artifact = _seed_mind_map(
        db_session,
        user["id"],
        content={
            "title": "Cells",
            "markdown": "# Cells\n\n## Organelles\n- Mitochondria",
            "settings": {"layout": "balanced"},
        },
        schema_version=2,
    )

    response = client.patch(
        f"/study-artifacts/{artifact.id}",
        headers=headers,
        json={
            "title": "Cell biology",
            "content": {
                "title": "Cell biology",
                "markdown": "# Cell biology\n\n## Organelles\n- Nucleus",
            },
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "Cell biology"
    assert "Nucleus" in body["content"]["markdown"]


def test_study_artifact_requires_ownership(client: TestClient, db_session: Session) -> None:
    _headers_a, user_a = register_user(client, email="owner@example.com")
    headers_b, _user_b = register_user(client, email="other@example.com")
    artifact = _seed_mind_map(
        db_session,
        user_a["id"],
        content={"title": "Private", "markdown": "# Private"},
        schema_version=2,
    )

    response = client.get(f"/study-artifacts/{artifact.id}", headers=headers_b)
    assert response.status_code == 404


def test_study_artifact_not_found(client: TestClient) -> None:
    headers, _user = register_user(client, email="missing@example.com")
    response = client.get(f"/study-artifacts/{uuid4()}", headers=headers)
    assert response.status_code == 404
