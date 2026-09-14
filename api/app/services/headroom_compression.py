"""Optional Headroom context compression — fail-open, feature-flagged."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Literal

from app.core.config import settings

logger = logging.getLogger(__name__)

Flow = Literal["chat", "generation", "mcp_tools", "attachments"]

_SOURCE_BODY_RE = re.compile(
    r"(<source\b[^>]*>)(.*?)(</source>)",
    re.IGNORECASE | re.DOTALL,
)
_UNTRUSTED_MATERIAL_RE = re.compile(
    r"(<untrusted_material>)(.*?)(</untrusted_material>)",
    re.IGNORECASE | re.DOTALL,
)
_UNTRUSTED_ATTACHED_RE = re.compile(
    r"(<untrusted_attached_media>)(.*?)(</untrusted_attached_media>)",
    re.IGNORECASE | re.DOTALL,
)

TOKEN_CHARS = 4


@dataclass(frozen=True)
class CompressResult:
    text: str
    tokens_before: int
    tokens_after: int
    compressed: bool

    @property
    def ratio(self) -> float:
        if self.tokens_before <= 0:
            return 1.0
        return self.tokens_after / self.tokens_before

    @property
    def tokens_saved(self) -> int:
        return max(0, self.tokens_before - self.tokens_after)


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // TOKEN_CHARS) if text else 0


def flow_enabled(flow: Flow) -> bool:
    if not settings.headroom_enabled:
        return False
    if flow == "chat":
        return bool(settings.headroom_compress_chat)
    if flow == "generation":
        return bool(settings.headroom_compress_generation)
    if flow == "mcp_tools":
        return bool(settings.headroom_compress_mcp_tools)
    if flow == "attachments":
        return bool(settings.headroom_compress_attachments)
    return False


def _extract_compressed_text(result: Any, original: str) -> str | None:
    if result is None:
        return None
    if isinstance(result, str):
        return result
    compressed = getattr(result, "compressed", None)
    if isinstance(compressed, str) and compressed.strip():
        return compressed
    messages = getattr(result, "messages", None)
    if isinstance(messages, list) and messages:
        last = messages[-1]
        if isinstance(last, dict):
            content = last.get("content")
            if isinstance(content, str) and content.strip():
                return content
            if isinstance(content, list):
                parts = [
                    str(part.get("text") or "")
                    for part in content
                    if isinstance(part, dict) and part.get("type") in {None, "text", "input_text"}
                ]
                joined = "".join(parts).strip()
                if joined:
                    return joined
        content = getattr(last, "content", None)
        if isinstance(content, str) and content.strip():
            return content
    text = getattr(result, "text", None)
    if isinstance(text, str) and text.strip():
        return text
    return None


def _extract_token_counts(result: Any, original: str, compressed: str) -> tuple[int, int]:
    before = getattr(result, "tokens_before", None)
    after = getattr(result, "tokens_after", None)
    if isinstance(before, (int, float)) and isinstance(after, (int, float)):
        return max(0, int(before)), max(0, int(after))
    saved = getattr(result, "tokens_saved", None)
    if isinstance(saved, (int, float)):
        before_est = estimate_tokens(original)
        return before_est, max(0, before_est - int(saved))
    return estimate_tokens(original), estimate_tokens(compressed)


_headroom_import_warned = False


def _call_headroom(text: str, *, model: str | None) -> Any | None:
    global _headroom_import_warned
    try:
        from headroom import compress  # type: ignore[import-not-found]
    except ImportError:
        if not _headroom_import_warned:
            logger.warning("headroom-ai is not installed; skipping compression")
            _headroom_import_warned = True
        return None
    try:
        kwargs: dict[str, Any] = {}
        if model:
            kwargs["model"] = model
        return compress(text, **kwargs)
    except TypeError:
        # Older / alternate signatures may not accept model=.
        try:
            return compress(text)
        except Exception as exc:
            logger.warning("Headroom compression failed: %s", exc)
            return None
    except Exception as exc:
        logger.warning("Headroom compression failed: %s", exc)
        return None


def compress_text_block(
    text: str,
    *,
    flow: Flow,
    model: str | None = None,
) -> CompressResult:
    """Compress a plain text / JSON block. Fail-open on disable, import, or runtime errors."""
    original = text or ""
    before = estimate_tokens(original)
    if not original.strip() or not flow_enabled(flow):
        return CompressResult(original, before, before, False)

    result = _call_headroom(original, model=model)
    if result is None:
        return CompressResult(original, before, before, False)

    compressed = _extract_compressed_text(result, original)
    if not compressed or compressed == original:
        return CompressResult(original, before, before, False)

    tokens_before, tokens_after = _extract_token_counts(result, original, compressed)
    logger.info(
        "headroom_compress flow=%s tokens_before=%s tokens_after=%s ratio=%.3f",
        flow,
        tokens_before,
        tokens_after,
        (tokens_after / tokens_before) if tokens_before else 1.0,
    )
    return CompressResult(compressed, tokens_before, tokens_after, True)


def compress_source_corpus(corpus: str, *, model: str | None = None) -> str:
    """Compress text inside <source>...</source> bodies; preserve tags and attributes."""
    if not corpus or not flow_enabled("generation"):
        return corpus

    def _replace(match: re.Match[str]) -> str:
        open_tag, body, close_tag = match.group(1), match.group(2), match.group(3)
        inner = body.strip("\n")
        if not inner.strip():
            return match.group(0)
        result = compress_text_block(inner, flow="generation", model=model)
        return f"{open_tag}\n{result.text}\n{close_tag}"

    return _SOURCE_BODY_RE.sub(_replace, corpus)


def compress_user_material_blocks(user: str, *, model: str | None = None) -> str:
    """Compress untrusted material (and optionally attachment) fences in a user prompt."""
    if not user:
        return user
    output = user

    if flow_enabled("chat"):

        def _replace_material(match: re.Match[str]) -> str:
            open_tag, body, close_tag = match.group(1), match.group(2), match.group(3)
            inner = body.strip("\n")
            if not inner.strip():
                return match.group(0)
            result = compress_text_block(inner, flow="chat", model=model)
            return f"{open_tag}\n{result.text}\n{close_tag}"

        output = _UNTRUSTED_MATERIAL_RE.sub(_replace_material, output)

    if flow_enabled("attachments"):

        def _replace_attached(match: re.Match[str]) -> str:
            open_tag, body, close_tag = match.group(1), match.group(2), match.group(3)
            inner = body.strip("\n")
            if not inner.strip():
                return match.group(0)
            result = compress_text_block(inner, flow="attachments", model=model)
            return f"{open_tag}\n{result.text}\n{close_tag}"

        output = _UNTRUSTED_ATTACHED_RE.sub(_replace_attached, output)

    return output


def compress_tool_result(text: str, *, model: str | None = None) -> str:
    """Compress MCP / tool-loop result payloads (often JSON)."""
    result = compress_text_block(text or "", flow="mcp_tools", model=model)
    return result.text
