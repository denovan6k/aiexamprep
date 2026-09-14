"""Typed LLM stream chunks for answer text and model reasoning."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

StreamChunkKind = Literal["reasoning", "content"]

# Cap persisted reasoning so message metadata stays bounded.
MAX_REASONING_CHARS = 50_000


@dataclass(frozen=True)
class StreamChunk:
    kind: StreamChunkKind
    text: str


def model_supports_reasoning(model_id: str | None, *, supported_parameters: list[str] | None = None) -> bool:
    """Detect whether a model can emit visible reasoning tokens."""
    if supported_parameters:
        params = {str(item).lower() for item in supported_parameters}
        if "reasoning" in params or "include_reasoning" in params:
            return True

    if not model_id:
        return False

    normalized = model_id.lower()
    hints = (
        ":thinking",
        "deepseek-r1",
        "deepseek-reasoner",
        "reasoner",
        "qwq",
        "o1-",
        "o1/",
        "o3-",
        "o3/",
        "o4-",
        "o4/",
        "gpt-5",
        "claude-opus-4",
        "claude-sonnet-4",
        "claude-3-7-sonnet",
        "gemini-2.5-flash-thinking",
        "gemini-2.0-flash-thinking",
    )
    return any(hint in normalized for hint in hints)


def extract_reasoning_text(delta: Any) -> str | None:
    """Pull plaintext reasoning from an OpenAI-compatible stream delta."""
    if delta is None:
        return None

    for attr in ("reasoning", "reasoning_content"):
        value = getattr(delta, attr, None)
        if isinstance(value, str) and value:
            return value
        if isinstance(value, dict):
            text = value.get("text") or value.get("content")
            if isinstance(text, str) and text:
                return text

    if isinstance(delta, dict):
        for key in ("reasoning", "reasoning_content"):
            value = delta.get(key)
            if isinstance(value, str) and value:
                return value

    details = getattr(delta, "reasoning_details", None)
    if details is None and isinstance(delta, dict):
        details = delta.get("reasoning_details")
    if not details:
        return None

    parts: list[str] = []
    for item in details:
        if item is None:
            continue
        if isinstance(item, str) and item:
            parts.append(item)
            continue
        text = getattr(item, "text", None) if not isinstance(item, dict) else item.get("text")
        if text is None and isinstance(item, dict):
            text = item.get("content")
        if isinstance(text, str) and text and text != "[REDACTED]":
            parts.append(text)
    return "".join(parts) or None


def extract_content_text(delta: Any) -> str | None:
    if delta is None:
        return None
    content = getattr(delta, "content", None)
    if content is None and isinstance(delta, dict):
        content = delta.get("content")
    if isinstance(content, str) and content:
        return content
    return None


def iter_openai_compatible_chunks(stream: Any):
    """Yield StreamChunks from an OpenAI/OpenRouter chat completion stream."""
    for chunk in stream:
        choices = getattr(chunk, "choices", None) or []
        if not choices:
            continue
        delta = choices[0].delta if hasattr(choices[0], "delta") else None
        reasoning = extract_reasoning_text(delta)
        if reasoning:
            yield StreamChunk(kind="reasoning", text=reasoning)
        content = extract_content_text(delta)
        if content:
            yield StreamChunk(kind="content", text=content)


def truncate_reasoning(text: str, *, limit: int = MAX_REASONING_CHARS) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"
