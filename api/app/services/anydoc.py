"""Anydoc Document Parser service with fallback to extraction service."""
from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from app.services.extraction import extract_text, normalize_extracted_text

logger = logging.getLogger(__name__)

SUPPORTED_FORMATS = {
    "pdf",
    "doc",
    "docx",
    "docm",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "odt",
    "ods",
    "odp",
    "rtf",
    "epub",
    "csv",
}


class AnydocParser:
    """Service to convert documents to markdown using firecrawl-anydoc with fallback."""

    SUPPORTED_FORMATS = SUPPORTED_FORMATS

    @staticmethod
    def parse_document(file_bytes: bytes, filename: str, format: str) -> tuple[str, str]:
        fmt = format.lower().lstrip(".")
        
        # Try parsing via anydoc
        try:
            import anydoc
            
            # Call to_markdown_bytes on anydoc
            try:
                result = anydoc.to_markdown_bytes(file_bytes, format=fmt)
            except TypeError:
                try:
                    result = anydoc.to_markdown_bytes(file_bytes, filename=filename)
                except TypeError:
                    result = anydoc.to_markdown_bytes(file_bytes)

            if isinstance(result, bytes):
                raw_text = result.decode("utf-8", errors="replace")
            else:
                raw_text = str(result)

            normalized = normalize_extracted_text(raw_text)
            if normalized.strip():
                return normalized, "anydoc"
            
            logger.warning(
                "anydoc returned empty text for %s (%s). Falling back to extraction service.",
                filename,
                fmt,
            )
        except Exception as exc:
            logger.warning(
                "anydoc parsing failed for %s (%s): %s. Falling back to extraction service.",
                filename,
                fmt,
                exc,
            )

        # Fallback to app.services.extraction
        return AnydocParser._fallback_parse(file_bytes, filename, fmt)

    @staticmethod
    def _fallback_parse(file_bytes: bytes, filename: str, fmt: str) -> tuple[str, str]:
        ext = f".{fmt}" if fmt else Path(filename).suffix or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(file_bytes)

        try:
            try:
                raw_text = extract_text(temp_path)
            except Exception as exc:
                logger.error("Fallback extraction also failed for %s: %s", filename, exc)
                return "", "fallback"

            normalized = normalize_extracted_text(raw_text)
            return normalized, "fallback"
        finally:
            temp_path.unlink(missing_ok=True)


def parse_document(file_bytes: bytes, filename: str, format: str) -> tuple[str, str]:
    """Parse document using AnydocParser."""
    return AnydocParser.parse_document(file_bytes, filename, format)
