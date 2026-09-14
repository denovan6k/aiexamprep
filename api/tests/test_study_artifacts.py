from __future__ import annotations

from unittest.mock import patch
from uuid import UUID

from app.services.chat import _apply_pending_topic_only_reply
from app.services.study_artifacts import (
    artifact_message_content,
    artifact_to_markdown,
    generate_structured_artifact,
    mind_map_tree_to_markdown,
    normalize_mind_map_content,
    resolve_artifact_vision_model,
)


def test_resolve_artifact_vision_model_prefers_capable_selection() -> None:
    assert resolve_artifact_vision_model("gpt-4o-mini") == "gpt-4o-mini"


def test_resolve_artifact_vision_model_falls_back_for_text_only() -> None:
    with patch(
        "app.services.study_artifacts.resolve_image_understanding_model",
        return_value="gemini-2.0-flash",
    ):
        assert resolve_artifact_vision_model("google/gemma-4-26b-a4b-it:free") == "gemini-2.0-flash"


def test_generate_structured_artifact_passes_image_urls(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_llm_json(*_args, **kwargs):
        captured.update(kwargs)
        return {"title": "Photo summary", "sections": [{"heading": "Notes", "body": "Cells"}]}

    monkeypatch.setattr(
        "app.services.study_artifacts.llm_json",
        fake_llm_json,
    )

    result = generate_structured_artifact(
        artifact_type="summary",
        chunks=[],
        topic_focus="Biology",
        topic_label="Biology",
        model="google/gemma-4-26b-a4b-it:free",
        image_urls=["https://example.com/photo.png"],
    )

    assert result is not None
    assert captured["image_urls"] == ["https://example.com/photo.png"]
    assert captured["model"] != "google/gemma-4-26b-a4b-it:free"


def test_generate_structured_artifact_passes_provider(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_llm_json(*_args, **kwargs):
        captured.update(kwargs)
        return {"title": "Photo summary", "sections": [{"heading": "Notes", "body": "Cells"}]}

    monkeypatch.setattr("app.services.study_artifacts.llm_json", fake_llm_json)

    generate_structured_artifact(
        artifact_type="summary",
        chunks=[],
        topic_focus="Biology",
        topic_label="Biology",
        model="gemini-3.6-flash",
        provider="gemini",
        image_urls=["https://example.com/photo.png"],
    )

    assert captured["provider"] == "gemini"
    assert captured["model"] == "gemini-3.6-flash"


def test_artifact_to_markdown_summary() -> None:
    markdown = artifact_to_markdown(
        "summary",
        {
            "title": "Cell biology",
            "sections": [{"heading": "Organelles", "body": "Mitochondria produce ATP."}],
        },
    )
    assert "# Cell biology" in markdown
    assert "## Organelles" in markdown
    assert "Mitochondria produce ATP." in markdown


def test_artifact_to_markdown_notes() -> None:
    markdown = artifact_to_markdown(
        "notes",
        {
            "title": "Chapter 1",
            "notes": [{"heading": "Key ideas", "bullets": ["Energy flows", "Matter cycles"]}],
        },
    )
    assert "## Key ideas" in markdown
    assert "- Energy flows" in markdown


def test_artifact_message_content_mind_map_intro() -> None:
    content = artifact_message_content(
        "mind_map",
        {
            "title": "Photosynthesis",
            "markdown": "# Photosynthesis\n\n## Light reactions",
        },
        topic_label="Biology",
    )
    assert "mind map" in content.lower()
    assert "Photosynthesis" in content


def test_mind_map_tree_to_markdown() -> None:
    markdown = mind_map_tree_to_markdown(
        "Photosynthesis",
        {
            "label": "Photosynthesis",
            "children": [
                {"label": "Light reactions", "children": [{"label": "Thylakoids", "children": []}]},
            ],
        },
    )
    assert markdown.startswith("# Photosynthesis")
    assert "## Light reactions" in markdown
    assert "### Thylakoids" in markdown


def test_normalize_mind_map_content_from_v1_root() -> None:
    normalized = normalize_mind_map_content(
        {
            "title": "Cells",
            "root": {
                "label": "Cells",
                "children": [{"label": "Nucleus", "children": []}],
            },
        },
        schema_version=1,
    )
    assert normalized["title"] == "Cells"
    assert "# Cells" in normalized["markdown"]
    assert "## Nucleus" in normalized["markdown"]
    assert normalized["settings"]["layout"] == "balanced"


def test_generate_structured_artifact_normalizes_mind_map(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.study_artifacts.llm_json",
        lambda *_args, **_kwargs: {
            "title": "Mitosis",
            "markdown": "# Mitosis\n\n## Phases\n- Prophase",
        },
    )
    result = generate_structured_artifact(
        artifact_type="mind_map",
        chunks=[],
        topic_focus="Mitosis",
        topic_label="Mitosis",
    )
    assert result is not None
    assert result["markdown"].startswith("# Mitosis")
    assert "settings" in result


def test_apply_pending_topic_only_reply_study_guide() -> None:
    from app.models import ChatMessage

    history = [
        ChatMessage(
            thread_id=UUID(int=1),
            role="assistant",
            content="Want a summary anyway?",
            message_metadata={
                "pending_topic_only": {
                    "artifact_type": "study_guide",
                    "topic_focus": "Mitosis",
                }
            },
        )
    ]
    rewritten, artifact_type, settings, forced = _apply_pending_topic_only_reply(
        "yes",
        history,
        artifact_type=None,
        generation_settings=None,
    )
    assert forced is True
    assert artifact_type == "study_guide"
    assert "study guide" in rewritten.lower()
    assert settings["topic_focus"] == "Mitosis"
