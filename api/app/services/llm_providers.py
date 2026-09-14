"""Platform LLM provider registry: hardcoded public base URLs + live model discovery."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Literal

from app.core.config import settings

PlatformProviderId = Literal["openai", "gemini", "anthropic", "openrouter"]

OPENAI_BASE_URL = "https://api.openai.com/v1"
GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models"
ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"

PROVIDER_LABELS: dict[str, str] = {
    "openai": "OpenAI",
    "gemini": "Gemini",
    "anthropic": "Anthropic",
    "openrouter": "OpenRouter",
}

_OPENAI_NON_CHAT_MARKERS = (
    "embedding",
    "whisper",
    "tts",
    "dall-e",
    "davinci",
    "babbage",
    "moderation",
    "realtime",
    "transcribe",
    "sora",
    "codex-mini",
    "computer-use",
)


@dataclass(frozen=True)
class PlatformRoute:
    provider: str
    api_key: str
    base_url: str | None
    client_kind: Literal["openai_sdk", "anthropic_adapter"]


def _strip(value: str | None) -> str:
    return (value or "").strip()


def provider_api_key(provider: str) -> str:
    if provider == "openai":
        return _strip(settings.openai_api_key)
    if provider == "gemini":
        return _strip(settings.gemini_api_key)
    if provider == "anthropic":
        return _strip(settings.anthropic_api_key)
    if provider == "openrouter":
        return _strip(settings.openrouter_api_key)
    return ""


def provider_default_model(provider: str) -> str:
    if provider == "openai":
        return _strip(settings.openai_default_model)
    if provider == "gemini":
        return _strip(settings.gemini_default_model)
    if provider == "anthropic":
        return _strip(settings.anthropic_default_model)
    if provider == "openrouter":
        return _strip(settings.openrouter_default_model) or _strip(
            settings.default_openrouter_model
        )
    return ""


def is_provider_configured(provider: str) -> bool:
    return bool(provider_api_key(provider))


def configured_providers() -> list[str]:
    return [
        provider
        for provider in ("openai", "gemini", "anthropic", "openrouter")
        if is_provider_configured(provider)
    ]


def resolve_platform_route(provider: str) -> PlatformRoute | None:
    key = provider_api_key(provider)
    if not key:
        return None
    if provider == "openai":
        return PlatformRoute(
            provider=provider,
            api_key=key,
            base_url=OPENAI_BASE_URL,
            client_kind="openai_sdk",
        )
    if provider == "gemini":
        return PlatformRoute(
            provider=provider,
            api_key=key,
            base_url=GEMINI_OPENAI_BASE_URL,
            client_kind="openai_sdk",
        )
    if provider == "openrouter":
        return PlatformRoute(
            provider=provider,
            api_key=key,
            base_url=OPENROUTER_BASE_URL,
            client_kind="openai_sdk",
        )
    if provider == "anthropic":
        return PlatformRoute(
            provider=provider,
            api_key=key,
            base_url=None,
            client_kind="anthropic_adapter",
        )
    return None


def _priority_providers() -> list[str]:
    preferred = _strip(settings.default_platform_provider).lower()
    raw_priority = _strip(settings.platform_provider_priority)
    ordered: list[str] = []
    if preferred:
        ordered.append(preferred)
    if raw_priority:
        for part in raw_priority.split(","):
            slug = part.strip().lower()
            if slug and slug not in ordered:
                ordered.append(slug)
    for provider in configured_providers():
        if provider not in ordered:
            ordered.append(provider)
    return [p for p in ordered if is_provider_configured(p)]


def infer_provider_from_model(model_id: str | None) -> str | None:
    """Best-effort provider from a model id when thread provider is unset."""
    if not model_id:
        return None
    lowered = model_id.strip().lower()
    if not lowered:
        return None
    # OpenRouter catalog ids are typically vendor/model (and often :free).
    if "/" in lowered or ":free" in lowered or lowered.endswith(":nitro"):
        return "openrouter" if is_provider_configured("openrouter") else None
    if lowered.startswith("gemini") or lowered.startswith("models/gemini"):
        return "gemini" if is_provider_configured("gemini") else None
    if lowered.startswith("claude"):
        return "anthropic" if is_provider_configured("anthropic") else None
    if (
        lowered.startswith("gpt-")
        or lowered.startswith("o1")
        or lowered.startswith("o3")
        or lowered.startswith("o4")
        or lowered.startswith("chatgpt")
    ):
        return "openai" if is_provider_configured("openai") else None
    return None


def _http_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 20.0,
) -> dict[str, Any] | list[Any] | None:
    request = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError, ValueError):
        return None


def _is_openrouter_free(pricing: dict[str, Any]) -> bool:
    try:
        prompt = float(pricing.get("prompt") or 0)
        completion = float(pricing.get("completion") or 0)
        return prompt == 0 and completion == 0
    except (TypeError, ValueError):
        return False


def _openai_is_chat_model(model_id: str) -> bool:
    lowered = model_id.lower()
    if any(marker in lowered for marker in _OPENAI_NON_CHAT_MARKERS):
        return False
    return True


def _openrouter_item_supports_vision(item: dict[str, Any], model_id: str) -> bool:
    architecture = item.get("architecture")
    if isinstance(architecture, dict):
        modalities = architecture.get("input_modalities")
        if isinstance(modalities, list) and any(
            str(modality).lower() == "image" for modality in modalities
        ):
            return True
        modality = architecture.get("modality")
        if isinstance(modality, str) and "image" in modality.lower():
            return True
    from app.services.llm import model_supports_vision

    return model_supports_vision(model_id)


def _catalog_supports_vision(model_id: str) -> bool:
    from app.services.llm import model_supports_vision

    return model_supports_vision(model_id)


def _catalog_model_entry(
    *,
    model_id: str,
    name: str,
    description: Any = None,
    context_length: Any = None,
    is_free: bool | None = None,
    pricing: dict[str, str] | None = None,
    supports_reasoning: bool | None = None,
    supports_vision: bool | None = None,
) -> dict[str, Any]:
    return {
        "id": model_id,
        "name": name,
        "description": description,
        "context_length": context_length,
        "is_free": is_free,
        "pricing": pricing,
        "supports_reasoning": supports_reasoning,
        "supports_vision": supports_vision,
    }


def list_openai_models(api_key: str) -> list[dict[str, Any]]:
    payload = _http_json(
        f"{OPENAI_BASE_URL}/models",
        headers={"Authorization": f"Bearer {api_key}"},
    )
    if not isinstance(payload, dict):
        return []
    models: list[dict[str, Any]] = []
    for item in payload.get("data") or []:
        if not isinstance(item, dict):
            continue
        model_id = item.get("id")
        if not model_id or not _openai_is_chat_model(str(model_id)):
            continue
        models.append(
            _catalog_model_entry(
                model_id=str(model_id),
                name=str(model_id),
                supports_vision=_catalog_supports_vision(str(model_id)),
            )
        )
    models.sort(key=lambda entry: str(entry["name"]).lower())
    return models


def list_gemini_models(api_key: str) -> list[dict[str, Any]]:
    payload = _http_json(f"{GEMINI_MODELS_URL}?key={urllib.parse.quote(api_key)}")
    if not isinstance(payload, dict):
        return []
    models: list[dict[str, Any]] = []
    for item in payload.get("models") or []:
        if not isinstance(item, dict):
            continue
        methods = item.get("supportedGenerationMethods") or []
        if "generateContent" not in methods:
            continue
        raw_name = str(item.get("name") or "")
        model_id = raw_name.split("/")[-1] if raw_name else ""
        if not model_id:
            continue
        models.append(
            _catalog_model_entry(
                model_id=model_id,
                name=str(item.get("displayName") or model_id),
                description=item.get("description"),
                context_length=item.get("inputTokenLimit"),
                supports_vision=_catalog_supports_vision(model_id),
            )
        )
    models.sort(key=lambda entry: str(entry["name"]).lower())
    return models


def list_anthropic_models(api_key: str) -> list[dict[str, Any]]:
    payload = _http_json(
        ANTHROPIC_MODELS_URL,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )
    if not isinstance(payload, dict):
        return []
    models: list[dict[str, Any]] = []
    for item in payload.get("data") or []:
        if not isinstance(item, dict):
            continue
        model_id = item.get("id")
        if not model_id:
            continue
        models.append(
            _catalog_model_entry(
                model_id=str(model_id),
                name=str(item.get("display_name") or model_id),
                context_length=item.get("max_input_tokens"),
                supports_vision=_catalog_supports_vision(str(model_id)),
            )
        )
    models.sort(key=lambda entry: str(entry["name"]).lower())
    return models


def list_openrouter_models(api_key: str) -> list[dict[str, Any]]:
    payload = _http_json(
        OPENROUTER_MODELS_URL,
        headers={"Authorization": f"Bearer {api_key}"},
    )
    if not isinstance(payload, dict):
        return []
    filter_mode = _strip(settings.openrouter_model_filter).lower() or "all"
    models: list[dict[str, Any]] = []
    for item in payload.get("data") or []:
        if not isinstance(item, dict):
            continue
        model_id = item.get("id")
        if not model_id:
            continue
        pricing_raw = item.get("pricing") if isinstance(item.get("pricing"), dict) else {}
        is_free = _is_openrouter_free(pricing_raw)
        if filter_mode == "free" and not is_free:
            continue
        if filter_mode == "paid" and is_free:
            continue
        pricing = {
            "prompt": str(pricing_raw.get("prompt") if pricing_raw.get("prompt") is not None else ""),
            "completion": str(
                pricing_raw.get("completion") if pricing_raw.get("completion") is not None else ""
            ),
        }
        model_id_str = str(model_id)
        models.append(
            _catalog_model_entry(
                model_id=model_id_str,
                name=str(item.get("name") or model_id),
                description=item.get("description"),
                context_length=item.get("context_length"),
                is_free=is_free,
                pricing=pricing,
                supports_vision=_openrouter_item_supports_vision(item, model_id_str),
            )
        )
    models.sort(key=lambda entry: str(entry["name"]).lower())
    return models


def list_models(provider: str) -> list[dict[str, Any]]:
    key = provider_api_key(provider)
    if not key:
        return []
    if provider == "openai":
        return list_openai_models(key)
    if provider == "gemini":
        return list_gemini_models(key)
    if provider == "anthropic":
        return list_anthropic_models(key)
    if provider == "openrouter":
        return list_openrouter_models(key)
    return []


def list_configured_provider_catalogs() -> list[dict[str, Any]]:
    catalogs: list[dict[str, Any]] = []
    for provider in configured_providers():
        catalogs.append(
            {
                "id": provider,
                "name": PROVIDER_LABELS.get(provider, provider.title()),
                "models": list_models(provider),
            }
        )
    return catalogs


def resolve_default_platform(
    catalogs: list[dict[str, Any]] | None = None,
) -> tuple[str | None, str | None]:
    """Return (provider, model) using env defaults + live catalogs. No hardcoded model ids."""
    provider_models: dict[str, list[dict[str, Any]]] = {}
    if catalogs is None:
        for provider in configured_providers():
            provider_models[provider] = list_models(provider)
    else:
        for entry in catalogs:
            provider_models[str(entry["id"])] = list(entry.get("models") or [])

    has_catalog_data = any(bool(models) for models in provider_models.values())

    def pick_for(provider: str) -> str | None:
        models = provider_models.get(provider) or []
        ids = {str(m.get("id")) for m in models if m.get("id")}
        env_default = provider_default_model(provider)
        if env_default and (not ids or env_default in ids):
            return env_default
        if models:
            first = models[0].get("id")
            return str(first) if first else None
        return env_default or None

    # Env model defaults must not let a later provider leapfrog an earlier one
    # when we have no live catalog snapshot (catalogs=[]).
    if not has_catalog_data:
        for provider in _priority_providers():
            return provider, provider_default_model(provider) or None

    for provider in _priority_providers():
        model = pick_for(provider)
        if model:
            return provider, model
    return None, None
