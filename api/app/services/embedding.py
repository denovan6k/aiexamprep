"""Embedding helpers for material retrieval.

Uses OpenAI embeddings when configured, with a deterministic local fallback so
uploads and tests continue to work without network credentials.
"""
from __future__ import annotations

import hashlib
import math
import re
import threading
import time
from collections.abc import Iterable

from app.core.config import settings

TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9_-]{2,}")
DEFAULT_BATCH_SIZE = 64
DEFAULT_MAX_RETRIES = 2
DEFAULT_MAX_INPUT_CHARS = 6000
MIN_KEYWORD_SCORE = 0.15
MIN_EMBEDDING_SIMILARITY = 0.28
MIN_FALLBACK_EMBEDDING_SIMILARITY = 0.12
MIN_RELEVANCE_SCORE = 0.15


def embedding_min_similarity() -> float:
    return MIN_FALLBACK_EMBEDDING_SIMILARITY if not settings.openai_api_key else MIN_EMBEDDING_SIMILARITY


def normalize_vector(values: Iterable[float]) -> list[float]:
    vector = [float(value) for value in values]
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude <= 0:
        return vector
    return [value / magnitude for value in vector]


def cosine_similarity(left: list[float] | None, right: list[float] | None) -> float:
    if not left or not right:
        return 0.0
    size = min(len(left), len(right))
    if size <= 0:
        return 0.0
    return sum(float(left[index]) * float(right[index]) for index in range(size))


def fallback_embedding(text: str, *, dimension: int | None = None) -> list[float]:
    """Create a stable lexical embedding for offline ranking and tests."""
    size = max(16, int(dimension or settings.embedding_dimension))
    vector = [0.0] * size
    tokens = TOKEN_RE.findall(text.lower())
    if not tokens:
        return vector

    for token in tokens:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        index = int.from_bytes(digest[:4], "big") % size
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign
    return normalize_vector(vector)


def mean_pool(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return fallback_embedding("")
    width = max(len(vector) for vector in vectors)
    pooled = [0.0] * width
    for vector in vectors:
        for index, value in enumerate(vector):
            pooled[index] += float(value)
    return normalize_vector([value / len(vectors) for value in pooled])


def _batch(items: list[str], size: int) -> Iterable[list[str]]:
    batch_size = max(1, size)
    for index in range(0, len(items), batch_size):
        yield items[index : index + batch_size]


def _split_oversized_text(text: str, *, max_chars: int = DEFAULT_MAX_INPUT_CHARS) -> list[str]:
    cleaned = text.strip()
    if len(cleaned) <= max_chars:
        return [cleaned]

    parts: list[str] = []
    paragraphs = [part.strip() for part in re.split(r"\n{2,}", cleaned) if part.strip()]
    current = ""
    for paragraph in paragraphs or [cleaned]:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            parts.append(current)
        if len(paragraph) > max_chars:
            parts.extend(paragraph[index : index + max_chars] for index in range(0, len(paragraph), max_chars))
            current = ""
        else:
            current = paragraph
    if current:
        parts.append(current)
    return parts or [cleaned[:max_chars]]


_embedding_client: "OpenAI | None" = None
_embedding_client_lock = threading.Lock()


def _get_embedding_client() -> "OpenAI":
    global _embedding_client
    with _embedding_client_lock:
        if _embedding_client is None:
            from openai import OpenAI
            _embedding_client = OpenAI(api_key=settings.openai_api_key)
        return _embedding_client


def _provider_embed_batch(texts: list[str]) -> list[list[float]]:
    client = _get_embedding_client()
    response = client.embeddings.create(
        model=settings.embedding_model,
        input=texts,
        dimensions=settings.embedding_dimension,
    )
    by_index = sorted(response.data, key=lambda item: item.index)
    return [normalize_vector(item.embedding) for item in by_index]


def embed_texts(
    texts: list[str],
    *,
    batch_size: int = DEFAULT_BATCH_SIZE,
    max_retries: int = DEFAULT_MAX_RETRIES,
    max_input_chars: int = DEFAULT_MAX_INPUT_CHARS,
) -> list[list[float]]:
    if not texts:
        return []
    if not settings.openai_api_key:
        return [fallback_embedding(text) for text in texts]

    segment_texts: list[str] = []
    segment_to_original: list[int] = []
    for original_index, text in enumerate(texts):
        for segment in _split_oversized_text(text, max_chars=max_input_chars):
            segment_texts.append(segment)
            segment_to_original.append(original_index)

    segment_embeddings: list[list[float]] = []
    try:
        for batch in _batch(segment_texts, batch_size):
            for attempt in range(max(1, max_retries + 1)):
                try:
                    segment_embeddings.extend(_provider_embed_batch(batch))
                    break
                except Exception:
                    if attempt >= max_retries:
                        segment_embeddings.extend(fallback_embedding(text) for text in batch)
                        break
                    time.sleep(0.25 * (2**attempt))
    except Exception:
        return [fallback_embedding(text) for text in texts]

    grouped: list[list[list[float]]] = [[] for _ in texts]
    for original_index, embedding in zip(segment_to_original, segment_embeddings, strict=False):
        grouped[original_index].append(embedding)
    return [mean_pool(group) if group else fallback_embedding(texts[index]) for index, group in enumerate(grouped)]


def keyword_score(query: str, text: str) -> float:
    query_tokens = set(TOKEN_RE.findall(query.lower()))
    if not query_tokens:
        return 0.0
    text_tokens = set(TOKEN_RE.findall(text.lower()))
    if not text_tokens:
        return 0.0
    overlap = query_tokens & text_tokens
    return len(overlap) / len(query_tokens)


def rank_by_keyword(
    chunks: list[dict],
    query: str,
    *,
    limit: int | None = None,
    min_score: float = MIN_KEYWORD_SCORE,
) -> list[dict]:
    scored = [
        (keyword_score(query, str(chunk.get("text") or "")), index, chunk)
        for index, chunk in enumerate(chunks)
    ]
    scored.sort(key=lambda item: (-item[0], item[1]))
    ranked: list[dict] = []
    for score, _index, chunk in scored:
        if score < min_score:
            break
        enriched = dict(chunk)
        enriched["semantic_score"] = score
        ranked.append(enriched)
    return ranked[:limit] if limit else ranked


def rank_by_embedding(
    chunks: list[dict],
    query: str | None,
    *,
    limit: int | None = None,
    min_score: float | None = None,
) -> list[dict]:
    if not query:
        return chunks[:limit] if limit else chunks

    threshold = embedding_min_similarity() if min_score is None else min_score

    if not any(chunk.get("_embedding") for chunk in chunks):
        return rank_by_keyword(chunks, query, limit=limit, min_score=max(threshold, MIN_KEYWORD_SCORE))

    query_embedding = embed_texts([query])[0]
    scored: list[tuple[float, int, dict]] = []
    for index, chunk in enumerate(chunks):
        embedding = chunk.get("_embedding")
        if not embedding:
            score = keyword_score(query, str(chunk.get("text") or ""))
        else:
            score = cosine_similarity(query_embedding, embedding)
            score = max(score, keyword_score(query, str(chunk.get("text") or "")))
        scored.append((score, index, chunk))

    scored.sort(key=lambda item: (-item[0], item[1]))
    ranked: list[dict] = []
    for score, _index, chunk in scored:
        if score < threshold:
            break
        enriched = dict(chunk)
        enriched["semantic_score"] = score
        ranked.append(enriched)
    return ranked[:limit] if limit else ranked
