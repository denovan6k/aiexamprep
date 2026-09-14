from types import SimpleNamespace

from app.services.stream_chunks import (
    StreamChunk,
    extract_reasoning_text,
    iter_openai_compatible_chunks,
    model_supports_reasoning,
    truncate_reasoning,
)


def test_model_supports_reasoning_from_supported_parameters() -> None:
    assert model_supports_reasoning("some/model", supported_parameters=["reasoning"]) is True
    assert model_supports_reasoning("some/model", supported_parameters=["temperature"]) is False


def test_model_supports_reasoning_from_model_id_hints() -> None:
    assert model_supports_reasoning("deepseek/deepseek-r1:free") is True
    assert model_supports_reasoning("openai/o4-mini") is True
    assert model_supports_reasoning("anthropic/claude-sonnet-4") is True
    assert model_supports_reasoning("google/gemma-2-9b-it:free") is False


def test_extract_reasoning_from_details_and_aliases() -> None:
    delta = SimpleNamespace(
        reasoning_details=[
            SimpleNamespace(text="Step one. "),
            {"text": "Step two."},
        ]
    )
    assert extract_reasoning_text(delta) == "Step one. Step two."
    assert extract_reasoning_text(SimpleNamespace(reasoning="plain")) == "plain"
    assert extract_reasoning_text(SimpleNamespace(reasoning_content="alias")) == "alias"


def test_iter_openai_compatible_chunks_splits_reasoning_and_content() -> None:
    stream = [
        SimpleNamespace(
            choices=[
                SimpleNamespace(
                    delta=SimpleNamespace(
                        reasoning_details=[{"text": "Think…"}],
                        content=None,
                    )
                )
            ]
        ),
        SimpleNamespace(
            choices=[
                SimpleNamespace(delta=SimpleNamespace(content="Answer", reasoning_details=None))
            ]
        ),
    ]

    chunks = list(iter_openai_compatible_chunks(stream))
    assert chunks == [
        StreamChunk(kind="reasoning", text="Think…"),
        StreamChunk(kind="content", text="Answer"),
    ]


def test_truncate_reasoning_caps_length() -> None:
    assert truncate_reasoning("short") == "short"
    assert truncate_reasoning("x" * 10, limit=5) == "xxxx…"
