from __future__ import annotations

from uuid import UUID

from fastapi.testclient import TestClient

from app.models import MediaAttachment
from app.services.error_classifier import classify_llm_error
from app.services.generation import generation_failure_payload
from app.services import llm as llm_module
from helpers import register_user


def test_classify_llm_error_rate_limit_has_actionable_detail() -> None:
    payload = classify_llm_error("Error 429: Too Many Requests")
    assert payload["code"] == "rate_limit"
    assert "rate-limiting" in payload["detail"].lower()
    assert "switch model" in payload["detail"].lower()


def test_classify_llm_error_empty_response() -> None:
    payload = classify_llm_error("AI provider returned an empty response.")
    assert payload["code"] == "empty_response"
    assert "unusable response" in payload["detail"].lower()


def test_generation_failure_payload_uses_degradation_detail(monkeypatch) -> None:
    import app.services.generation as generation_module

    monkeypatch.setattr(
        generation_module,
        "get_llm_degradation",
        lambda: {
            "code": "rate_limit",
            "message": "AI provider rate limit reached",
            "detail": (
                "The AI provider is rate-limiting right now. "
                "Wait a minute and try again, or switch model."
            ),
            "fallback": (
                "The AI provider is rate-limiting right now. "
                "Wait a minute and try again, or switch model."
            ),
        },
    )
    content, metadata = generation_failure_payload(
        default_message="Generation returned no flashcards.",
        job_id="job-1",
    )
    assert "rate-limiting" in content.lower()
    assert "returned no flashcards" not in content.lower()
    assert metadata["event"] == "generation_failed"
    assert metadata["job_id"] == "job-1"
    assert metadata["degradation_reason"]["code"] == "rate_limit"


def test_flashcard_job_surfaces_rate_limit_detail(
    client: TestClient, db_session, monkeypatch
) -> None:
    import app.services.chat as chat_module
    import app.services.jobs as jobs_module
    import app.services.generation as generation_module

    headers, user = register_user(client, email="flashcard-rate-limit@example.com")
    thread_id = client.post(
        "/chat/threads", headers=headers, json={"title": "Flashcard errors"}
    ).json()["id"]
    attachment = MediaAttachment(
        user_id=UUID(user["id"]),
        storage_provider="cloudinary",
        storage_key="media/notes.pdf",
        media_url="https://example.com/notes.pdf",
        filename="notes.pdf",
        file_type="pdf",
        file_size=2048,
        parsed_content="Photosynthesis converts light energy to glucose and oxygen.",
        chunk_count=1,
        parsing_method="pdfplumber",
    )
    db_session.add(attachment)
    db_session.commit()

    monkeypatch.setattr(jobs_module, "should_queue_generation", lambda _db: False)

    def _empty_flashcards(*_args, **_kwargs):
        llm_module._record_llm_degradation("Error 429: Too Many Requests")
        return []

    monkeypatch.setattr(generation_module, "generate_flashcards", _empty_flashcards)
    monkeypatch.setattr(chat_module, "generate_flashcards", _empty_flashcards)

    response = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={
            "content": "/flashcards 3 on photosynthesis",
            "media_attachment_ids": [str(attachment.id)],
        },
    )
    assert response.status_code == 201
    assistant = response.json()["assistant_message"]
    assert "rate-limiting" in assistant["content"].lower()
    assert "returned no flashcards" not in assistant["content"].lower()
    assert assistant["metadata"]["event"] == "generation_failed"
    assert assistant["metadata"]["degradation_reason"]["code"] == "rate_limit"


def test_unreadable_media_then_yes_continues_topic_only(
    client: TestClient, db_session, monkeypatch
) -> None:
    import app.services.chat as chat_module
    import app.services.jobs as jobs_module

    headers, user = register_user(client, email="unreadable-yes-followup@example.com")
    thread_id = client.post(
        "/chat/threads", headers=headers, json={"title": "Unreadable follow-up"}
    ).json()["id"]
    attachment = MediaAttachment(
        user_id=UUID(user["id"]),
        storage_provider="cloudinary",
        storage_key="media/scan.pdf",
        media_url="https://example.com/scan.pdf",
        filename="scan.pdf",
        file_type="pdf",
        file_size=1024,
        parsed_content=None,
        chunk_count=0,
        parsing_method="pdfplumber",
    )
    db_session.add(attachment)
    db_session.commit()

    monkeypatch.setattr(jobs_module, "should_queue_generation", lambda _db: False)
    monkeypatch.setattr("app.services.chat.is_llm_configured", lambda **kwargs: True)
    monkeypatch.setattr(chat_module, "execute_quiz_generation", lambda _params: [
        {
            "type": "mcq",
            "prompt": "Which process converts sunlight into chemical energy?",
            "options": [{"id": "a", "text": "Photosynthesis"}, {"id": "b", "text": "Diffusion"}],
            "correct_answers": ["a"],
            "explanation": "Photosynthesis converts light energy into chemical energy.",
            "topic": "Photosynthesis",
            "difficulty": "medium",
            "source_refs": [],
        }
    ])

    first = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={
            "content": "/quiz on photosynthesis",
            "media_attachment_ids": [str(attachment.id)],
        },
    )
    assert first.status_code == 201
    assert first.json()["assistant_message"]["metadata"]["event"] == "clarify"

    follow_up = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={"content": "yes"},
    )
    assert follow_up.status_code == 201
    assistant = follow_up.json()["assistant_message"]
    assert assistant.get("quiz_id")
    assert "photosynthesis" in assistant["content"].lower() or "question" in assistant["content"].lower()
