"""Context assembly and token budgeting for grounded study replies."""
from __future__ import annotations

import hashlib
import re
import threading
import time
from dataclasses import dataclass
from typing import Any, Literal

from app.services.headroom_compression import compress_text_block
from app.services.headroom_compression import estimate_tokens as headroom_estimate_tokens
from app.services.headroom_compression import flow_enabled


InclusionLevel = Literal["summary", "chunks", "full_text"]
TOKEN_CHARS = 4
DEFAULT_MAX_TOKENS = 3200
CACHE_TTL_SECONDS = 45
MAX_CACHE_ITEMS = 256
STOPWORDS = {
    "about",
    "after",
    "again",
    "also",
    "from",
    "have",
    "into",
    "that",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
    "your",
}


@dataclass(frozen=True)
class ContextChunk:
    id: str
    text: str
    material_title: str
    source: str
    token_count: int
    score: float


@dataclass(frozen=True)
class BuiltContext:
    prompt_text: str
    chunks: list[dict[str, Any]]
    indicators: list[dict[str, Any]]
    token_estimate: int
    truncated: bool


def estimate_tokens(text: str) -> int:
    return headroom_estimate_tokens(text) if text else 0


def _query_terms(query: str | None) -> set[str]:
    if not query:
        return set()
    return {
        term
        for term in re.findall(r"[A-Za-z][A-Za-z0-9_-]{3,}", query.lower())
        if term not in STOPWORDS
    }


class ContextBuilder:
    def __init__(self, *, max_tokens: int = DEFAULT_MAX_TOKENS) -> None:
        self.max_tokens = max(400, max_tokens)
        self._cache: dict[str, tuple[float, BuiltContext]] = {}
        self._cache_lock = threading.Lock()

    def build(
        self,
        chunks: list[dict[str, Any]],
        *,
        query: str | None = None,
        inclusion_level: InclusionLevel = "chunks",
        model: str | None = None,
    ) -> BuiltContext:
        cache_key = self._cache_key(
            chunks, query=query, inclusion_level=inclusion_level, model=model
        )
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached
        if not chunks:
            empty = BuiltContext("", [], [], 0, False)
            self._cache_put(cache_key, empty)
            return empty

        ranked = self._rank(chunks, query)
        budget = self.max_tokens
        selected: list[ContextChunk] = []
        prompt_parts: list[str] = []
        used_tokens = 0
        truncated = False
        compress_chat = flow_enabled("chat")

        for index, chunk in enumerate(ranked, start=1):
            text = self._excerpt(str(chunk.get("text") or ""), inclusion_level)
            if compress_chat and text.strip():
                compressed = compress_text_block(text, flow="chat", model=model)
                text = compressed.text
                token_count = (
                    compressed.tokens_after
                    if compressed.compressed
                    else estimate_tokens(text)
                )
            else:
                token_count = estimate_tokens(text)
            if used_tokens + token_count > budget:
                remaining = budget - used_tokens
                if remaining < 80:
                    truncated = True
                    break
                text = text[: remaining * TOKEN_CHARS].strip()
                token_count = estimate_tokens(text)
                truncated = True

            material_title = str(chunk.get("material_title") or "Material")
            source = str(chunk.get("source") or "personal")
            context_chunk = ContextChunk(
                id=str(chunk.get("id") or f"chunk-{index}"),
                text=text,
                material_title=material_title,
                source=source,
                token_count=token_count,
                score=float(chunk.get("_context_score") or 0),
            )
            selected.append(context_chunk)
            prompt_parts.append(
                f"[{len(selected)}] {material_title} ({source})\n{text}"
            )
            used_tokens += token_count
            if used_tokens >= budget:
                truncated = True
                break

        built = BuiltContext(
            prompt_text="\n\n".join(prompt_parts),
            chunks=[
                {
                    "id": chunk.id,
                    "text": chunk.text,
                    "material_title": chunk.material_title,
                    "source": chunk.source,
                }
                for chunk in selected
            ],
            indicators=[
                {
                    "chunk_id": chunk.id,
                    "material_title": chunk.material_title,
                    "source": chunk.source,
                    "token_count": chunk.token_count,
                }
                for chunk in selected
            ],
            token_estimate=used_tokens,
            truncated=truncated,
        )
        self._cache_put(cache_key, built)
        return built

    def _rank(self, chunks: list[dict[str, Any]], query: str | None) -> list[dict[str, Any]]:
        terms = _query_terms(query)
        if not terms:
            return chunks

        scored: list[tuple[float, int, dict[str, Any]]] = []
        for index, chunk in enumerate(chunks):
            text = str(chunk.get("text") or "").lower()
            overlap = sum(1 for term in terms if term in text)
            source_boost = 0.25 if chunk.get("source") == "institution" else 0.0
            score = overlap + source_boost
            enriched = dict(chunk)
            enriched["_context_score"] = score
            scored.append((score, index, enriched))
        scored.sort(key=lambda item: (-item[0], item[1]))
        return [chunk for _score, _index, chunk in scored]

    def _excerpt(self, text: str, inclusion_level: InclusionLevel) -> str:
        cleaned = re.sub(r"\s+", " ", text).strip()
        if inclusion_level == "summary":
            sentences = re.split(r"(?<=[.!?])\s+", cleaned)
            return " ".join(sentences[:2]).strip() or cleaned[:600]
        if inclusion_level == "full_text":
            return cleaned
        return cleaned[:1200].strip()

    def _cache_key(
        self,
        chunks: list[dict[str, Any]],
        *,
        query: str | None,
        inclusion_level: InclusionLevel,
        model: str | None = None,
    ) -> str:
        digest = hashlib.blake2b(digest_size=16)
        digest.update(str(self.max_tokens).encode("utf-8"))
        digest.update(str(inclusion_level).encode("utf-8"))
        digest.update((query or "").encode("utf-8"))
        digest.update(b"1" if flow_enabled("chat") else b"0")
        digest.update((model or "").encode("utf-8"))
        for chunk in chunks:
            digest.update(str(chunk.get("id") or "").encode("utf-8"))
            digest.update(str(chunk.get("material_title") or "").encode("utf-8"))
            digest.update(str(chunk.get("source") or "").encode("utf-8"))
            digest.update(str(chunk.get("text") or "").encode("utf-8"))
        return digest.hexdigest()

    def _cache_get(self, key: str) -> BuiltContext | None:
        now = time.monotonic()
        with self._cache_lock:
            item = self._cache.get(key)
            if item is None:
                return None
            expires_at, built = item
            if expires_at <= now:
                self._cache.pop(key, None)
                return None
            return built

    def _cache_put(self, key: str, value: BuiltContext) -> None:
        now = time.monotonic()
        with self._cache_lock:
            if len(self._cache) >= MAX_CACHE_ITEMS:
                oldest = min(self._cache.items(), key=lambda item: item[1][0])[0]
                self._cache.pop(oldest, None)
            self._cache[key] = (now + CACHE_TTL_SECONDS, value)


context_builder = ContextBuilder()
