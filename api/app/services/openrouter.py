"""OpenRouter model discovery (compat wrappers around llm_providers)."""

from __future__ import annotations

from typing import Any

from app.services.llm_providers import is_provider_configured, list_openrouter_models, provider_api_key


def list_free_models() -> list[dict[str, Any]]:
    """Return OpenRouter models with zero pricing. Empty when OpenRouter is not configured."""
    if not is_provider_configured("openrouter"):
        return []
    models = list_openrouter_models(provider_api_key("openrouter"))
    return [model for model in models if model.get("is_free") is True]


def list_models() -> list[dict[str, Any]]:
    """Return OpenRouter models honoring OPENROUTER_MODEL_FILTER."""
    if not is_provider_configured("openrouter"):
        return []
    return list_openrouter_models(provider_api_key("openrouter"))
