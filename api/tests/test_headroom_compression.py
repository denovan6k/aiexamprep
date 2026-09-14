"""Unit tests for optional Headroom compression wrapper."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services import headroom_compression as hc
from app.services.context_builder import ContextBuilder
from app.services.generation import build_quiz_corpus


def test_compress_text_block_noop_when_disabled(monkeypatch) -> None:
    monkeypatch.setattr(hc.settings, "headroom_enabled", False)
    original = "photosynthesis converts sunlight into chemical energy " * 20
    result = hc.compress_text_block(original, flow="chat")
    assert result.text == original
    assert result.compressed is False
    assert result.tokens_before == result.tokens_after


def test_compress_text_block_fail_open_when_headroom_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(hc.settings, "headroom_enabled", True)
    monkeypatch.setattr(hc.settings, "headroom_compress_chat", True)
    original = "chlorophyll absorbs light for photosynthesis"
    with patch.object(hc, "_call_headroom", return_value=None):
        result = hc.compress_text_block(original, flow="chat")
    assert result.text == original
    assert result.compressed is False


def test_compress_text_block_fail_open_on_runtime_error(monkeypatch) -> None:
    monkeypatch.setattr(hc.settings, "headroom_enabled", True)
    monkeypatch.setattr(hc.settings, "headroom_compress_chat", True)
    original = "mitochondria produce ATP in cellular respiration"
    with patch.object(hc, "_call_headroom", return_value=None):
        result = hc.compress_text_block(original, flow="chat")
    assert result.text == original
    assert result.compressed is False


def test_compress_text_block_uses_headroom_result(monkeypatch) -> None:
    monkeypatch.setattr(hc.settings, "headroom_enabled", True)
    monkeypatch.setattr(hc.settings, "headroom_compress_chat", True)
    original = "long study excerpt about photosynthesis and chlorophyll " * 10
    compressed = "photosynthesis chlorophyll summary"

    fake = SimpleNamespace(
        compressed=compressed,
        tokens_before=100,
        tokens_after=20,
    )
    with patch.object(hc, "_call_headroom", return_value=fake):
        result = hc.compress_text_block(original, flow="chat", model="gpt-4o")

    assert result.compressed is True
    assert result.text == compressed
    assert result.tokens_before == 100
    assert result.tokens_after == 20
    assert result.tokens_saved == 80


def test_compress_source_corpus_preserves_chunk_ids(monkeypatch) -> None:
    monkeypatch.setattr(hc.settings, "headroom_enabled", True)
    monkeypatch.setattr(hc.settings, "headroom_compress_generation", True)

    def fake_compress(text: str, *, flow: str, model: str | None = None):
        return hc.CompressResult(f"COMPRESSED:{text[:40]}", 50, 20, True)

    corpus = (
        '<source title="Biology" chunk_id="chunk-abc">\n'
        "photosynthesis converts light energy into chemical energy using chlorophyll.\n"
        "</source>"
    )
    with patch.object(hc, "compress_text_block", side_effect=fake_compress):
        out = hc.compress_source_corpus(corpus)

    assert 'chunk_id="chunk-abc"' in out
    assert 'title="Biology"' in out
    assert "<source" in out and "</source>" in out
    assert "COMPRESSED:" in out


def test_build_quiz_corpus_preserves_chunk_ids_with_headroom(monkeypatch) -> None:
    monkeypatch.setattr(hc.settings, "headroom_enabled", True)
    monkeypatch.setattr(hc.settings, "headroom_compress_generation", True)

    def fake_compress(text: str, *, flow: str, model: str | None = None):
        return hc.CompressResult(text[::2], len(text) // 4, len(text) // 8 or 1, True)

    chunks = [
        {
            "id": "chunk-1",
            "material_title": "Biology Notes",
            "text": "Chlorophyll helps photosynthesis convert sunlight into sugar. " * 5,
        },
        {
            "id": "chunk-2",
            "material_title": "Cell Biology",
            "text": "Mitochondria are the powerhouse of the cell producing ATP. " * 5,
        },
    ]
    with patch.object(hc, "compress_text_block", side_effect=fake_compress):
        corpus = build_quiz_corpus(chunks)

    assert 'chunk_id="chunk-1"' in corpus
    assert 'chunk_id="chunk-2"' in corpus
    assert 'title="Biology Notes"' in corpus
    assert 'title="Cell Biology"' in corpus


def test_compress_user_material_blocks(monkeypatch) -> None:
    monkeypatch.setattr(hc.settings, "headroom_enabled", True)
    monkeypatch.setattr(hc.settings, "headroom_compress_chat", True)
    monkeypatch.setattr(hc.settings, "headroom_compress_attachments", False)

    user = (
        "<untrusted_material>\n"
        "long material excerpt about stacks and queues\n"
        "</untrusted_material>\n"
        "<untrusted_user_message>\n"
        "Explain stacks\n"
        "</untrusted_user_message>"
    )

    fake = SimpleNamespace(compressed="stacks queues summary", tokens_before=40, tokens_after=10)
    with patch.object(hc, "_call_headroom", return_value=fake):
        out = hc.compress_user_material_blocks(user)

    assert "<untrusted_material>\nstacks queues summary\n</untrusted_material>" in out
    assert "<untrusted_user_message>\nExplain stacks\n</untrusted_user_message>" in out


def test_context_builder_compresses_when_enabled(monkeypatch) -> None:
    monkeypatch.setattr(hc.settings, "headroom_enabled", True)
    monkeypatch.setattr(hc.settings, "headroom_compress_chat", True)

    fake = SimpleNamespace(
        compressed="short chlorophyll note",
        tokens_before=200,
        tokens_after=30,
    )
    chunks = [
        {
            "id": "chunk-1",
            "text": "photosynthesis " * 200,
            "material_title": "Biology",
            "source": "personal",
        }
    ]
    with patch.object(hc, "_call_headroom", return_value=fake):
        built = ContextBuilder(max_tokens=400).build(chunks, query="photosynthesis")

    assert built.chunks[0]["text"] == "short chlorophyll note"
    assert built.token_estimate == 30
    assert built.indicators[0]["chunk_id"] == "chunk-1"


def test_context_builder_unchanged_when_disabled(monkeypatch) -> None:
    monkeypatch.setattr(hc.settings, "headroom_enabled", False)
    chunks = [
        {
            "id": "chunk-1",
            "text": "Chlorophyll helps photosynthesis convert sunlight.",
            "material_title": "Biology",
            "source": "personal",
        }
    ]
    spy = MagicMock()
    with patch.object(hc, "compress_text_block", spy):
        built = ContextBuilder(max_tokens=400).build(chunks, query="photosynthesis")
    spy.assert_not_called()
    assert "Chlorophyll" in built.chunks[0]["text"]
