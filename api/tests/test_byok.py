from __future__ import annotations

from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import ChatMessage, ChatThread, GenerationJob, Quiz, UserApiKey
from app.services.jobs import execute_quiz_generation_job
from helpers import register_user, seed_material_with_chunks


SAMPLE_QUESTIONS = [
    {
        "type": "mcq",
        "prompt": "Which structure is last-in, first-out?",
        "options": [{"id": "a", "text": "Stack"}, {"id": "b", "text": "Queue"}],
        "correct_answers": ["a"],
        "explanation": "Stacks use LIFO ordering.",
        "topic": "Stacks",
        "difficulty": "medium",
        "source_refs": [],
    }
]


class _SessionProxy:
    def __init__(self, session) -> None:
        self._session = session

    def __getattr__(self, name: str):
        return getattr(self._session, name)

    def close(self) -> None:
        pass


def test_thread_byok_selection_and_delete_fallback(
    client: TestClient,
    db_session,
) -> None:
    headers, user = register_user(client, email="byok-thread@example.com")
    key = UserApiKey(
        user_id=UUID(user["id"]),
        provider="openai",
        encrypted_key="encrypted",
        key_last4="1234",
        is_valid=True,
    )
    db_session.add(key)
    db_session.commit()

    thread_id = client.post("/chat/threads", headers=headers, json={"title": "BYOK"}).json()["id"]
    patch_response = client.patch(
        f"/chat/threads/{thread_id}",
        headers=headers,
        json={
            "llm_source": "byok",
            "llm_provider": "openai",
            "user_api_key_id": str(key.id),
        },
    )

    assert patch_response.status_code == 200
    assert patch_response.json()["llm_source"] == "byok"
    assert patch_response.json()["user_api_key_id"] == str(key.id)

    delete_response = client.delete(f"/settings/api-keys/{key.id}", headers=headers)

    assert delete_response.status_code == 204
    thread = db_session.scalar(select(ChatThread).where(ChatThread.id == UUID(thread_id)))
    assert thread is not None
    assert thread.llm_source == "platform"
    assert thread.user_api_key_id is None


def test_queued_quiz_worker_uses_byok_payload(
    db_session,
    client: TestClient,
    monkeypatch,
) -> None:
    import app.services.jobs as jobs_module

    headers, user = register_user(client, email="byok-worker@example.com")
    _ = headers
    user_id = UUID(user["id"])
    key = UserApiKey(
        user_id=user_id,
        provider="openai",
        encrypted_key="encrypted",
        key_last4="9999",
        is_valid=True,
    )
    material = seed_material_with_chunks(db_session, user_id)
    material.status = "processed"
    thread = ChatThread(
        user_id=user_id,
        title="Worker BYOK",
        material_ids=[str(material.id)],
        llm_source="byok",
        llm_provider="openai",
        user_api_key_id=key.id,
    )
    db_session.add(key)
    db_session.add(thread)
    db_session.flush()
    message = ChatMessage(
        thread_id=thread.id,
        role="assistant",
        content="Your quiz will appear here shortly.",
        message_metadata={"event": "generation_queued"},
    )
    db_session.add(message)
    db_session.flush()
    job = GenerationJob(
        user_id=user_id,
        job_type="quiz_generation",
        status="queued",
        thread_id=thread.id,
        message_id=message.id,
        payload={
            "intent": {"intent": "generate_quiz", "count": 1, "question_types": ["mcq"]},
            "llm_source": "byok",
            "llm_provider": "openai",
            "user_api_key_id": str(key.id),
        },
    )
    db_session.add(job)
    db_session.commit()

    overrides = []
    monkeypatch.setattr(jobs_module, "SessionLocal", lambda: _SessionProxy(db_session))
    monkeypatch.setattr(jobs_module, "decrypt_api_key", lambda _record: "sk-byok-worker")
    monkeypatch.setattr(jobs_module, "generate_questions", lambda *_args, **_kwargs: SAMPLE_QUESTIONS)
    monkeypatch.setattr(
        jobs_module,
        "set_llm_override",
        lambda override: overrides.append(override) or object(),
    )
    monkeypatch.setattr(jobs_module, "reset_llm_override", lambda _token: None)

    execute_quiz_generation_job(str(job.id))

    db_session.refresh(job)
    db_session.refresh(message)
    assert job.status == "completed"
    assert message.quiz_id is not None
    assert overrides
    assert overrides[0].provider == "openai"
    assert overrides[0].api_key == "sk-byok-worker"
    quiz = db_session.scalar(select(Quiz).where(Quiz.id == message.quiz_id))
    assert quiz is not None
    assert quiz.config["job_id"] == str(job.id)
