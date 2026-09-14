import json
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import ChatThread, GenerationJob, MediaAttachment, Quiz, UserApiKey
from helpers import register_user, seed_material_with_chunks


SAMPLE_QUESTIONS = [
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
]

SAMPLE_FLASHCARDS = [
    {"front": "What is photosynthesis?", "back": "Conversion of light energy to chemical energy."}
]


def _parse_ui_message_sse(body: str) -> list[dict]:
    events: list[dict] = []
    for block in body.split("\n\n"):
        line = block.strip()
        if not line.startswith("data:"):
            continue
        payload = line[len("data:") :].strip()
        if payload == "[DONE]":
            events.append({"type": "done"})
            continue
        events.append(json.loads(payload))
    return events


def test_chat_requires_authentication(client: TestClient) -> None:
    response = client.get("/chat/threads")
    assert response.status_code == 401


def test_chat_thread_crud_and_command_message(client: TestClient) -> None:
    headers, _user = register_user(client, email="chat@example.com")

    create_response = client.post(
        "/chat/threads",
        headers=headers,
        json={"title": "Exam prep"},
    )
    assert create_response.status_code == 201
    thread = create_response.json()
    thread_id = thread["id"]
    assert thread["title"] == "Exam prep"

    list_response = client.get("/chat/threads", headers=headers)
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [thread_id]

    patch_response = client.patch(
        f"/chat/threads/{thread_id}",
        headers=headers,
        json={"title": "Updated prep"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["title"] == "Updated prep"

    message_response = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={"content": "/commands"},
    )
    assert message_response.status_code == 201
    body = message_response.json()
    assert body["user_message"]["content"] == "/commands"
    assert body["assistant_message"]["role"] == "assistant"
    assert "Available commands" in body["assistant_message"]["content"]

    messages_response = client.get(f"/chat/threads/{thread_id}/messages", headers=headers)
    assert messages_response.status_code == 200
    assert len(messages_response.json()) == 2

    agents_response = client.get("/chat/agents", headers=headers)
    assert agents_response.status_code == 200
    assert agents_response.json() == []


def test_undo_last_turn_keeps_user_prompt(client: TestClient) -> None:
    headers, _user = register_user(client, email="chat-undo@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Undo"}).json()["id"]

    first = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={"content": "/commands"},
    )
    assert first.status_code == 201

    second = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={"content": "help"},
    )
    assert second.status_code == 201

    before = client.get(f"/chat/threads/{thread_id}/messages", headers=headers)
    assert before.status_code == 200
    assert len(before.json()) == 4

    undo = client.delete(f"/chat/threads/{thread_id}/messages/last-turn", headers=headers)
    assert undo.status_code == 200
    assert undo.json()["prompt"] == "help"

    after = client.get(f"/chat/threads/{thread_id}/messages", headers=headers)
    assert after.status_code == 200
    remaining = after.json()
    assert len(remaining) == 3
    assert remaining[0]["content"] == "/commands"
    assert remaining[1]["role"] == "assistant"
    assert remaining[2]["content"] == "help"
    assert remaining[2]["role"] == "user"


def test_streamed_chat_request_failure_persists_retry_metadata(client: TestClient, monkeypatch) -> None:
    import app.services.chat as chat_module
    import app.services.agent_mcp as agent_mcp_module

    monkeypatch.setattr(chat_module, "is_llm_configured", lambda **_kwargs: True)
    monkeypatch.setattr(
        chat_module,
        "_streaming_reply_prompt",
        lambda *_args, **_kwargs: ("system", "prompt"),
    )
    monkeypatch.setattr(chat_module, "run_tool_loop", lambda *_args, **_kwargs: ("", []))
    monkeypatch.setattr(agent_mcp_module, "run_tool_loop", lambda *_args, **_kwargs: ("", []))

    def fail_stream(*_args, **_kwargs):
        raise RuntimeError("provider connection lost")

    monkeypatch.setattr(chat_module, "llm_text_stream", fail_stream)

    headers, _user = register_user(client, email="stream-failure@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Stream failure"}).json()["id"]
    response = client.post(
        f"/chat/threads/{thread_id}/messages/stream",
        headers=headers,
        json={"content": "Explain photosynthesis"},
    )

    assert response.status_code == 200
    assert response.headers.get("x-ai-ui-stream") == "v1"
    events = _parse_ui_message_sse(response.text)
    message_event = next(event for event in events if event.get("type") == "data-message")
    assert message_event["data"]["content"] == chat_module.REQUEST_FAILED_MESSAGE
    assert message_event["data"]["metadata"] == {
        "event": "request_failed",
        "degradation_reason": {
            "code": "request_failed",
            "message": chat_module.REQUEST_FAILED_MESSAGE,
            "detail": chat_module.REQUEST_FAILED_MESSAGE,
            "retryable": True,
        },
    }
    assert any(event.get("type") == "data-error" for event in events)


def test_streamed_chat_emits_reasoning_deltas(client: TestClient, monkeypatch) -> None:
    import app.services.chat as chat_module
    from app.services.stream_chunks import StreamChunk

    monkeypatch.setattr(chat_module, "is_llm_configured", lambda **_kwargs: True)
    monkeypatch.setattr(
        chat_module,
        "_streaming_reply_prompt",
        lambda *_args, **_kwargs: ("system", "prompt"),
    )
    monkeypatch.setattr(chat_module, "run_tool_loop", lambda *_args, **_kwargs: ("", []))

    def fake_stream(*_args, **_kwargs):
        yield StreamChunk(kind="reasoning", text="Considering options. ")
        yield StreamChunk(kind="reasoning", text="Picking one.")
        yield StreamChunk(kind="content", text="Final answer.")

    monkeypatch.setattr(chat_module, "llm_text_stream", fake_stream)

    headers, _user = register_user(client, email="stream-reasoning@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Reasoning"}).json()["id"]
    response = client.post(
        f"/chat/threads/{thread_id}/messages/stream",
        headers=headers,
        json={"content": "What should I study?"},
    )

    assert response.status_code == 200
    assert response.headers.get("x-ai-ui-stream") == "v1"
    events = _parse_ui_message_sse(response.text)
    reasoning_events = [event for event in events if event.get("type") == "reasoning-delta"]
    content_events = [event for event in events if event.get("type") == "text-delta"]
    message_event = next(event for event in events if event.get("type") == "data-message")

    assert [event["delta"] for event in reasoning_events] == [
        "Considering options. ",
        "Picking one.",
    ]
    assert [event["delta"] for event in content_events] == ["Final answer."]
    assert message_event["data"]["content"] == "Final answer."
    assert message_event["data"]["metadata"]["reasoning"] == "Considering options. Picking one."
    assert isinstance(message_event["data"]["metadata"]["reasoning_duration_ms"], int)
    assert message_event["data"]["metadata"]["reasoning_duration_ms"] >= 0


def test_streamed_chat_answers_plain_study_question_without_materials(
    client: TestClient, monkeypatch
) -> None:
    import app.services.chat as chat_module
    from app.services.stream_chunks import StreamChunk

    monkeypatch.setattr(chat_module, "is_llm_configured", lambda **_kwargs: True)
    monkeypatch.setattr(chat_module, "run_tool_loop", lambda *_args, **_kwargs: ("", []))

    def fake_stream(*_args, **_kwargs):
        yield StreamChunk(kind="content", text="Binary search halves the search space each step.")

    monkeypatch.setattr(chat_module, "llm_text_stream", fake_stream)

    headers, _user = register_user(client, email="stream-open-chat@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Open chat"}).json()["id"]
    response = client.post(
        f"/chat/threads/{thread_id}/messages/stream",
        headers=headers,
        json={"content": "Help me understand binary search for my assignment"},
    )

    assert response.status_code == 200
    events = _parse_ui_message_sse(response.text)
    content_events = [event for event in events if event.get("type") == "text-delta"]
    message_event = next(event for event in events if event.get("type") == "data-message")

    assert [event["delta"] for event in content_events] == [
        "Binary search halves the search space each step."
    ]
    assert message_event["data"]["content"] == "Binary search halves the search space each step."
    assert "upload" not in message_event["data"]["content"].lower()


def test_streamed_chat_with_real_llm_text_stream_shape(client: TestClient, monkeypatch) -> None:
    import app.services.chat as chat_module
    from app.services.stream_chunks import StreamChunk

    monkeypatch.setattr(chat_module, "is_llm_configured", lambda **_kwargs: True)
    monkeypatch.setattr(chat_module, "run_tool_loop", lambda *_args, **_kwargs: ("", []))

    def fake_platform_stream(*_args, **_kwargs):
        yield StreamChunk(kind="content", text="Hello")
        yield StreamChunk(kind="content", text=" there.")

    monkeypatch.setattr(chat_module, "llm_text_stream", fake_platform_stream)

    headers, _user = register_user(client, email="stream-real-shape@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Real shape"}).json()["id"]
    response = client.post(
        f"/chat/threads/{thread_id}/messages/stream",
        headers=headers,
        json={"content": "Say hello"},
    )

    assert response.status_code == 200
    events = _parse_ui_message_sse(response.text)
    content_events = [event for event in events if event.get("type") == "text-delta"]
    message_event = next(event for event in events if event.get("type") == "data-message")

    assert [event["delta"] for event in content_events] == ["Hello", " there."]
    assert message_event["data"]["content"] == "Hello there."
    assert not message_event["data"].get("metadata")
    assert not any(event.get("type") == "data-error" for event in events)


def test_streamed_chat_reasoning_only_response_is_not_generic_failure(
    client: TestClient, monkeypatch
) -> None:
    import app.services.chat as chat_module
    from app.services.stream_chunks import StreamChunk

    monkeypatch.setattr(chat_module, "is_llm_configured", lambda **_kwargs: True)
    monkeypatch.setattr(
        chat_module,
        "_material_aware_reply",
        lambda *_args, **_kwargs: "",
    )
    monkeypatch.setattr(chat_module, "run_tool_loop", lambda *_args, **_kwargs: ("", []))

    def fake_reasoning_only_stream(*_args, **_kwargs):
        yield StreamChunk(kind="reasoning", text="Thinking through the answer.")

    monkeypatch.setattr(chat_module, "llm_text_stream", fake_reasoning_only_stream)

    headers, _user = register_user(client, email="stream-reasoning-only@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Reasoning only"}).json()[
        "id"
    ]
    response = client.post(
        f"/chat/threads/{thread_id}/messages/stream",
        headers=headers,
        json={"content": "Explain recursion"},
    )

    assert response.status_code == 200
    events = _parse_ui_message_sse(response.text)
    message_event = next(event for event in events if event.get("type") == "data-message")

    assert message_event["data"]["content"] == chat_module.REASONING_ONLY_MESSAGE
    assert message_event["data"]["metadata"]["reasoning"] == "Thinking through the answer."
    assert message_event["data"]["metadata"].get("event") != "request_failed"
    assert not any(event.get("type") == "data-error" for event in events)


def test_streamed_chat_empty_response_falls_back_before_generic_failure(
    client: TestClient, monkeypatch
) -> None:
    import app.services.chat as chat_module

    monkeypatch.setattr(chat_module, "is_llm_configured", lambda **_kwargs: True)
    monkeypatch.setattr(chat_module, "run_tool_loop", lambda *_args, **_kwargs: ("", []))

    def empty_stream(*_args, **_kwargs):
        return
        yield  # pragma: no cover

    monkeypatch.setattr(chat_module, "llm_text_stream", empty_stream)
    monkeypatch.setattr(
        chat_module,
        "_material_aware_reply",
        lambda *_args, **_kwargs: "Fallback guidance without materials.",
    )

    headers, _user = register_user(client, email="stream-empty-fallback@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Empty fallback"}).json()[
        "id"
    ]
    response = client.post(
        f"/chat/threads/{thread_id}/messages/stream",
        headers=headers,
        json={"content": "What should I study first?"},
    )

    assert response.status_code == 200
    events = _parse_ui_message_sse(response.text)
    message_event = next(event for event in events if event.get("type") == "data-message")

    assert message_event["data"]["content"] == "Fallback guidance without materials."
    assert not message_event["data"].get("metadata")
    assert not any(event.get("type") == "data-error" for event in events)


def test_help_message_still_returns_commands_without_materials(
    client: TestClient, monkeypatch
) -> None:
    import app.services.chat as chat_module

    monkeypatch.setattr(chat_module, "is_llm_configured", lambda **_kwargs: True)
    monkeypatch.setattr(
        chat_module,
        "llm_text",
        lambda *_args, **_kwargs: "should-not-be-used",
    )

    headers, _user = register_user(client, email="help-open-chat@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Help"}).json()["id"]
    response = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={"content": "help"},
    )

    assert response.status_code == 201
    assert "Available commands" in response.json()["assistant_message"]["content"]
    assert response.json()["assistant_message"]["content"] != "should-not-be-used"


def test_chat_thread_isolation_between_users(client: TestClient) -> None:
    owner_headers, _owner = register_user(client, email="chat-owner@example.com")
    other_headers, _other = register_user(client, email="chat-other@example.com")

    thread_id = client.post("/chat/threads", headers=owner_headers, json={"title": "Private"}).json()[
        "id"
    ]

    assert client.get(f"/chat/threads/{thread_id}", headers=other_headers).status_code == 404
    assert (
        client.post(
            f"/chat/threads/{thread_id}/messages",
            headers=other_headers,
            json={"content": "/commands"},
        ).status_code
        == 404
    )


def test_chat_message_rate_limit(client: TestClient, monkeypatch) -> None:
    from app.core.config import settings
    from app.core.rate_limit import reset_rate_limits_for_tests

    monkeypatch.setattr(settings, "rate_limit_chat_generations_per_hour", 1)
    headers, _user = register_user(client, email="chat-limit@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Rate limit"}).json()["id"]

    first_response = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={"content": "/commands"},
    )
    assert first_response.status_code == 201

    limited_response = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={"content": "/commands"},
    )
    assert limited_response.status_code == 429
    assert "Rate limit exceeded" in limited_response.json()["error"]["message"]

    reset_rate_limits_for_tests()


def test_missing_chat_thread_returns_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    missing_thread_id = uuid4()
    response = client.get(f"/chat/threads/{missing_thread_id}", headers=auth_headers)
    assert response.status_code == 404


def test_topic_only_quiz_falls_back_to_platform_when_byok_is_invalid(
    client: TestClient, db_session, monkeypatch
) -> None:
    import app.services.chat as chat_module
    import app.services.jobs as jobs_module

    headers, user = register_user(client, email="topic-quiz-platform-fallback@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Topic fallback"}).json()["id"]
    key = UserApiKey(
        user_id=UUID(user["id"]),
        provider="openai",
        encrypted_key="encrypted",
        key_last4="1111",
        is_valid=False,
    )
    db_session.add(key)
    db_session.commit()
    thread = db_session.scalar(select(ChatThread).where(ChatThread.id == UUID(thread_id)))
    assert thread is not None
    thread.llm_source = "byok"
    thread.llm_provider = "openai"
    thread.user_api_key_id = key.id
    db_session.add(thread)
    db_session.commit()

    monkeypatch.setattr(jobs_module, "should_queue_generation", lambda _db: False)
    monkeypatch.setattr(chat_module, "is_llm_configured", lambda **kwargs: kwargs.get("override") is None)
    monkeypatch.setattr(chat_module, "execute_quiz_generation", lambda _params: SAMPLE_QUESTIONS)

    response = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={"content": "/quiz 1 mcq on photosynthesis"},
    )
    assert response.status_code == 201
    assistant = response.json()["assistant_message"]
    assert "Generated 1 questions" in assistant["content"]
    assert "topic-only" not in assistant["content"].lower()


def test_topic_only_flashcards_fall_back_to_platform_when_byok_is_invalid(
    client: TestClient, db_session, monkeypatch
) -> None:
    import app.services.chat as chat_module
    import app.services.jobs as jobs_module

    headers, user = register_user(client, email="topic-flashcard-platform-fallback@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Topic fallback"}).json()["id"]
    key = UserApiKey(
        user_id=UUID(user["id"]),
        provider="openai",
        encrypted_key="encrypted",
        key_last4="2222",
        is_valid=False,
    )
    db_session.add(key)
    db_session.commit()
    thread = db_session.scalar(select(ChatThread).where(ChatThread.id == UUID(thread_id)))
    assert thread is not None
    thread.llm_source = "byok"
    thread.llm_provider = "openai"
    thread.user_api_key_id = key.id
    db_session.add(thread)
    db_session.commit()

    monkeypatch.setattr(jobs_module, "should_queue_generation", lambda _db: False)
    monkeypatch.setattr(chat_module, "is_llm_configured", lambda **kwargs: kwargs.get("override") is None)
    monkeypatch.setattr(chat_module, "generate_flashcards", lambda *_args, **_kwargs: SAMPLE_FLASHCARDS)

    response = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={"content": "/flashcards 1 on photosynthesis"},
    )
    assert response.status_code == 201
    assistant = response.json()["assistant_message"]
    assert "Built 1 flashcards" in assistant["content"]
    assert "topic-only" not in assistant["content"].lower()


def test_quiz_with_unreadable_media_attachment_returns_material_specific_guidance(
    client: TestClient, db_session, monkeypatch
) -> None:
    import app.services.jobs as jobs_module

    headers, user = register_user(client, email="quiz-media-unreadable@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Media quiz"}).json()["id"]
    attachment = MediaAttachment(
        user_id=UUID(user["id"]),
        storage_provider="cloudinary",
        storage_key="media/unreadable.pdf",
        media_url="https://example.com/unreadable.pdf",
        filename="unreadable.pdf",
        file_type="pdf",
        file_size=1024,
        parsed_content=None,
        chunk_count=0,
        parsing_method="pdfplumber",
    )
    db_session.add(attachment)
    db_session.commit()

    monkeypatch.setattr(jobs_module, "should_queue_generation", lambda _db: False)

    response = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={
            "content": "/quiz 3 mcq on photosynthesis",
            "media_attachment_ids": [str(attachment.id)],
        },
    )
    assert response.status_code == 201
    assistant = response.json()["assistant_message"]["content"].lower()
    assert "could not read usable text" in assistant or "couldn't read usable text" in assistant
    assert "photosynthesis" in assistant
    assert "yes" in assistant
    metadata = response.json()["assistant_message"]["metadata"]
    assert metadata["event"] == "clarify"
    assert metadata["pending_topic_only"]["artifact_type"] == "quiz"
    assert metadata["pending_topic_only"]["topic_focus"] == "photosynthesis"


def test_quiz_with_media_attachment_chunks_routes_as_material_backed(
    client: TestClient, db_session, monkeypatch
) -> None:
    import app.services.chat as chat_module
    import app.services.jobs as jobs_module

    headers, user = register_user(client, email="quiz-media-routed@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Media quiz"}).json()["id"]
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
    monkeypatch.setattr(chat_module, "execute_quiz_generation", lambda _params: SAMPLE_QUESTIONS)

    response = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={
            "content": "/quiz 1 mcq on photosynthesis",
            "media_attachment_ids": [str(attachment.id)],
        },
    )
    assert response.status_code == 201
    assistant = response.json()["assistant_message"]["content"].lower()
    assert "from your materials" in assistant


def test_follow_up_quiz_reuses_prior_thread_media_without_reattach(
    client: TestClient, db_session, monkeypatch
) -> None:
    """Attach notes on turn 1; ask for a quiz on turn 2 without re-sending the file."""
    import app.services.chat as chat_module
    import app.services.jobs as jobs_module

    headers, user = register_user(client, email="quiz-media-followup@example.com")
    thread_id = client.post(
        "/chat/threads", headers=headers, json={"title": "Follow-up media quiz"}
    ).json()["id"]
    attachment = MediaAttachment(
        user_id=UUID(user["id"]),
        storage_provider="cloudinary",
        storage_key="media/priority-queues.pdf",
        media_url="https://example.com/priority-queues.pdf",
        filename="8-PriorityQueues.pdf",
        file_type="pdf",
        file_size=4096,
        parsed_content="Priority queues order elements by priority using heaps.",
        chunk_count=2,
        parsing_method="pdfplumber",
    )
    db_session.add(attachment)
    db_session.commit()

    monkeypatch.setattr(jobs_module, "should_queue_generation", lambda _db: False)
    monkeypatch.setattr(chat_module, "execute_quiz_generation", lambda _params: SAMPLE_QUESTIONS)

    first = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={
            "content": "uploaded",
            "media_attachment_ids": [str(attachment.id)],
        },
    )
    assert first.status_code == 201
    assert first.json()["assistant_message"]["metadata"]["event"] == "artifact_choice"

    follow_up = client.post(
        f"/chat/threads/{thread_id}/messages",
        headers=headers,
        json={"content": "/quiz"},
    )
    assert follow_up.status_code == 201
    assistant = follow_up.json()["assistant_message"]["content"].lower()
    assert "need a topic or study material" not in assistant
    assert "from your materials" in assistant
    assert follow_up.json()["assistant_message"].get("quiz_id")


def test_chat_quiz_generation_inline_creates_quiz(client: TestClient, db_session, monkeypatch) -> None:
    import app.services.chat as chat_module

    monkeypatch.setattr("app.services.jobs.should_queue_generation", lambda _db: False)
    monkeypatch.setattr(chat_module, "execute_quiz_generation", lambda _params: SAMPLE_QUESTIONS)

    headers, user = register_user(client, email="chat-inline-quiz@example.com")
    material = seed_material_with_chunks(
        db_session,
        UUID(user["id"]),
        text="Photosynthesis uses chlorophyll to convert sunlight into chemical energy.",
    )
    material.status = "processed"
    thread = ChatThread(
        user_id=UUID(user["id"]),
        title="Biology prep",
        material_ids=[str(material.id)],
    )
    db_session.add(thread)
    db_session.commit()

    response = client.post(
        f"/chat/threads/{thread.id}/messages",
        headers=headers,
        json={"content": "/quiz 1 mcq on photosynthesis"},
    )

    assert response.status_code == 201
    body = response.json()
    user = body["user_message"]
    assistant = body["assistant_message"]
    assert user["material_id"] == str(material.id)
    assert assistant["quiz_id"]
    assert assistant["material_id"] == str(material.id)
    assert assistant["quiz"]["questions"][0]["prompt"].startswith("Which process")
    quiz = db_session.scalar(select(Quiz).where(Quiz.id == UUID(assistant["quiz_id"])))
    assert quiz is not None
    assert quiz.material_id == material.id
    assert quiz.config["source"] == "chat"


def test_chat_quiz_generation_queues_when_workers_are_full(
    client: TestClient,
    db_session,
    monkeypatch,
) -> None:
    dispatched: list[str] = []
    monkeypatch.setattr("app.services.jobs.should_queue_generation", lambda _db: True)
    monkeypatch.setattr(
        "app.services.jobs.jobs_service.dispatch_quiz_generation",
        lambda job_id: dispatched.append(str(job_id)),
    )

    headers, user = register_user(client, email="chat-queued-quiz@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))
    material.status = "processed"
    thread = ChatThread(
        user_id=UUID(user["id"]),
        title="Queued quiz",
        material_ids=[str(material.id)],
    )
    db_session.add(thread)
    db_session.commit()

    response = client.post(
        f"/chat/threads/{thread.id}/messages",
        headers=headers,
        json={"content": "/quiz 1 mcq on stacks"},
    )

    assert response.status_code == 201
    assistant = response.json()["assistant_message"]
    assert assistant["metadata"]["event"] == "generation_queued"
    job = db_session.scalar(select(GenerationJob).where(GenerationJob.thread_id == thread.id))
    assert job is not None
    assert job.job_type == "quiz_generation"
    assert job.payload["intent"]["intent"] == "generate_quiz"
    assert dispatched == [str(job.id)]
