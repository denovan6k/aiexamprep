from __future__ import annotations

from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from conftest import register_user
from app.models import ChatMessage, Material, MaterialChunk


def _material_with_chunk(
    db_session: Session,
    user_id: UUID,
    *,
    title: str,
    text: str,
) -> Material:
    material = Material(
        user_id=user_id,
        title=title,
        file_name=f"{title.lower().replace(' ', '-')}.txt",
        file_type="text/plain",
        storage_path=f"/tmp/{title}.txt",
        status="processed",
    )
    db_session.add(material)
    db_session.flush()
    db_session.add(
        MaterialChunk(
            material_id=material.id,
            chunk_index=0,
            text=text,
            token_count=max(1, len(text) // 4),
            embedding=None,
        )
    )
    db_session.commit()
    db_session.refresh(material)
    return material


def test_material_chat_uses_only_selected_material_context(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    headers, user = register_user(client, email="material-chat@example.com")
    user_id = UUID(user["id"])
    target = _material_with_chunk(
        db_session,
        user_id,
        title="Cardiology notes",
        text="The sinoatrial node initiates the heartbeat and sets cardiac rhythm.",
    )
    unrelated = _material_with_chunk(
        db_session,
        user_id,
        title="Botany notes",
        text="Chlorophyll absorbs light for photosynthesis in plant cells.",
    )
    captured: dict[str, str] = {}

    def fake_llm_text(system: str, prompt: str, **kwargs) -> str:  # noqa: ANN003
        captured["system"] = system
        captured["prompt"] = prompt
        return "The sinoatrial node initiates the heartbeat."

    monkeypatch.setattr("app.services.material_chat.is_llm_configured", lambda: True)
    monkeypatch.setattr("app.services.material_chat.llm_text", fake_llm_text)

    session_response = client.post(
        f"/materials/{target.id}/chat/sessions",
        headers=headers,
        json={"title": "Ask cardiology"},
    )
    assert session_response.status_code == 201, session_response.text
    session_id = session_response.json()["id"]

    message_response = client.post(
        f"/materials/{target.id}/chat/sessions/{session_id}/messages",
        headers=headers,
        json={"content": "What starts the heartbeat?"},
    )
    assert message_response.status_code == 200, message_response.text
    body = message_response.json()

    assert body["assistant_message"]["content"] == "The sinoatrial node initiates the heartbeat."
    assert body["assistant_message"]["material_id"] == str(target.id)
    assert body["context_indicators"]
    assert body["context_indicators"][0]["material_title"] == "Cardiology notes"
    assert "sinoatrial" in captured["prompt"]
    assert "Chlorophyll" not in captured["prompt"]
    assert str(unrelated.id) not in captured["prompt"]

    messages = db_session.scalars(
        select(ChatMessage).where(ChatMessage.thread_id == UUID(session_id))
    ).all()
    assert [message.role for message in messages] == ["user", "assistant"]
    assert messages[-1].message_metadata["context_indicators"][0]["material_title"] == (
        "Cardiology notes"
    )


def test_material_chat_rejects_session_for_different_material(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, user = register_user(client, email="material-chat-guard@example.com")
    user_id = UUID(user["id"])
    first = _material_with_chunk(
        db_session,
        user_id,
        title="First notes",
        text="Stacks use last-in first-out ordering.",
    )
    second = _material_with_chunk(
        db_session,
        user_id,
        title="Second notes",
        text="Queues use first-in first-out ordering.",
    )

    session_response = client.post(
        f"/materials/{first.id}/chat/sessions",
        headers=headers,
        json={},
    )
    assert session_response.status_code == 201
    session_id = session_response.json()["id"]

    message_response = client.post(
        f"/materials/{second.id}/chat/sessions/{session_id}/messages",
        headers=headers,
        json={"content": "Explain this file."},
    )

    assert message_response.status_code == 404
