from unittest.mock import MagicMock
from uuid import UUID

from fastapi.testclient import TestClient

from app.models import ChatMessage, ChatThread, User
from app.services.chat import (
    _chat_system_prompt,
    _format_history,
    _retrieval_chunks,
    build_quiz_regeneration_context,
    parse_agent_intent,
    parse_chat_command,
    parse_flashcard_intent,
    parse_generate_intent,
    resolve_quiz_source_thread_id,
    sanitize_thread_title,
)
from helpers import register_user, seed_material_with_chunks


def test_retrieval_chunks_accepts_user_id(db_session, client) -> None:
    _headers, user = register_user(client, email="retrieval-uuid@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))
    material.status = "processed"
    db_session.add(material)
    db_session.commit()

    chunks = _retrieval_chunks(
        db_session,
        UUID(user["id"]),
        None,
        [material.id],
        4,
    )
    assert chunks
    assert chunks[0]["text"]


def test_chat_context_preview_endpoint(db_session, client) -> None:
    headers, user = register_user(client, email="context-preview@example.com")
    material = seed_material_with_chunks(
        db_session,
        UUID(user["id"]),
        text=(
            "Photosynthesis uses chlorophyll to convert sunlight into chemical energy. "
            "Respiration releases energy from glucose."
        ),
    )
    material.status = "processed"
    thread = ChatThread(
        user_id=UUID(user["id"]),
        title="Biology",
        material_ids=[str(material.id)],
    )
    db_session.add(material)
    db_session.add(thread)
    db_session.commit()

    response = client.post(
        "/chat/context",
        headers=headers,
        json={
            "thread_id": str(thread.id),
            "query": "chlorophyll photosynthesis",
            "max_tokens": 800,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert "Photosynthesis" in body["prompt_text"]
    assert body["indicators"]
    assert body["token_estimate"] <= 800


def test_sanitize_thread_title_strips_markdown_and_commands() -> None:
    assert sanitize_thread_title("New chat") == "New chat"
    assert sanitize_thread_title("  **Cell biology**  \n quiz ") == "Cell biology quiz"
    assert sanitize_thread_title("/quiz 10 questions on membranes") == "Quiz: 10 questions on membranes"
    assert sanitize_thread_title("# Heading\n`code` and [link](https://example.com)") == "Heading code and link"
    assert sanitize_thread_title("x" * 80).endswith("...")
    assert sanitize_thread_title('"Cell membrane transport"') == "Cell membrane transport"


def test_should_update_thread_title() -> None:
    from app.services.chat import (
        DEFAULT_THREAD_TITLE,
        TITLE_AUTO_REFRESH_INTERVAL,
        TITLE_SOURCE_AUTO,
        TITLE_SOURCE_DEFAULT,
        TITLE_SOURCE_SEED,
        TITLE_SOURCE_USER,
        _should_update_thread_title,
    )

    default_thread = ChatThread(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        title=DEFAULT_THREAD_TITLE,
        title_source=TITLE_SOURCE_DEFAULT,
        material_ids=[],
    )
    assert _should_update_thread_title(default_thread, 1) is True

    seed_thread = ChatThread(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        title="Seed title",
        title_source=TITLE_SOURCE_SEED,
        material_ids=[],
    )
    assert _should_update_thread_title(seed_thread, 1) is True
    assert _should_update_thread_title(seed_thread, 2) is True
    assert _should_update_thread_title(seed_thread, 3) is False

    auto_thread = ChatThread(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        title="Mitosis basics",
        title_source=TITLE_SOURCE_AUTO,
        material_ids=[],
    )
    assert _should_update_thread_title(auto_thread, 1) is True
    assert _should_update_thread_title(auto_thread, 2) is False
    assert _should_update_thread_title(auto_thread, 3) is False
    assert _should_update_thread_title(auto_thread, TITLE_AUTO_REFRESH_INTERVAL) is True

    user_thread = ChatThread(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        title="My title",
        title_source=TITLE_SOURCE_USER,
        material_ids=[],
    )
    assert _should_update_thread_title(user_thread, 1) is False


def test_maybe_set_thread_title_after_reply_uses_llm_title(monkeypatch) -> None:
    from app.services.chat import (
        DEFAULT_THREAD_TITLE,
        TITLE_SOURCE_AUTO,
        TITLE_SOURCE_DEFAULT,
        TITLE_SOURCE_USER,
        _maybe_set_thread_title_after_reply,
    )

    db = MagicMock()
    thread = ChatThread(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        title=DEFAULT_THREAD_TITLE,
        title_source=TITLE_SOURCE_DEFAULT,
        material_ids=[],
    )

    monkeypatch.setattr("app.services.chat._thread_assistant_message_count", lambda _db, _id: 1)
    monkeypatch.setattr(
        "app.services.chat._generate_thread_title",
        lambda history, user, assistant: '  **"Cell membrane transport"**  ',
    )
    refined = _maybe_set_thread_title_after_reply(
        db,
        thread,
        "Explain membranes please",
        "Membranes control transport via proteins.",
    )
    assert refined == "Cell membrane transport"
    assert thread.title == "Cell membrane transport"
    assert thread.title_source == TITLE_SOURCE_AUTO

    user_owned = ChatThread(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        title="Chat about notes",
        title_source=TITLE_SOURCE_USER,
        material_ids=[],
    )
    monkeypatch.setattr(
        "app.services.chat._generate_thread_title",
        lambda history, user, assistant: "Should never apply",
    )
    assert _maybe_set_thread_title_after_reply(db, user_owned, "hi", "hello") is None
    assert user_owned.title == "Chat about notes"
    assert user_owned.title_source == TITLE_SOURCE_USER


def test_maybe_set_thread_title_after_reply_falls_back_to_user_prompt(monkeypatch) -> None:
    from app.services.chat import (
        DEFAULT_THREAD_TITLE,
        TITLE_SOURCE_DEFAULT,
        TITLE_SOURCE_SEED,
        _maybe_set_thread_title_after_reply,
    )

    db = MagicMock()
    thread = ChatThread(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        title=DEFAULT_THREAD_TITLE,
        title_source=TITLE_SOURCE_DEFAULT,
        material_ids=[],
    )
    monkeypatch.setattr("app.services.chat._thread_assistant_message_count", lambda _db, _id: 1)
    monkeypatch.setattr(
        "app.services.chat._generate_thread_title",
        lambda history, user, assistant: None,
    )
    refined = _maybe_set_thread_title_after_reply(
        db,
        thread,
        "  **Photosynthesis** basics ",
        "Assistant reply",
    )
    assert refined == "Photosynthesis basics"
    assert thread.title == "Photosynthesis basics"
    assert thread.title_source == TITLE_SOURCE_SEED


def test_maybe_set_thread_title_after_reply_skips_between_refresh_turns(monkeypatch) -> None:
    from app.services.chat import (
        TITLE_SOURCE_AUTO,
        _maybe_set_thread_title_after_reply,
    )

    db = MagicMock()
    thread = ChatThread(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        title="Mitosis basics",
        title_source=TITLE_SOURCE_AUTO,
        material_ids=[],
    )
    monkeypatch.setattr("app.services.chat._thread_assistant_message_count", lambda _db, _id: 2)
    monkeypatch.setattr(
        "app.services.chat._generate_thread_title",
        lambda history, user, assistant: "Should not be called",
    )
    assert _maybe_set_thread_title_after_reply(db, thread, "Follow up", "More detail") is None
    assert thread.title == "Mitosis basics"
    assert thread.title_source == TITLE_SOURCE_AUTO


def test_maybe_set_thread_title_after_reply_refreshes_auto_title_at_interval(monkeypatch) -> None:
    from app.services.chat import (
        TITLE_AUTO_REFRESH_INTERVAL,
        TITLE_SOURCE_AUTO,
        _maybe_set_thread_title_after_reply,
    )

    db = MagicMock()
    thread = ChatThread(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        title="Mitosis basics",
        title_source=TITLE_SOURCE_AUTO,
        material_ids=[],
    )
    monkeypatch.setattr(
        "app.services.chat._thread_assistant_message_count",
        lambda _db, _id: TITLE_AUTO_REFRESH_INTERVAL,
    )
    monkeypatch.setattr(
        "app.services.chat._generate_thread_title",
        lambda history, user, assistant: "Mitosis and meiosis compared",
    )
    refined = _maybe_set_thread_title_after_reply(
        db,
        thread,
        "How is meiosis different?",
        "Meiosis halves chromosome number.",
    )
    assert refined == "Mitosis and meiosis compared"
    assert thread.title == "Mitosis and meiosis compared"
    assert thread.title_source == TITLE_SOURCE_AUTO


def test_maybe_set_thread_title_after_reply_uses_user_prompt_on_request_failure(
    monkeypatch,
) -> None:
    from app.services.chat import (
        DEFAULT_THREAD_TITLE,
        TITLE_SOURCE_DEFAULT,
        TITLE_SOURCE_SEED,
        _maybe_set_thread_title_after_reply,
    )

    db = MagicMock()
    thread = ChatThread(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        title=DEFAULT_THREAD_TITLE,
        title_source=TITLE_SOURCE_DEFAULT,
        material_ids=[],
    )
    monkeypatch.setattr("app.services.chat._thread_assistant_message_count", lambda _db, _id: 1)
    monkeypatch.setattr(
        "app.services.chat._generate_thread_title",
        lambda history, user, assistant: "Should not be called",
    )
    refined = _maybe_set_thread_title_after_reply(
        db,
        thread,
        "/quiz 10 questions on membranes",
        "Something went wrong while generating a reply. Please try again.",
        request_failed=True,
    )
    assert refined == "Quiz: 10 questions on membranes"
    assert thread.title == "Quiz: 10 questions on membranes"
    assert thread.title_source == TITLE_SOURCE_SEED


def test_generate_thread_title_sanitizes_model_output(monkeypatch) -> None:
    from app.services.chat import _generate_thread_title

    monkeypatch.setattr("app.services.chat.is_llm_configured", lambda **kwargs: True)
    monkeypatch.setattr(
        "app.services.chat.llm_text",
        lambda *args, **kwargs: '  "Mitosis vs meiosis"  ',
    )
    monkeypatch.setattr(
        "app.services.llm.resolve_thread_title_model",
        lambda: "gpt-4o-mini",
    )
    assert _generate_thread_title([], "What is mitosis?", "Mitosis is cell division.") == (
        "Mitosis vs meiosis"
    )


def test_format_history_uses_recent_role_labels() -> None:
    from app.models import ChatMessage

    history = [
        ChatMessage(role="user", content="Explain stacks"),
        ChatMessage(role="assistant", content="Stacks are LIFO structures."),
    ]

    assert _format_history(history) == (
        "Student: Explain stacks\nKnorvex: Stacks are LIFO structures."
    )


def test_chat_system_prompt_allows_education_without_materials() -> None:
    prompt = _chat_system_prompt()

    assert "you are knorvex, a study assistant" in prompt.lower()
    assert "prepwise" not in prompt.lower()
    assert "no course material is attached" in prompt.lower()
    assert "ONLY the provided course material" not in prompt
    assert "must upload a file first" in prompt.lower()
    assert "untrusted" in prompt.lower()
    assert "do not name or claim a specific underlying model" in prompt.lower()


def test_chat_system_prompt_identifies_as_knorvex() -> None:
    prompt = _chat_system_prompt()

    assert "say you are knorvex" in prompt.lower()
    assert "openai/gpt-4.1-mini" not in prompt


def test_chat_system_prompt_includes_agent_profile() -> None:
    from app.models import ProfessorAgent

    agent = ProfessorAgent(
        name="Dr. Okafor",
        difficulty="hard",
        marking_strictness="strict",
        question_style={"formats": ["theory"]},
        common_traps=["missing definitions"],
        feedback_tone="encouraging",
        favorite_topics=["arrays"],
    )

    prompt = _chat_system_prompt(agent)

    assert "Professor agent style" in prompt
    assert "Dr. Okafor" in prompt
    assert "strict" in prompt
    assert "encouraging" in prompt
    assert "arrays" in prompt


def test_parse_generate_intent_with_count() -> None:
    intent = parse_generate_intent("Please generate 12 MCQs on cell signaling")
    assert intent is not None
    assert intent["intent"] == "generate_quiz"
    assert intent["count"] == 12


def test_parse_generate_intent_default_count() -> None:
    intent = parse_generate_intent("Can you make a quiz from my notes?")
    assert intent is not None
    assert intent["count"] == 10


def test_parse_generate_intent_none_for_general_chat() -> None:
    assert parse_generate_intent("Explain the Krebs cycle simply") is None


def test_parse_generate_intent_true_false_and_timer() -> None:
    intent = parse_generate_intent("Generate 8 true/false questions with a 30 minute timer")
    assert intent is not None
    assert intent["count"] == 8
    assert "true_false" in intent["question_types"]
    assert intent["timer_minutes"] == 30


def test_parse_generate_intent_focused_on_topic() -> None:
    intent = parse_generate_intent("Generate 10 mcq questions focused on photosynthesis")
    assert intent is not None
    assert intent.get("topic_focus") == "photosynthesis"


def test_parse_generate_intent_set_question_on_topic() -> None:
    intent = parse_generate_intent("set a question on data structures")
    assert intent is not None
    assert intent["intent"] == "generate_quiz"
    assert intent.get("topic_focus") == "data structures"


def test_enrich_topic_focus_from_settings_and_content() -> None:
    from app.services.chat import _enrich_topic_focus

    from_settings = _enrich_topic_focus(
        {"intent": "generate_quiz", "count": 5},
        generation_settings={"topic_focus": "cell biology"},
    )
    assert from_settings["topic_focus"] == "cell biology"

    from_content = _enrich_topic_focus(
        {"intent": "generate_quiz", "count": 5},
        content="Generate 8 questions on mitochondria",
    )
    assert from_content["topic_focus"] == "mitochondria"


def test_parse_quiz_command_with_topic_timer_and_type() -> None:
    intent = parse_chat_command("/quiz 15 mcq on photosynthesis timer 20")
    assert intent is not None
    assert intent["intent"] == "generate_quiz"
    assert intent["count"] == 15
    assert intent["question_types"] == ["mcq"]
    assert intent["timer_minutes"] == 20
    assert intent["topic_focus"] == "photosynthesis"


def test_parse_mixed_quiz_command() -> None:
    intent = parse_chat_command("/quiz mixed on chapter 3")
    assert intent is not None
    assert intent["intent"] == "generate_quiz"
    assert intent["question_types"] == ["mcq", "true_false", "matching", "short_answer"]
    assert intent["topic_focus"] == "chapter 3"


def test_parse_help_command() -> None:
    intent = parse_chat_command("/commands")
    assert intent == {"intent": "command_help"}


def test_parse_agent_command_switch() -> None:
    intent = parse_chat_command("/agent Dr. Okafor")
    assert intent == {"intent": "switch_agent", "agent_name": "Dr. Okafor"}


def test_parse_agent_command_list() -> None:
    intent = parse_chat_command("/agent list")
    assert intent == {"intent": "list_agents"}


def test_parse_agent_command_clear() -> None:
    intent = parse_chat_command("/agent clear")
    assert intent == {"intent": "switch_agent", "agent_name": None}


def test_parse_agent_intent_natural_language() -> None:
    intent = parse_agent_intent("Please use Dr. Okafor's style for the next quiz")
    assert intent == {"intent": "switch_agent", "agent_name": "Dr. Okafor"}


def test_parse_agent_intent_switch_to() -> None:
    intent = parse_agent_intent("switch to Dr. Smith")
    assert intent == {"intent": "switch_agent", "agent_name": "Dr. Smith"}


def test_parse_flashcard_intent_natural_language() -> None:
    intent = parse_flashcard_intent("make flashcards on queues")
    assert intent is not None
    assert intent["intent"] == "generate_flashcards"
    assert intent["count"] == 10
    assert intent.get("topic_focus") == "queues"


def test_parse_flashcard_intent_with_count() -> None:
    intent = parse_flashcard_intent("generate 15 flashcards on cell biology")
    assert intent is not None
    assert intent["count"] == 15
    assert intent.get("topic_focus") == "cell biology"


def test_parse_flashcard_command() -> None:
    intent = parse_chat_command("/flashcards on chapter 3")
    assert intent is not None
    assert intent["intent"] == "generate_flashcards"
    assert intent.get("topic_focus") == "chapter 3"


def test_parse_generate_intent_skips_flashcards() -> None:
    assert parse_generate_intent("make flashcards on arrays") is None


def test_chat_thread_pin_archive_and_delete(client: TestClient, db_session) -> None:
    headers, user = register_user(client, email="thread-actions@example.com")

    create_response = client.post("/chat/threads", headers=headers, json={"title": "Biology review"})
    assert create_response.status_code == 201
    thread_id = create_response.json()["id"]

    pin_response = client.patch(
        f"/chat/threads/{thread_id}",
        headers=headers,
        json={"pinned": True},
    )
    assert pin_response.status_code == 200
    assert pin_response.json()["pinned"] is True

    archive_response = client.patch(
        f"/chat/threads/{thread_id}",
        headers=headers,
        json={"archived": True},
    )
    assert archive_response.status_code == 200
    body = archive_response.json()
    assert body["archived"] is True
    assert body["pinned"] is False

    active_list = client.get("/chat/threads", headers=headers)
    assert active_list.status_code == 200
    assert all(item["id"] != thread_id for item in active_list.json())

    archived_list = client.get("/chat/threads?include_archived=true", headers=headers)
    assert archived_list.status_code == 200
    assert any(item["id"] == thread_id for item in archived_list.json())

    delete_response = client.delete(f"/chat/threads/{thread_id}", headers=headers)
    assert delete_response.status_code == 204

    assert (
        client.get(f"/chat/threads/{thread_id}", headers=headers).status_code == 404
    )


def test_resolve_quiz_source_thread_id_from_config(db_session) -> None:
    thread_id = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    resolved = resolve_quiz_source_thread_id(
        db_session,
        UUID("11111111-2222-3333-4444-555555555555"),
        {"thread_id": str(thread_id)},
    )
    assert resolved == thread_id


def test_resolve_quiz_source_thread_id_from_chat_message(db_session, client) -> None:
    _headers, user = register_user(client, email="quiz-thread@example.com")
    thread = ChatThread(user_id=UUID(user["id"]), title="Quiz chat", material_ids=[])
    db_session.add(thread)
    db_session.flush()
    quiz_id = UUID("22222222-3333-4444-5555-666666666666")
    db_session.add(
        ChatMessage(
            thread_id=thread.id,
            role="assistant",
            content="Generated quiz",
            quiz_id=quiz_id,
        )
    )
    db_session.commit()

    resolved = resolve_quiz_source_thread_id(db_session, quiz_id, {})
    assert resolved == thread.id


def test_build_quiz_regeneration_context_includes_chat_history(db_session, client) -> None:
    _headers, user = register_user(client, email="quiz-history@example.com")
    user_row = db_session.get(User, UUID(user["id"]))
    thread = ChatThread(user_id=UUID(user["id"]), title="Study thread", material_ids=[])
    db_session.add(thread)
    db_session.flush()
    db_session.add_all(
        [
            ChatMessage(
                thread_id=thread.id,
                role="user",
                content="Quiz me on binary trees and traversal orders",
            ),
            ChatMessage(
                thread_id=thread.id,
                role="assistant",
                content="Let's focus on in-order, pre-order, and post-order walks.",
            ),
        ]
    )
    db_session.commit()

    chunks, topic = build_quiz_regeneration_context(
        db_session,
        user_row,
        thread.id,
        [],
        None,
        5,
        None,
    )

    assert topic == "Quiz me on binary trees and traversal orders"
    assert chunks
    assert chunks[0]["material_title"] == "Chat conversation"
    assert "binary trees" in chunks[0]["text"]
