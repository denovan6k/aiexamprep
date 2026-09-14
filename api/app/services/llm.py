"""LLM client — multi-provider platform registry + optional BYOK override."""

from __future__ import annotations

import base64
import contextvars
import json
import logging
import mimetypes
import threading
import time
from dataclasses import dataclass
from typing import Any, Mapping

import httpx

from app.core.config import settings
from app.services.error_classifier import classify_llm_error
from app.services.llm_providers import (
    OPENROUTER_BASE_URL,
    OPENAI_BASE_URL,
    configured_providers,
    infer_provider_from_model,
    is_provider_configured,
    provider_api_key,
    resolve_default_platform,
    resolve_platform_route,
)
from app.services.providers.base import (
    ProviderAuthError,
    ProviderError,
    ProviderRateLimitError,
    default_model,
    get_adapter,
)
from app.services.stream_chunks import StreamChunk, iter_openai_compatible_chunks

logger = logging.getLogger(__name__)

_MAX_VISION_IMAGE_BYTES = 20 * 1024 * 1024

OPENROUTER_RATE_LIMIT_COOLDOWN_SECONDS = 60
OPENROUTER_RATE_LIMIT_MAX_COOLDOWN_SECONDS = 1800

_openrouter_rate_limited_until = 0.0
_openrouter_rate_limit_lock = threading.Lock()


@dataclass(frozen=True)
class LlmOverride:
    provider: str
    api_key: str


_llm_override: contextvars.ContextVar[LlmOverride | None] = contextvars.ContextVar(
    "llm_override", default=None
)
_platform_provider: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "platform_provider", default=None
)
_llm_degradation: contextvars.ContextVar[dict[str, str] | None] = contextvars.ContextVar(
    "llm_degradation", default=None
)


class LlmCallError(Exception):
    pass


class LlmRateLimitError(LlmCallError):
    pass


class LlmAuthError(LlmCallError):
    pass


def set_platform_provider(provider: str | None) -> contextvars.Token:
    return _platform_provider.set((provider or "").strip().lower() or None)


def reset_platform_provider(token: contextvars.Token) -> None:
    try:
        _platform_provider.reset(token)
    except ValueError:
        _platform_provider.set(None)


def get_platform_provider() -> str | None:
    return _platform_provider.get()


def _openrouter_in_cooldown(*, override: LlmOverride | None | object = ...) -> bool:
    if _resolve_override(override) or not is_openrouter(override=override):
        return False
    return time.monotonic() < _openrouter_rate_limited_until


def _mark_openrouter_rate_limited(exc: Exception | None = None) -> None:
    global _openrouter_rate_limited_until
    wait = OPENROUTER_RATE_LIMIT_COOLDOWN_SECONDS
    retry_after = _extract_retry_after_seconds(exc)
    if retry_after is not None:
        wait = int(
            min(
                max(retry_after, OPENROUTER_RATE_LIMIT_COOLDOWN_SECONDS),
                OPENROUTER_RATE_LIMIT_MAX_COOLDOWN_SECONDS,
            )
        )
    until = time.monotonic() + wait
    with _openrouter_rate_limit_lock:
        _openrouter_rate_limited_until = max(_openrouter_rate_limited_until, until)


def _extract_retry_after_seconds(exc: Exception | None) -> float | None:
    """Read the Retry-After header (seconds) from an OpenAI SDK API error."""
    if exc is None:
        return None
    headers = getattr(getattr(exc, "response", None), "headers", None)
    if headers is None:
        return None
    try:
        raw = headers.get("retry-after")
    except Exception:
        return None
    if raw is None:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def _rate_limit_message(*, provider: str | None = None) -> str:
    if provider == "openrouter" or (provider is None and is_provider_configured("openrouter")):
        remaining = int(_openrouter_rate_limited_until - time.monotonic())
        if remaining > 0:
            minutes = max(1, round(remaining / 60))
            wait_hint = f"Try again in about {minutes} minute(s)"
        else:
            wait_hint = "Wait about a minute"
        return (
            "OpenRouter is rate-limiting requests right now (common on free models). "
            f"{wait_hint} or choose a different model."
        )
    return "The AI provider is rate-limiting requests. Wait a moment and try again."


def _map_platform_error(exc: Exception, *, provider: str | None = None) -> LlmCallError | None:
    try:
        from openai import APIStatusError, AuthenticationError, RateLimitError
    except ImportError:
        return None

    if isinstance(exc, RateLimitError):
        return LlmRateLimitError(_rate_limit_message(provider=provider))
    if isinstance(exc, AuthenticationError):
        return LlmAuthError("The configured AI API key is invalid or expired.")
    if isinstance(exc, APIStatusError):
        if exc.status_code == 429:
            return LlmRateLimitError(_rate_limit_message(provider=provider))
        if exc.status_code in {401, 403}:
            return LlmAuthError("The configured AI API key is invalid or expired.")
    message = str(exc).lower()
    if "429" in message or "rate limit" in message or "too many requests" in message:
        return LlmRateLimitError(_rate_limit_message(provider=provider))
    return None


def set_llm_override(override: LlmOverride | None) -> contextvars.Token:
    return _llm_override.set(override)


def reset_llm_override(token: contextvars.Token) -> None:
    try:
        _llm_override.reset(token)
    except ValueError:
        # Streaming responses may resume the generator in a different worker thread.
        _llm_override.set(None)


def clear_llm_degradation() -> None:
    _llm_degradation.set(None)


def get_llm_degradation() -> dict[str, str] | None:
    return _llm_degradation.get()


def _record_llm_degradation(exc: Exception | str) -> None:
    _llm_degradation.set(classify_llm_error(exc))


def _resolve_override(override: LlmOverride | None | object = ...) -> LlmOverride | None:
    if override is not ...:
        return override  # type: ignore[return-value]
    return get_llm_override()


def resolve_active_platform_provider(
    *,
    provider: str | None = None,
    model: str | None = None,
    override: LlmOverride | None | object = ...,
) -> str | None:
    if _resolve_override(override):
        return None
    explicit = (provider or get_platform_provider() or "").strip().lower()
    if explicit and is_provider_configured(explicit):
        return explicit
    inferred = infer_provider_from_model(model)
    if inferred and is_provider_configured(inferred):
        return inferred
    default_provider, _ = resolve_default_platform(catalogs=[])
    if default_provider and is_provider_configured(default_provider):
        return default_provider
    configured = configured_providers()
    return configured[0] if configured else None


def llm_api_key(
    *,
    provider: str | None = None,
    model: str | None = None,
    override: LlmOverride | None | object = ...,
) -> str:
    resolved = _resolve_override(override)
    if resolved:
        return resolved.api_key.strip()
    active = resolve_active_platform_provider(provider=provider, model=model, override=override)
    if active:
        return provider_api_key(active)
    # Legacy fallback: any configured key
    for candidate in configured_providers():
        key = provider_api_key(candidate)
        if key:
            return key
    return ""


def is_llm_configured(*, override: LlmOverride | None | object = ...) -> bool:
    if _resolve_override(override):
        return bool(llm_api_key(override=override))
    return bool(configured_providers())


def is_openrouter(
    *,
    provider: str | None = None,
    model: str | None = None,
    override: LlmOverride | None | object = ...,
) -> bool:
    if _resolve_override(override):
        return False
    active = resolve_active_platform_provider(provider=provider, model=model, override=override)
    return active == "openrouter"


def resolve_model(
    model: str | None,
    *,
    provider: str | None = None,
    override: LlmOverride | None | object = ...,
) -> str:
    if model:
        return model
    resolved = _resolve_override(override)
    if resolved:
        return default_model(resolved.provider)
    active = resolve_active_platform_provider(provider=provider, override=override)
    default_provider, default_model_id = resolve_default_platform(catalogs=[])
    if active and default_provider == active and default_model_id:
        return default_model_id
    if active:
        from app.services.llm_providers import provider_default_model

        env_default = provider_default_model(active)
        if env_default:
            return env_default
    if default_model_id:
        return default_model_id
    return ""


def resolve_image_understanding_model() -> str:
    configured = (settings.image_understanding_model or "").strip()
    if configured:
        return configured
    if is_provider_configured("openrouter"):
        return "openai/gpt-4o-mini"
    if is_provider_configured("openai"):
        return "gpt-4o-mini"
    if is_provider_configured("gemini"):
        from app.services.llm_providers import provider_default_model

        return provider_default_model("gemini") or "gemini-2.5-flash"
    return "gpt-4o-mini"


def resolve_thread_title_model() -> str:
    """Cheap model for one-shot thread title refinement."""
    configured = (settings.thread_title_model or "").strip()
    if configured:
        return configured
    if is_provider_configured("openrouter"):
        return "openai/gpt-4o-mini"
    if is_provider_configured("openai"):
        return "gpt-4o-mini"
    if is_provider_configured("gemini"):
        from app.services.llm_providers import provider_default_model

        # Prefer the configured Gemini default; avoid hardcoding retired/invalid ids
        # (e.g. gemini-3.6-flash) that 404 and silently skip title refine.
        return provider_default_model("gemini") or "gemini-2.5-flash"
    if is_provider_configured("anthropic"):
        return "claude-3-5-haiku-latest"
    return "gpt-4o-mini"


_DEFAULT_VISION_PREFIXES = (
    "gpt-4o",
    "gpt-4.1",
    "openai/gpt-4o",
    "openai/gpt-4.1",
    "claude-3",
    "gemini",
    "google/gemini",
    "llava",
    "qwen-vl",
    "pixtral",
)


def model_supports_vision(model: str | None) -> bool:
    if not model:
        return False
    lowered = model.lower()
    configured = [
        prefix.strip().lower()
        for prefix in settings.vision_model_prefixes.split(",")
        if prefix.strip()
    ]
    prefixes = configured or list(_DEFAULT_VISION_PREFIXES)
    return any(lowered.startswith(prefix) or prefix in lowered for prefix in prefixes)


def _build_user_message_content(
    user: str, image_urls: list[str] | None
) -> str | list[dict[str, Any]]:
    if not image_urls:
        return user
    parts: list[dict[str, Any]] = [{"type": "text", "text": user}]
    for url in image_urls:
        if url:
            parts.append({"type": "image_url", "image_url": {"url": url}})
    return parts


def _fetch_image_as_data_uri(url: str, *, timeout: float = 30.0) -> str | None:
    """Download an image URL for providers that require inline base64 (Gemini OpenAI shim)."""
    cleaned = (url or "").strip()
    if not cleaned:
        return None
    if cleaned.startswith("data:"):
        return cleaned
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.get(cleaned)
            response.raise_for_status()
            payload = response.content
            if len(payload) > _MAX_VISION_IMAGE_BYTES:
                logger.warning("vision_image_too_large url=%s bytes=%s", cleaned, len(payload))
                return None
            content_type = (response.headers.get("content-type") or "").split(";")[0].strip()
            if not content_type.startswith("image/"):
                guessed = mimetypes.guess_type(cleaned)[0]
                content_type = guessed or "image/jpeg"
            encoded = base64.b64encode(payload).decode("ascii")
            return f"data:{content_type};base64,{encoded}"
    except Exception:
        logger.warning("vision_image_fetch_failed url=%s", cleaned, exc_info=True)
        return None


def _normalize_gemini_vision_content(
    content: str | list[dict[str, Any]],
) -> str | list[dict[str, Any]]:
    if not isinstance(content, list):
        return content
    normalized: list[dict[str, Any]] = []
    for part in content:
        if part.get("type") != "image_url":
            normalized.append(part)
            continue
        image_url = part.get("image_url")
        raw_url = image_url.get("url") if isinstance(image_url, dict) else None
        if not raw_url:
            continue
        data_uri = _fetch_image_as_data_uri(str(raw_url))
        if data_uri:
            normalized.append({"type": "image_url", "image_url": {"url": data_uri}})
    return normalized


def _prepare_user_message_content(
    user: str,
    image_urls: list[str] | None,
    *,
    provider: str | None = None,
    model: str | None = None,
    override: LlmOverride | None | object = ...,
) -> str | list[dict[str, Any]]:
    content = _build_user_message_content(user, image_urls)
    active = resolve_active_platform_provider(provider=provider, model=model, override=override)
    if active == "gemini" and image_urls:
        return _normalize_gemini_vision_content(content)
    return content


def get_llm_override() -> LlmOverride | None:
    return _llm_override.get()


def _openrouter_provider_ignore_list() -> list[str]:
    return [slug.strip() for slug in settings.openrouter_provider_ignore.split(",") if slug.strip()]


def _openrouter_request_extras() -> tuple[dict[str, Any], dict[str, str]]:
    extra_body: dict[str, Any] = {}
    ignore_list = _openrouter_provider_ignore_list()
    if ignore_list:
        extra_body["provider"] = {"ignore": ignore_list}
    service_tier = settings.openrouter_service_tier.strip()
    if service_tier:
        extra_body["service_tier"] = service_tier

    extra_headers: dict[str, str] = {}
    if settings.openrouter_cache_enabled:
        extra_headers["X-OpenRouter-Cache"] = "true"
    return extra_body, extra_headers


def _platform_completion_kwargs(
    *,
    provider: str | None = None,
    model: str | None = None,
    override: LlmOverride | None | object = ...,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {}
    if is_openrouter(provider=provider, model=model, override=override):
        extra_body, extra_headers = _openrouter_request_extras()
        if extra_body:
            kwargs["extra_body"] = extra_body
        if extra_headers:
            kwargs["extra_headers"] = extra_headers
    return kwargs


_openai_client_cache: dict[str, Any] = {}
_openai_client_lock = threading.Lock()

# Default timeout for all LLM calls.
# httpx.Timeout requires all four params or a default — we set them explicitly.
_LLM_TIMEOUT = {"connect": 10.0, "read": 120.0, "write": 30.0, "pool": 10.0}


def _platform_client(
    *,
    provider: str | None = None,
    model: str | None = None,
    override: LlmOverride | None | object = ...,
):
    active = resolve_active_platform_provider(provider=provider, model=model, override=override)
    if not active:
        return None
    route = resolve_platform_route(active)
    if route is None or route.client_kind != "openai_sdk":
        return None
    try:
        from openai import OpenAI
        import httpx
    except ImportError:
        return None

    base_url = route.base_url or OPENAI_BASE_URL
    cache_key = f"{base_url}:{route.api_key}"
    with _openai_client_lock:
        if cache_key not in _openai_client_cache:
            kwargs: dict[str, Any] = {
                "api_key": route.api_key,
                "max_retries": 2,
                "timeout": httpx.Timeout(**_LLM_TIMEOUT),
                "base_url": base_url,
            }
            _openai_client_cache[cache_key] = OpenAI(**kwargs)
        return _openai_client_cache[cache_key]


def _run_with_adapter(
    fn_name: str,
    system: str,
    user: str,
    *,
    model: str | None = None,
    override: LlmOverride | None | object = ...,
):
    resolved = _resolve_override(override)
    if resolved is None:
        return None
    adapter = get_adapter(resolved.provider, resolved.api_key)
    try:
        if fn_name == "complete":
            return adapter.complete(system, user, model=model)
        if fn_name == "stream":
            return adapter.stream(system, user, model=model)
    except ProviderRateLimitError as exc:
        raise LlmRateLimitError(str(exc)) from exc
    except ProviderAuthError as exc:
        raise LlmAuthError(str(exc)) from exc
    except ProviderError as exc:
        raise LlmCallError(str(exc)) from exc
    return None


def _run_platform_anthropic(
    fn_name: str,
    system: str,
    user: str,
    *,
    model: str | None = None,
    provider: str | None = None,
):
    active = resolve_active_platform_provider(provider=provider, model=model)
    if active != "anthropic":
        return None
    route = resolve_platform_route("anthropic")
    if route is None:
        return None
    adapter = get_adapter("anthropic", route.api_key)
    try:
        if fn_name == "complete":
            return adapter.complete(system, user, model=model)
        if fn_name == "stream":
            return adapter.stream(system, user, model=model)
    except ProviderRateLimitError as exc:
        raise LlmRateLimitError(str(exc)) from exc
    except ProviderAuthError as exc:
        raise LlmAuthError(str(exc)) from exc
    except ProviderError as exc:
        raise LlmCallError(str(exc)) from exc
    return None


def _vision_images_in_content(content: str | list[dict[str, Any]]) -> int:
    if not isinstance(content, list):
        return 0
    return sum(1 for part in content if part.get("type") == "image_url")


def _maybe_compress_user_prompt(user: str, *, model: str | None) -> str:
    """Compress material fences in user prompts when Headroom is enabled."""
    from app.services.headroom_compression import compress_user_material_blocks

    return compress_user_material_blocks(user, model=model)


def llm_json(
    system: str,
    user: str,
    *,
    model: str | None = None,
    provider: str | None = None,
    override: LlmOverride | None | object = ...,
    read_timeout_seconds: float | None = None,
    image_urls: list[str] | None = None,
) -> dict[str, Any] | None:
    if _openrouter_in_cooldown(override=override):
        _record_llm_degradation(_rate_limit_message(provider="openrouter"))
        return None

    user = _maybe_compress_user_prompt(user, model=model)

    if image_urls and _resolve_override(override):
        # Platform OpenAI-compatible client supports vision parts; BYOK adapters do not.
        override = None

    if _resolve_override(override):
        try:
            content = _run_with_adapter("complete", system, user, model=model, override=override)
            if not content:
                _record_llm_degradation("AI provider returned an empty response.")
                return None
            return json.loads(content)
        except (LlmCallError, json.JSONDecodeError) as exc:
            _record_llm_degradation(exc)
            return None

    active = resolve_active_platform_provider(provider=provider, model=model, override=override)
    if active == "anthropic":
        try:
            content = _run_platform_anthropic(
                "complete", system, user, model=model, provider=provider
            )
            if not content:
                _record_llm_degradation("AI provider returned an empty response.")
                return None
            return json.loads(content)
        except (LlmCallError, json.JSONDecodeError) as exc:
            _record_llm_degradation(exc)
            return None

    client = _platform_client(provider=provider, model=model, override=override)
    if client is None:
        _record_llm_degradation("AI provider is not configured for this model.")
        return None
    try:
        request_timeout = (
            read_timeout_seconds if read_timeout_seconds is not None else _LLM_TIMEOUT["read"]
        )
        user_content = _prepare_user_message_content(
            user, image_urls, provider=provider, model=model, override=override
        )
        if image_urls and _vision_images_in_content(user_content) == 0:
            _record_llm_degradation(
                "Attached images could not be loaded for vision. Try re-uploading the file."
            )
            return None
        completion = client.chat.completions.create(
            model=resolve_model(model, provider=provider, override=override),
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
            temperature=0.4,
            timeout=request_timeout,
            **_platform_completion_kwargs(provider=provider, model=model, override=override),
        )
        content = completion.choices[0].message.content or ""
        return json.loads(content)
    except Exception as exc:
        mapped = _map_platform_error(exc, provider=active)
        if isinstance(mapped, LlmRateLimitError):
            if active == "openrouter":
                _mark_openrouter_rate_limited(exc)
            _record_llm_degradation(mapped)
            return None
        _record_llm_degradation(mapped or exc)
        return None


def llm_text(
    system: str,
    user: str,
    *,
    model: str | None = None,
    provider: str | None = None,
    override: LlmOverride | None | object = ...,
    image_urls: list[str] | None = None,
) -> str | None:
    if _openrouter_in_cooldown(override=override):
        raise LlmRateLimitError(_rate_limit_message(provider="openrouter"))

    user = _maybe_compress_user_prompt(user, model=model)

    if image_urls and _resolve_override(override):
        image_urls = None

    if _resolve_override(override):
        try:
            content = _run_with_adapter("complete", system, user, model=model, override=override)
            return (content or "").strip() or None
        except LlmCallError:
            raise

    active = resolve_active_platform_provider(provider=provider, model=model, override=override)
    if active == "anthropic":
        content = _run_platform_anthropic(
            "complete", system, user, model=model, provider=provider
        )
        return (content or "").strip() or None

    client = _platform_client(provider=provider, model=model, override=override)
    if client is None:
        return None
    try:
        completion = client.chat.completions.create(
            model=resolve_model(model, provider=provider, override=override),
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": _prepare_user_message_content(
                    user, image_urls, provider=provider, model=model, override=override
                )},
            ],
            temperature=0.5,
            **_platform_completion_kwargs(provider=provider, model=model, override=override),
        )
        return (completion.choices[0].message.content or "").strip() or None
    except Exception as exc:
        mapped = _map_platform_error(exc, provider=active)
        if mapped is not None:
            if isinstance(mapped, LlmRateLimitError) and active == "openrouter":
                _mark_openrouter_rate_limited(exc)
            raise mapped
        raise LlmCallError(str(exc) or "The AI provider returned an unexpected error.") from exc


def _yield_content_chunks(stream: Any):
    """Normalize provider string deltas into typed stream chunks."""
    for delta in stream:
        if isinstance(delta, StreamChunk):
            yield delta
        elif delta:
            yield StreamChunk(kind="content", text=str(delta))


def llm_text_stream(
    system: str,
    user: str,
    *,
    model: str | None = None,
    provider: str | None = None,
    override: LlmOverride | None | object = ...,
    image_urls: list[str] | None = None,
):
    if _openrouter_in_cooldown(override=override):
        raise LlmRateLimitError(_rate_limit_message(provider="openrouter"))

    user = _maybe_compress_user_prompt(user, model=model)

    if image_urls and _resolve_override(override):
        image_urls = None

    if _resolve_override(override):
        try:
            stream = _run_with_adapter("stream", system, user, model=model, override=override)
            if stream is None:
                return
            yield from _yield_content_chunks(stream)
            return
        except LlmCallError:
            raise

    active = resolve_active_platform_provider(provider=provider, model=model, override=override)
    if active == "anthropic":
        stream = _run_platform_anthropic("stream", system, user, model=model, provider=provider)
        if stream is None:
            return
        yield from _yield_content_chunks(stream)
        return

    client = _platform_client(provider=provider, model=model, override=override)
    if client is None:
        return
    try:
        stream = client.chat.completions.create(
            model=resolve_model(model, provider=provider, override=override),
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": _prepare_user_message_content(
                    user, image_urls, provider=provider, model=model, override=override
                )},
            ],
            temperature=0.5,
            stream=True,
            **_platform_completion_kwargs(provider=provider, model=model, override=override),
        )
        yield from iter_openai_compatible_chunks(stream)
    except Exception as exc:
        mapped = _map_platform_error(exc, provider=active)
        if mapped is not None:
            if isinstance(mapped, LlmRateLimitError) and active == "openrouter":
                _mark_openrouter_rate_limited(exc)
            raise mapped
        raise LlmCallError(str(exc) or "The AI provider returned an unexpected error.") from exc


def _tool_call_thought_signature(call: Mapping[str, Any] | None) -> str | None:
    if not isinstance(call, Mapping):
        return None
    extra = call.get("extra_content")
    if not isinstance(extra, Mapping):
        return None
    google = extra.get("google")
    if not isinstance(google, Mapping):
        return None
    signature = google.get("thought_signature")
    return str(signature) if signature else None


def _ensure_thought_signatures(
    tool_calls: list[dict[str, Any]] | None,
    *,
    provider: str | None,
) -> list[dict[str, Any]] | None:
    """Gemini requires thought_signature on function calls echoed in the tool loop.

    Prefer the real signature from the provider response. If Gemini omitted it (or the
    OpenAI-compatible layer dropped it), inject the documented skip token so the loop
    does not hard-fail with HTTP 400.
    """
    if not tool_calls:
        return tool_calls
    if (provider or "").strip().lower() != "gemini":
        return tool_calls

    ensured: list[dict[str, Any]] = []
    for call in tool_calls:
        entry = dict(call)
        if not _tool_call_thought_signature(entry):
            entry["extra_content"] = {
                "google": {"thought_signature": "skip_thought_signature_validator"}
            }
            logger.info(
                "Injected Gemini thought_signature skip token for tool call %s",
                (entry.get("function") or {}).get("name"),
            )
        ensured.append(entry)
    return ensured


def _merge_tool_call_extras_from_raw(
    serialized: list[dict[str, Any]] | None,
    raw_payload: Mapping[str, Any] | None,
) -> list[dict[str, Any]] | None:
    """Copy extra_content from the raw JSON body when the SDK object omitted it."""
    if not serialized or not isinstance(raw_payload, Mapping):
        return serialized
    try:
        choices = raw_payload.get("choices") or []
        message = (choices[0] or {}).get("message") if choices else None
        raw_calls = (message or {}).get("tool_calls") or []
    except Exception:
        return serialized
    if not isinstance(raw_calls, list):
        return serialized

    merged: list[dict[str, Any]] = []
    for index, call in enumerate(serialized):
        entry = dict(call)
        if index < len(raw_calls) and isinstance(raw_calls[index], dict):
            raw_extra = raw_calls[index].get("extra_content")
            if isinstance(raw_extra, dict) and raw_extra and "extra_content" not in entry:
                entry["extra_content"] = raw_extra
            elif isinstance(raw_extra, dict) and raw_extra and not _tool_call_thought_signature(entry):
                entry["extra_content"] = raw_extra
        merged.append(entry)
    return merged


def _serialize_tool_calls_for_provider(message: Any) -> list[dict[str, Any]] | None:
    """Serialize assistant tool_calls, preserving provider extras (e.g. Gemini thought signatures).

    Gemini OpenAI-compatible tool loops require
    ``tool_calls[].extra_content.google.thought_signature`` to be echoed back on the
    next turn. Stripping that field causes HTTP 400 INVALID_ARGUMENT.
    """
    tool_calls = getattr(message, "tool_calls", None)
    if not tool_calls:
        return None

    dumped_calls: list[Any] = []
    try:
        dumped = message.model_dump(mode="python", exclude_none=False)
        dumped_calls = list(dumped.get("tool_calls") or [])
    except Exception:
        logger.debug("Unable to model_dump assistant tool_calls; using attribute fallback", exc_info=True)

    serialized: list[dict[str, Any]] = []
    for index, call in enumerate(tool_calls):
        raw = dumped_calls[index] if index < len(dumped_calls) and isinstance(dumped_calls[index], dict) else {}
        function = getattr(call, "function", None)
        entry: dict[str, Any] = {
            "id": getattr(call, "id", None) or raw.get("id"),
            "type": getattr(call, "type", None) or raw.get("type") or "function",
            "function": {
                "name": getattr(function, "name", None) if function is not None else (raw.get("function") or {}).get("name"),
                "arguments": (
                    getattr(function, "arguments", None)
                    if function is not None
                    else (raw.get("function") or {}).get("arguments")
                ),
            },
        }
        extra_content = raw.get("extra_content")
        if extra_content is None:
            extra_content = getattr(call, "extra_content", None)
        if extra_content is None:
            model_extra = getattr(call, "__pydantic_extra__", None) or {}
            if isinstance(model_extra, dict):
                extra_content = model_extra.get("extra_content")
        if isinstance(extra_content, dict) and extra_content:
            entry["extra_content"] = extra_content
        serialized.append(entry)
    return serialized


def _format_llm_api_error(exc: Exception) -> str:
    try:
        from openai import APIStatusError
    except ImportError:
        return str(exc) or "The AI provider returned an unexpected error."

    if isinstance(exc, APIStatusError):
        detail = ""
        try:
            body = exc.response.json() if exc.response is not None else None
            detail = json.dumps(body, default=str) if body is not None else (exc.response.text if exc.response else "")
        except Exception:
            detail = str(exc)
        logger.error("LLM APIStatusError status=%s body=%s", getattr(exc, "status_code", "?"), detail[:4000])
        # Prefer a short readable message for the chat UI.
        if "thought_signature" in detail:
            return (
                "The AI provider rejected the tool call (missing thought signature). "
                "Please try again."
            )
        message = getattr(exc, "message", None) or str(exc)
        return message or f"AI provider error ({exc.status_code})."
    return str(exc) or "The AI provider returned an unexpected error."


def llm_chat_with_tools(
    messages: list[dict[str, Any]],
    *,
    tools: list[dict[str, Any]] | None = None,
    model: str | None = None,
    provider: str | None = None,
    override: LlmOverride | None | object = ...,
) -> dict[str, Any] | None:
    """Run a single chat completion with optional OpenAI-style tools."""
    if _openrouter_in_cooldown(override=override):
        raise LlmRateLimitError(_rate_limit_message(provider="openrouter"))

    sanitized_tools = None
    if tools:
        sanitized_tools = []
        for tool in tools:
            fn = dict(tool.get("function") or {})
            fn.pop("_mcp", None)
            sanitized_tools.append({"type": "function", "function": fn})

    active = resolve_active_platform_provider(provider=provider, model=model, override=override)
    if active == "anthropic":
        raise LlmCallError("Tool calling is not supported for the Anthropic platform path yet.")

    client = _platform_client(provider=provider, model=model, override=override)
    if client is None:
        return None
    try:
        # Prefer raw response so Gemini thought_signature extras are not lost.
        raw_response = client.chat.completions.with_raw_response.create(
            model=resolve_model(model, provider=provider, override=override),
            messages=messages,
            tools=sanitized_tools,
            tool_choice="auto" if sanitized_tools else None,
            temperature=0.5,
            **_platform_completion_kwargs(provider=provider, model=model, override=override),
        )
        completion = raw_response.parse()
        raw_payload: dict[str, Any] | None = None
        try:
            raw_payload = json.loads(raw_response.content)
        except Exception:
            try:
                raw_payload = json.loads(raw_response.http_response.text)
            except Exception:
                raw_payload = None

        message = completion.choices[0].message
        tool_calls = _serialize_tool_calls_for_provider(message)
        tool_calls = _merge_tool_call_extras_from_raw(tool_calls, raw_payload)
        tool_calls = _ensure_thought_signatures(tool_calls, provider=active)
        return {
            "content": message.content,
            "tool_calls": tool_calls,
        }
    except Exception as exc:
        mapped = _map_platform_error(exc, provider=active)
        if mapped is not None:
            if isinstance(mapped, LlmRateLimitError) and active == "openrouter":
                _mark_openrouter_rate_limited(exc)
            raise mapped
        raise LlmCallError(_format_llm_api_error(exc)) from exc
