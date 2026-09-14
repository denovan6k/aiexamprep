"""Text extraction and chunking for uploaded study materials."""
from __future__ import annotations

import re
from pathlib import Path


class ExtractionError(Exception):
    pass


SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md", ".markdown", ".docx"}
NOISY_GLYPHS = "\uf071\uf0a7\uf0d8\uf0fc\uf0b7\uf020"


def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _extract_pdf(path)
    if suffix in {".txt", ".md", ".markdown"}:
        return path.read_text(encoding="utf-8", errors="replace")
    if suffix == ".docx":
        return _extract_docx(path)
    raise ExtractionError(f"Unsupported file type: {suffix}")


def normalize_extracted_text(text: str) -> str:
    """Clean PDF/slide extraction artifacts before chunking or generation."""
    if not text:
        return ""

    cleaned = text.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = re.sub(r"\(cid:\d+\)", " ", cleaned, flags=re.I)
    cleaned = re.sub(r"[\ue000-\uf8ff\ufffd]", "\n", cleaned)
    cleaned = re.sub(f"[{re.escape(NOISY_GLYPHS)}]", "\n", cleaned)
    cleaned = re.sub(r"(?:â€¢|â—¦|â–ª|â–|â€™|â€œ|â€\u009d)", " ", cleaned)
    cleaned = re.sub(r"[\u2022\u25e6\u25aa\u25ab\u25cf\u25cb\u25a0\u25a1]+", "\n", cleaned)
    cleaned = re.sub(r"(?<=[A-Za-z])-\n(?=[A-Za-z])", "", cleaned)
    cleaned = re.sub(r"(?<=[a-z])\n(?=[a-z])", " ", cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)

    lines: list[str] = []
    for raw_line in cleaned.split("\n"):
        line = raw_line.strip()
        if not line:
            lines.append("")
            continue
        line = re.sub(r"^(?:[-*•]|\d+[.)])\s+", "", line).strip()
        if _is_noise_line(line):
            continue
        lines.append(line)

    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _is_noise_line(line: str) -> bool:
    if len(line) <= 2:
        return True
    if re.fullmatch(r"[\W\d_]+", line):
        return True
    if re.fullmatch(r"(?:slide|page)?\s*\d+", line, flags=re.I):
        return True
    return False


def _extract_pdf(path: Path) -> str:
    text = _extract_pdf_pypdf(path)
    if text.strip():
        return text

    text = _extract_pdf_pymupdf(path)
    if text.strip():
        return text

    text = _extract_pdf_content_core(path)
    if text.strip():
        return text

    raise ExtractionError(
        "No text could be extracted from this PDF. It may be scanned, image-only, or "
        "password-protected. Try uploading a text-based PDF, or export your notes as .txt or .md."
    )


def _extract_pdf_pypdf(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:  # pragma: no cover
        return ""

    reader = PdfReader(str(path))
    if getattr(reader, "is_encrypted", False):
        try:
            reader.decrypt("")
        except Exception as exc:
            raise ExtractionError("PDF is password-protected.") from exc

    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages)


def _extract_pdf_pymupdf(path: Path) -> str:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return ""

    document = fitz.open(str(path))
    try:
        pages: list[str] = []
        for page in document:
            text = (page.get_text("text") or "").strip()
            if text:
                pages.append(text)
                continue

            blocks = page.get_text("blocks") or []
            block_text = "\n".join(
                block[4].strip()
                for block in blocks
                if len(block) > 4 and isinstance(block[4], str) and block[4].strip()
            )
            if block_text:
                pages.append(block_text)
                continue

            page_dict = page.get_text("dict") or {}
            spans: list[str] = []
            for block in page_dict.get("blocks", []):
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        span_text = span.get("text", "")
                        if span_text:
                            spans.append(span_text)
            joined = " ".join(spans).strip()
            if joined:
                pages.append(joined)

        return "\n\n".join(pages)
    finally:
        document.close()


def _extract_pdf_content_core(path: Path) -> str:
    """Fallback extractor used by open-notebook via the content-core library."""
    try:
        import asyncio

        from content_core import extract_content
    except ImportError:
        return ""

    state = {
        "file_path": str(path),
        "document_engine": "auto",
        "output_format": "markdown",
    }
    try:
        processed = asyncio.run(extract_content(state))
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            processed = loop.run_until_complete(extract_content(state))
        finally:
            loop.close()
    except Exception:
        return ""

    return (getattr(processed, "content", None) or "").strip()


def _extract_docx(path: Path) -> str:
    try:
        import docx
    except ImportError as exc:  # pragma: no cover
        raise ExtractionError(
            "DOCX support is unavailable on the server (python-docx not installed)."
        ) from exc

    document = docx.Document(str(path))
    return "\n\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text)


def _merge_small_chunks(chunks: list[str], *, min_chars: int, max_chars: int) -> list[str]:
    if min_chars <= 0 or len(chunks) <= 1:
        return chunks

    merged: list[str] = []
    buffer = ""
    soft_max = max_chars + min_chars
    for chunk in chunks:
        candidate = f"{buffer}\n\n{chunk}".strip() if buffer else chunk
        if len(candidate) <= max_chars and (buffer or len(chunk) < min_chars):
            buffer = candidate
            continue
        if buffer:
            merged.append(buffer)
            buffer = ""
        if len(chunk) < min_chars and merged and len(f"{merged[-1]}\n\n{chunk}") <= max_chars:
            merged[-1] = f"{merged[-1]}\n\n{chunk}"
        elif len(chunk) < min_chars and merged and len(f"{merged[-1]}\n\n{chunk}") <= soft_max:
            merged[-1] = f"{merged[-1]}\n\n{chunk}"
        else:
            merged.append(chunk)
    if buffer:
        if merged and len(buffer) < min_chars and len(f"{merged[-1]}\n\n{buffer}") <= max_chars:
            merged[-1] = f"{merged[-1]}\n\n{buffer}"
        elif merged and len(buffer) < min_chars and len(f"{merged[-1]}\n\n{buffer}") <= soft_max:
            merged[-1] = f"{merged[-1]}\n\n{buffer}"
        else:
            merged.append(buffer)
    return merged


def chunk_text(
    text: str,
    *,
    max_chars: int = 1400,
    overlap: int = 150,
    min_chars: int = 220,
) -> list[str]:
    """Split text into overlapping chunks on paragraph/sentence boundaries."""
    normalized = normalize_extracted_text(text)
    if not normalized:
        return []
    if len(normalized) <= max_chars:
        return [normalized]

    paragraphs = [p.strip() for p in re.split(r"\n{2,}", normalized) if p.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            chunks.append(current)
        # Paragraph itself too large: split by sentence.
        if len(paragraph) > max_chars:
            sentences = re.split(r"(?<=[.!?])\s+", paragraph)
            current = ""
            for sentence in sentences:
                candidate = f"{current} {sentence}".strip() if current else sentence
                if len(candidate) <= max_chars:
                    current = candidate
                else:
                    if current:
                        chunks.append(current)
                    current = sentence[:max_chars]
        else:
            current = paragraph
    if current:
        chunks.append(current)

    chunks = _merge_small_chunks(chunks, min_chars=min_chars, max_chars=max_chars)

    # Add small overlap from the previous chunk for retrieval continuity.
    if overlap > 0 and len(chunks) > 1:
        overlapped = [chunks[0]]
        for previous, chunk in zip(chunks, chunks[1:]):
            tail = previous[-overlap:]
            overlapped.append(f"{tail} {chunk}".strip())
        chunks = overlapped
    return chunks
