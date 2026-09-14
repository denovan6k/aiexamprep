"""Simple per-user rate limiting for generation endpoints.

Uses Redis when available; falls back to an in-memory store for local dev and tests.
"""
from __future__ import annotations

import time
import uuid
from collections import defaultdict
from threading import Lock

from fastapi import Depends, HTTPException, status

from app.core.config import settings
from app.core.deps import get_current_user
from app.models import User

QUIZ_GENERATION_LIMIT = 20
QUIZ_GENERATION_WINDOW_SECONDS = 3600
CHAT_GENERATION_LIMIT = 60
CHAT_GENERATION_WINDOW_SECONDS = 3600

_store: dict[str, list[float]] = defaultdict(list)
_lock = Lock()
_redis = None
_redis_checked = False


def _get_redis():
    global _redis, _redis_checked
    if _redis_checked:
        return _redis
    _redis_checked = True
    if not settings.redis_url:
        return None
    try:
        import redis

        client = redis.from_url(settings.redis_url, decode_responses=True)
        client.ping()
        _redis = client
    except Exception:
        _redis = None
    return _redis


def reset_rate_limits_for_tests() -> None:
    """Clear in-memory counters between tests."""
    with _lock:
        _store.clear()
    redis_client = _get_redis()
    if redis_client is not None:
        try:
            keys = redis_client.keys("rate:*")
            if keys:
                redis_client.delete(*keys)
        except Exception:
            pass


def _too_many_requests(bucket: str, limit: int, window_seconds: int) -> HTTPException:
    window_label = f"{window_seconds // 3600} hour" if window_seconds >= 3600 else f"{window_seconds}s"
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS,
        detail=(
            f"Rate limit exceeded for {bucket.replace('_', ' ')} "
            f"({limit} per {window_label}). Try again later."
        ),
    )


def check_rate_limit(user_id: uuid.UUID, bucket: str, *, limit: int, window_seconds: int) -> None:
    if not settings.rate_limit_enabled:
        return

    key = f"rate:{bucket}:{user_id}"
    _check_rate_limit_key(key, bucket=bucket, limit=limit, window_seconds=window_seconds)


def check_email_rate_limit(email: str, bucket: str, *, limit: int, window_seconds: int) -> None:
    if not settings.rate_limit_enabled:
        return

    normalized = email.strip().lower()
    key = f"rate:{bucket}:{normalized}"
    _check_rate_limit_key(key, bucket=bucket, limit=limit, window_seconds=window_seconds)


def _check_rate_limit_key(key: str, *, bucket: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    window_start = now - window_seconds

    redis_client = _get_redis()
    if redis_client is not None:
        pipe = redis_client.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        _, current_count = pipe.execute()
        if current_count >= limit:
            raise _too_many_requests(bucket, limit, window_seconds)
        pipe = redis_client.pipeline()
        pipe.zadd(key, {f"{now}": now})
        pipe.expire(key, window_seconds)
        pipe.execute()
        return

    with _lock:
        timestamps = [stamp for stamp in _store[key] if stamp > window_start]
        if len(timestamps) >= limit:
            raise _too_many_requests(bucket, limit, window_seconds)
        timestamps.append(now)
        _store[key] = timestamps


def rate_limit_quiz_generation(user: User = Depends(get_current_user)) -> None:
    check_rate_limit(
        user.id,
        "quiz_generation",
        limit=settings.rate_limit_quiz_generations_per_hour,
        window_seconds=QUIZ_GENERATION_WINDOW_SECONDS,
    )


def enforce_quiz_generation_rate_limit(user_id: uuid.UUID) -> None:
    check_rate_limit(
        user_id,
        "quiz_generation",
        limit=settings.rate_limit_quiz_generations_per_hour,
        window_seconds=QUIZ_GENERATION_WINDOW_SECONDS,
    )


def rate_limit_chat_generation(user: User = Depends(get_current_user)) -> None:
    check_rate_limit(
        user.id,
        "chat_generation",
        limit=settings.rate_limit_chat_generations_per_hour,
        window_seconds=CHAT_GENERATION_WINDOW_SECONDS,
    )
