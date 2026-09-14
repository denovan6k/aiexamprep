from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import MediaAttachment
from app.services import llm
from app.services.image_understanding import (
    attachment_access_url,
    ensure_image_text,
    has_only_unparsed_images,
    is_image_attachment,
    prepare_media_attachments_for_grounding,
    unreadable_attachment_message,
    vision_image_urls,
)
from helpers import register_user

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


def _image_attachment(user_id: UUID, *, parsed_content: str | None = None) -> MediaAttachment:
    return MediaAttachment(
        user_id=user_id,
        storage_provider="local",
        storage_key="media/photo.png",
        media_url="https://example.com/photo.png",
        filename="photo.png",
        file_type="png",
        file_size=2048,
        parsed_content=parsed_content,
        chunk_count=0,
        parsing_method=None,
    )


def test_attachment_access_url_refreshes_from_storage(monkeypatch) -> None:
    attachment = _image_attachment(UUID(int=21))
    attachment.storage_provider = "cloudinary"
    attachment.media_url = "https://example.com/stale.png"

    class FakeStorage:
        def get_capabilities(self):
            return SimpleNamespace(provider_name="cloudinary")

        def get_url(self, key: str, *, expires: int = 3600) -> str:
            assert key == attachment.storage_key
            return "https://example.com/fresh.png"

    monkeypatch.setattr(
        "app.services.image_understanding.get_media_storage",
        lambda: FakeStorage(),
    )

    assert attachment_access_url(attachment) == "https://example.com/fresh.png"


def test_vision_image_urls_use_refreshed_access_urls(monkeypatch) -> None:
    attachment = _image_attachment(UUID(int=22))
    attachment.storage_provider = "cloudinary"
    monkeypatch.setattr(
        "app.services.image_understanding.attachment_access_url",
        lambda item: f"https://example.com/{item.filename}",
    )

    assert vision_image_urls([attachment]) == ["https://example.com/photo.png"]


def test_llm_json_aborts_when_images_fail_to_load(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "gemini_api_key", "gemini-key")
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    llm._openrouter_rate_limited_until = 0.0
    monkeypatch.setattr(
        llm,
        "_fetch_image_as_data_uri",
        lambda url, **kwargs: None,
    )

    result = llm.llm_json(
        "system",
        "describe image",
        model="gemini-3.6-flash",
        provider="gemini",
        image_urls=["https://example.com/photo.png"],
    )

    assert result is None
    assert llm.get_llm_degradation() is not None


def test_is_image_attachment_detects_png() -> None:
    attachment = _image_attachment(UUID(int=1))
    assert is_image_attachment(attachment) is True


def test_ensure_image_text_skips_when_already_parsed(db_session: Session) -> None:
    user_id = UUID(int=2)
    attachment = _image_attachment(user_id, parsed_content="Existing notes from the slide.")
    db_session.add(attachment)
    db_session.commit()

    with patch("app.services.image_understanding.llm_json") as mocked_llm:
        result = ensure_image_text(db_session, attachment)

    mocked_llm.assert_not_called()
    assert result == "Existing notes from the slide."


def test_ensure_image_text_persists_parsed_content(db_session: Session, monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")

    user_id = UUID(int=3)
    attachment = _image_attachment(user_id)
    db_session.add(attachment)
    db_session.commit()

    vision_payload = {
        "text": "Mitochondria are the powerhouse of the cell.",
        "description": "Handwritten biology notes.",
        "has_study_content": True,
    }

    with patch("app.services.image_understanding.llm_json", return_value=vision_payload) as mocked_llm:
        result = ensure_image_text(db_session, attachment)

    mocked_llm.assert_called_once()
    assert mocked_llm.call_args.kwargs["image_urls"] == ["https://example.com/photo.png"]
    assert result is not None
    assert "Mitochondria" in result
    db_session.refresh(attachment)
    assert attachment.parsed_content == result
    assert attachment.parsing_method == "vision"


def test_ensure_image_text_fail_open_on_llm_error(db_session: Session, monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")

    user_id = UUID(int=4)
    attachment = _image_attachment(user_id)
    db_session.add(attachment)
    db_session.commit()

    with patch("app.services.image_understanding.llm_json", side_effect=RuntimeError("vision down")):
        result = ensure_image_text(db_session, attachment)

    assert result is None
    db_session.refresh(attachment)
    assert attachment.parsed_content is None


def test_model_supports_vision_default_gemma_false() -> None:
    assert llm.model_supports_vision("google/gemma-4-26b-a4b-it:free") is False


def test_model_supports_vision_gpt4o_mini_true() -> None:
    assert llm.model_supports_vision("openai/gpt-4o-mini") is True
    assert llm.model_supports_vision("gpt-4o-mini") is True


def test_build_user_message_content_without_images_is_string() -> None:
    assert llm._build_user_message_content("hello", None) == "hello"
    assert llm._build_user_message_content("hello", []) == "hello"


def test_prepare_user_message_content_gemini_inlines_images(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "gemini_api_key", "gemini-key")
    monkeypatch.setattr(
        llm,
        "_fetch_image_as_data_uri",
        lambda url, **kwargs: "data:image/png;base64,ZmFrZQ==",
    )

    content = llm._prepare_user_message_content(
        "describe image",
        ["https://res.cloudinary.com/demo/photo.png"],
        provider="gemini",
        model="gemini-2.0-flash",
    )

    assert content == [
        {"type": "text", "text": "describe image"},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,ZmFrZQ=="}},
    ]


def test_llm_json_gemini_vision_uses_data_uri(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "gemini_api_key", "gemini-key")
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    llm._openrouter_rate_limited_until = 0.0
    monkeypatch.setattr(
        llm,
        "_fetch_image_as_data_uri",
        lambda url, **kwargs: "data:image/png;base64,ZmFrZQ==",
    )

    captured: dict[str, object] = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content='{"ok": true}'))]
            )

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        chat = FakeChat()

    monkeypatch.setattr(llm, "_platform_client", lambda **_kwargs: FakeClient())

    result = llm.llm_json(
        "system",
        "describe image",
        model="gemini-2.0-flash",
        provider="gemini",
        image_urls=["https://res.cloudinary.com/demo/photo.png"],
    )

    assert result == {"ok": True}
    user_content = captured["messages"][1]["content"]
    assert user_content[1]["image_url"]["url"].startswith("data:image/png;base64,")


def test_llm_json_with_image_urls_uses_multimodal_parts(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    monkeypatch.setattr(llm.settings, "gemini_api_key", "")
    llm._openrouter_rate_limited_until = 0.0

    captured: dict[str, object] = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content='{"ok": true}'))]
            )

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        chat = FakeChat()

    monkeypatch.setattr(llm, "_platform_client", lambda **_kwargs: FakeClient())

    result = llm.llm_json(
        "system",
        "describe image",
        provider="openrouter",
        image_urls=["https://example.com/photo.png"],
    )

    assert result == {"ok": True}
    messages = captured["messages"]
    user_content = messages[1]["content"]
    assert isinstance(user_content, list)
    assert user_content[0] == {"type": "text", "text": "describe image"}
    assert user_content[1] == {
        "type": "image_url",
        "image_url": {"url": "https://example.com/photo.png"},
    }


def test_llm_text_stream_without_image_urls_uses_string_content(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    monkeypatch.setattr(llm.settings, "gemini_api_key", "")
    llm._openrouter_rate_limited_until = 0.0

    captured: dict[str, object] = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return []

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        chat = FakeChat()

    monkeypatch.setattr(llm, "_platform_client", lambda **_kwargs: FakeClient())

    list(llm.llm_text_stream("system", "plain text only", provider="openrouter"))

    messages = captured["messages"]
    assert messages[1]["content"] == "plain text only"


def test_image_upload_returns_201_without_parsed_content(client: TestClient, monkeypatch) -> None:
    from app.routes import media as media_routes
    from app.schemas.media import MediaUploadResponse

    headers, user = register_user(client, email="image-upload@example.com")

    def fake_upload_media(db, user_id, file, metadata=None):
        from app.models import MediaAttachment

        media = MediaAttachment(
            user_id=user_id,
            storage_provider="test",
            storage_key="media/photo.png",
            media_url="https://example.com/photo.png",
            filename=file.filename or "notes.png",
            file_type="png",
            file_size=128,
            parsed_content=None,
            chunk_count=0,
            parsing_method=None,
        )
        db.add(media)
        db.flush()
        return MediaUploadResponse(
            id=media.id,
            filename=media.filename,
            file_type=media.file_type,
            file_size=media.file_size,
            media_url=media.media_url,
            thumbnail_url=None,
            parsing_method=None,
            chunk_count=0,
        )

    monkeypatch.setattr(media_routes.media_service, "upload_media", fake_upload_media)

    response = client.post(
        "/chat/media/upload",
        headers=headers,
        files={"file": ("notes.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["file_type"] == "png"
    assert body.get("parsing_method") is None
    assert body.get("chunk_count") == 0


def test_unreadable_attachment_message_for_images_only() -> None:
    attachments = [_image_attachment(UUID(int=5))]
    assert has_only_unparsed_images(attachments) is True
    message = unreadable_attachment_message(attachments)
    assert "photo" in message.lower()


def test_quiz_with_unparsed_image_returns_photo_guidance(
    client: TestClient, db_session: Session, monkeypatch
) -> None:
    import app.services.jobs as jobs_module

    headers, user = register_user(client, email="quiz-image-unreadable@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Image quiz"}).json()[
        "id"
    ]
    attachment = _image_attachment(UUID(user["id"]))
    db_session.add(attachment)
    db_session.commit()

    monkeypatch.setattr(jobs_module, "should_queue_generation", lambda _db: False)
    with patch(
        "app.services.image_understanding.llm_json",
        side_effect=RuntimeError("vision unavailable"),
    ):
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
    assert "photo" in assistant
    assert "photosynthesis" in assistant
    assert "yes" in assistant
    metadata = response.json()["assistant_message"]["metadata"]
    assert metadata["event"] == "clarify"
    assert metadata["pending_topic_only"]["topic_focus"] == "photosynthesis"


def test_quiz_with_image_and_mocked_vision_extract_generates_quiz(
    client: TestClient, db_session: Session, monkeypatch
) -> None:
    import app.services.chat as chat_module
    import app.services.jobs as jobs_module

    headers, user = register_user(client, email="quiz-image-grounded@example.com")
    thread_id = client.post("/chat/threads", headers=headers, json={"title": "Image quiz"}).json()[
        "id"
    ]
    attachment = _image_attachment(UUID(user["id"]))
    db_session.add(attachment)
    db_session.commit()

    vision_payload = {
        "text": "Photosynthesis converts light energy to glucose and oxygen.",
        "description": "Biology slide photo.",
        "has_study_content": True,
    }

    monkeypatch.setattr(jobs_module, "should_queue_generation", lambda _db: False)
    monkeypatch.setattr("app.services.chat.is_llm_configured", lambda **kwargs: True)
    monkeypatch.setattr("app.services.image_understanding.is_llm_configured", lambda **kwargs: True)
    monkeypatch.setattr(chat_module, "execute_quiz_generation", lambda _params: SAMPLE_QUESTIONS)

    with patch("app.services.image_understanding.llm_json", return_value=vision_payload):
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

    db_session.refresh(attachment)
    assert attachment.parsed_content is not None
    assert "Photosynthesis" in attachment.parsed_content
    assert attachment.parsing_method == "vision"


def test_prepare_media_attachments_for_grounding_runs_once_per_image(
    db_session: Session, monkeypatch
) -> None:
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "sk-or-v1-test")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")

    user_id = UUID(int=6)
    attachment = _image_attachment(user_id)
    db_session.add(attachment)
    db_session.commit()

    vision_payload = {
        "text": "Cell membrane controls transport.",
        "description": "Notes photo.",
        "has_study_content": True,
    }

    with patch("app.services.image_understanding.llm_json", return_value=vision_payload) as mocked_llm:
        prepare_media_attachments_for_grounding(db_session, [attachment])
        prepare_media_attachments_for_grounding(db_session, [attachment])

    assert mocked_llm.call_count == 1
