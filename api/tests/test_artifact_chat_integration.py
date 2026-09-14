from unittest.mock import patch
from uuid import UUID

from app.models import ChatThread, MediaAttachment
from helpers import register_user, seed_material_with_chunks


def test_attachment_only_message_returns_artifact_choice(db_session, client) -> None:
    headers, user = register_user(client, email="artifact-choice@example.com")
    thread = ChatThread(user_id=UUID(user["id"]), title="Study chat", material_ids=[])
    attachment = MediaAttachment(
        user_id=UUID(user["id"]),
        filename="notes.pdf",
        file_type="pdf",
        file_size=1200,
        storage_provider="cloudinary",
        storage_key=f"users/{user['id']}/notes.pdf",
        media_url="https://example.com/notes.pdf",
        parsed_content="Photosynthesis converts light into chemical energy.",
        parsing_method="text",
    )
    db_session.add(thread)
    db_session.add(attachment)
    db_session.commit()

    with patch("app.services.artifact_intent.llm_json") as mocked_llm:
        response = client.post(
            f"/chat/threads/{thread.id}/messages",
            headers=headers,
            json={
                "content": "see attached",
                "media_attachment_ids": [str(attachment.id)],
            },
        )
        mocked_llm.assert_not_called()

    assert response.status_code == 201
    metadata = response.json()["assistant_message"]["metadata"] or {}
    assert metadata.get("event") == "artifact_choice"
    assert metadata.get("choices")


def test_explicit_artifact_type_generates_summary_metadata(db_session, client) -> None:
    headers, user = register_user(client, email="explicit-summary@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]), text="Mitosis divides cells.")
    material.status = "processed"
    thread = ChatThread(
        user_id=UUID(user["id"]),
        title="Biology",
        material_ids=[str(material.id)],
    )
    db_session.add(material)
    db_session.add(thread)
    db_session.commit()

    summary_payload = {
        "title": "Mitosis Summary",
        "sections": [{"heading": "Overview", "body": "Cells divide through mitosis."}],
    }
    with patch("app.services.jobs.should_queue_generation", return_value=False):
        with patch("app.services.study_artifacts.llm_json", return_value=summary_payload):
            response = client.post(
                f"/chat/threads/{thread.id}/messages",
                headers=headers,
                json={
                    "content": "help me review this",
                    "artifact_type": "summary",
                },
            )

    assert response.status_code == 201
    body = response.json()
    metadata = body["assistant_message"]["metadata"] or {}
    assert metadata.get("artifact_type") == "summary"
    assert metadata.get("artifact_preview") == summary_payload
