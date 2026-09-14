from pathlib import Path

import pytest

from app.services.extraction import ExtractionError, chunk_text, extract_text, normalize_extracted_text


def test_chunk_text_splits_long_content() -> None:
    text = "Paragraph one.\n\n" + ("Sentence. " * 400)
    chunks = chunk_text(text, max_chars=200, overlap=0)
    assert len(chunks) > 1
    assert all(chunk.strip() for chunk in chunks)


def test_extract_txt_round_trip(tmp_path: Path) -> None:
    path = tmp_path / "notes.txt"
    path.write_text("Binary trees and graph traversal.", encoding="utf-8")
    assert "Binary trees" in extract_text(path)


def test_normalize_extracted_text_removes_pdf_private_use_bullets() -> None:
    text = "Stacks 32\n\uf071 pop() removes the node at the tail.\n(cid:12)\nâ€¢ Array resizing"
    normalized = normalize_extracted_text(text)

    assert "\uf071" not in normalized
    assert "(cid:" not in normalized
    assert "pop() removes the node at the tail." in normalized
    assert "Array resizing" in normalized


def test_extract_pdf_pypdf_missing_falls_back(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    import app.services.extraction as extraction

    monkeypatch.setattr(extraction, "_extract_pdf_pypdf", lambda _path: "")
    monkeypatch.setattr(extraction, "_extract_pdf_pymupdf", lambda _path: "Recovered tree notes.")
    path = tmp_path / "trees.pdf"
    path.write_bytes(b"%PDF-1.4")
    assert "Recovered tree notes" in extraction._extract_pdf(path)


def test_extract_pdf_empty_raises_helpful_error(tmp_path: Path) -> None:
    try:
        from pypdf import PdfWriter
    except ImportError:
        pytest.skip("pypdf not installed")

    path = tmp_path / "blank.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    with path.open("wb") as handle:
        writer.write(handle)

    with pytest.raises(ExtractionError, match="No text could be extracted"):
        extract_text(path)


def test_extract_pdf_pymupdf_uses_block_fallback(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    import app.services.extraction as extraction

    class FakePage:
        def get_text(self, mode: str):
            if mode == "text":
                return ""
            if mode == "blocks":
                return [(0, 0, 10, 10, "Queue nodes store adjacency lists.", 0)]
            if mode == "dict":
                return {"blocks": []}
            return ""

    class FakeDocument:
        def __iter__(self):
            return iter([FakePage()])

        def close(self) -> None:
            return None

    class FakeFitz:
        def open(self, _path: str):
            return FakeDocument()

    monkeypatch.setattr(extraction, "_extract_pdf_pypdf", lambda _path: "")
    monkeypatch.setattr(extraction, "_extract_pdf_content_core", lambda _path: "")
    monkeypatch.setitem(__import__("sys").modules, "fitz", FakeFitz())

    path = tmp_path / "queues.pdf"
    path.write_bytes(b"%PDF-1.4")
    assert "adjacency lists" in extraction._extract_pdf(path)
