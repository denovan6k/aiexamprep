"""Tests for multi-provider platform LLM registry and routing."""

from __future__ import annotations

from app.services import llm
from app.services import llm_providers as providers


def test_configured_providers_key_gated(monkeypatch) -> None:
    monkeypatch.setattr(providers.settings, "openai_api_key", "")
    monkeypatch.setattr(providers.settings, "gemini_api_key", " gemini-key ")
    monkeypatch.setattr(providers.settings, "anthropic_api_key", "")
    monkeypatch.setattr(providers.settings, "openrouter_api_key", "")

    assert providers.configured_providers() == ["gemini"]
    assert providers.provider_api_key("gemini") == "gemini-key"


def test_resolve_default_prefers_default_platform_provider(monkeypatch) -> None:
    monkeypatch.setattr(providers.settings, "openai_api_key", "sk-openai")
    monkeypatch.setattr(providers.settings, "gemini_api_key", "gemini-key")
    monkeypatch.setattr(providers.settings, "anthropic_api_key", "")
    monkeypatch.setattr(providers.settings, "openrouter_api_key", "")
    monkeypatch.setattr(providers.settings, "default_platform_provider", "openai")
    monkeypatch.setattr(providers.settings, "platform_provider_priority", "gemini,openai")
    monkeypatch.setattr(providers.settings, "openai_default_model", "gpt-4o-mini")
    monkeypatch.setattr(providers.settings, "gemini_default_model", "gemini-2.0-flash")

    catalogs = [
        {
            "id": "openai",
            "name": "OpenAI",
            "models": [{"id": "gpt-4o-mini", "name": "gpt-4o-mini"}],
        },
        {
            "id": "gemini",
            "name": "Gemini",
            "models": [{"id": "gemini-2.0-flash", "name": "gemini-2.0-flash"}],
        },
    ]
    provider, model = providers.resolve_default_platform(catalogs)
    assert provider == "openai"
    assert model == "gpt-4o-mini"


def test_resolve_default_walks_priority_when_preferred_missing(monkeypatch) -> None:
    monkeypatch.setattr(providers.settings, "openai_api_key", "")
    monkeypatch.setattr(providers.settings, "gemini_api_key", "gemini-key")
    monkeypatch.setattr(providers.settings, "anthropic_api_key", "")
    monkeypatch.setattr(providers.settings, "openrouter_api_key", "or-key")
    monkeypatch.setattr(providers.settings, "default_platform_provider", "openai")
    monkeypatch.setattr(providers.settings, "platform_provider_priority", "openai,gemini,openrouter")
    monkeypatch.setattr(providers.settings, "gemini_default_model", "gemini-2.5-flash")
    monkeypatch.setattr(providers.settings, "openrouter_default_model", "google/gemma:free")

    catalogs = [
        {
            "id": "gemini",
            "name": "Gemini",
            "models": [{"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash"}],
        },
        {
            "id": "openrouter",
            "name": "OpenRouter",
            "models": [{"id": "google/gemma:free", "name": "Gemma"}],
        },
    ]
    provider, model = providers.resolve_default_platform(catalogs)
    assert provider == "gemini"
    assert model == "gemini-2.5-flash"


def test_resolve_default_uses_first_live_model_when_env_default_empty(monkeypatch) -> None:
    monkeypatch.setattr(providers.settings, "openai_api_key", "sk-openai")
    monkeypatch.setattr(providers.settings, "gemini_api_key", "")
    monkeypatch.setattr(providers.settings, "anthropic_api_key", "")
    monkeypatch.setattr(providers.settings, "openrouter_api_key", "")
    monkeypatch.setattr(providers.settings, "default_platform_provider", "")
    monkeypatch.setattr(providers.settings, "platform_provider_priority", "")
    monkeypatch.setattr(providers.settings, "openai_default_model", "")

    catalogs = [
        {
            "id": "openai",
            "name": "OpenAI",
            "models": [
                {"id": "gpt-4o", "name": "gpt-4o"},
                {"id": "gpt-4o-mini", "name": "gpt-4o-mini"},
            ],
        }
    ]
    provider, model = providers.resolve_default_platform(catalogs)
    assert provider == "openai"
    assert model == "gpt-4o"


def test_openai_chat_filter_drops_embeddings() -> None:
    assert providers._openai_is_chat_model("gpt-4o-mini") is True
    assert providers._openai_is_chat_model("text-embedding-3-small") is False
    assert providers._openai_is_chat_model("whisper-1") is False


def test_openrouter_filter_free_and_paid(monkeypatch) -> None:
    payload = {
        "data": [
            {
                "id": "free/model",
                "name": "Free",
                "pricing": {"prompt": "0", "completion": "0"},
                "context_length": 8_000,
            },
            {
                "id": "paid/model",
                "name": "Paid",
                "pricing": {"prompt": "0.0001", "completion": "0.0002"},
                "context_length": 8_000,
            },
        ]
    }
    monkeypatch.setattr(providers, "_http_json", lambda *_args, **_kwargs: payload)

    monkeypatch.setattr(providers.settings, "openrouter_model_filter", "all")
    all_models = providers.list_openrouter_models("or-key")
    assert {m["id"] for m in all_models} == {"free/model", "paid/model"}
    assert next(m for m in all_models if m["id"] == "free/model")["is_free"] is True
    assert next(m for m in all_models if m["id"] == "paid/model")["is_free"] is False

    monkeypatch.setattr(providers.settings, "openrouter_model_filter", "free")
    free_models = providers.list_openrouter_models("or-key")
    assert [m["id"] for m in free_models] == ["free/model"]

    monkeypatch.setattr(providers.settings, "openrouter_model_filter", "paid")
    paid_models = providers.list_openrouter_models("or-key")
    assert [m["id"] for m in paid_models] == ["paid/model"]


def test_platform_client_uses_gemini_base_url(monkeypatch) -> None:
    monkeypatch.setattr(providers.settings, "gemini_api_key", "gemini-key")
    monkeypatch.setattr(providers.settings, "openai_api_key", "")
    monkeypatch.setattr(providers.settings, "openrouter_api_key", "")
    monkeypatch.setattr(providers.settings, "anthropic_api_key", "")
    monkeypatch.setattr(llm.settings, "gemini_api_key", "gemini-key")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "")
    monkeypatch.setattr(llm.settings, "anthropic_api_key", "")
    llm._openai_client_cache.clear()

    captured: dict[str, object] = {}

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setitem(
        __import__("sys").modules, "openai", type("openai", (), {"OpenAI": FakeOpenAI})
    )

    token = llm.set_platform_provider("gemini")
    try:
        client = llm._platform_client()
    finally:
        llm.reset_platform_provider(token)

    assert client is not None
    assert captured["api_key"] == "gemini-key"
    assert captured["base_url"] == providers.GEMINI_OPENAI_BASE_URL


def test_resolve_default_empty_catalogs_does_not_prefer_openrouter_env(monkeypatch) -> None:
    monkeypatch.setattr(providers.settings, "openai_api_key", "")
    monkeypatch.setattr(providers.settings, "gemini_api_key", "gemini-key")
    monkeypatch.setattr(providers.settings, "anthropic_api_key", "")
    monkeypatch.setattr(providers.settings, "openrouter_api_key", "or-key")
    monkeypatch.setattr(providers.settings, "default_platform_provider", "")
    monkeypatch.setattr(providers.settings, "platform_provider_priority", "")
    monkeypatch.setattr(providers.settings, "gemini_default_model", "")
    monkeypatch.setattr(providers.settings, "openrouter_default_model", "")
    monkeypatch.setattr(providers.settings, "default_openrouter_model", "google/gemma:free")

    provider, model = providers.resolve_default_platform(catalogs=[])
    assert provider == "gemini"
    assert model is None


def test_infer_provider_from_model(monkeypatch) -> None:
    monkeypatch.setattr(providers.settings, "openai_api_key", "sk")
    monkeypatch.setattr(providers.settings, "gemini_api_key", "g")
    monkeypatch.setattr(providers.settings, "anthropic_api_key", "a")
    monkeypatch.setattr(providers.settings, "openrouter_api_key", "or")

    assert providers.infer_provider_from_model("gemini-2.0-flash") == "gemini"
    assert providers.infer_provider_from_model("google/gemma-4-26b-a4b-it:free") == "openrouter"
    assert providers.infer_provider_from_model("gpt-4o-mini") == "openai"
    assert providers.infer_provider_from_model("claude-3-5-haiku-latest") == "anthropic"

    monkeypatch.setattr(providers.settings, "openai_api_key", "")
    monkeypatch.setattr(providers.settings, "gemini_api_key", "")
    monkeypatch.setattr(providers.settings, "anthropic_api_key", "anth-key")
    monkeypatch.setattr(providers.settings, "openrouter_api_key", "")
    monkeypatch.setattr(llm.settings, "openai_api_key", "")
    monkeypatch.setattr(llm.settings, "gemini_api_key", "")
    monkeypatch.setattr(llm.settings, "anthropic_api_key", "anth-key")
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "")

    assert llm.is_llm_configured() is True
    assert llm.is_openrouter() is False


def test_openrouter_vision_from_input_modalities() -> None:
    item = {
        "architecture": {"input_modalities": ["text", "image"]},
    }
    assert providers._openrouter_item_supports_vision(item, "vendor/vision-model") is True


def test_openrouter_vision_from_modality_string() -> None:
    item = {
        "architecture": {"modality": "text+image->text"},
    }
    assert providers._openrouter_item_supports_vision(item, "vendor/vision-model") is True


def test_openrouter_gemma_free_not_vision() -> None:
    item: dict[str, object] = {}
    assert (
        providers._openrouter_item_supports_vision(
            item, "google/gemma-4-26b-a4b-it:free"
        )
        is False
    )


def test_list_openrouter_models_sets_supports_vision(monkeypatch) -> None:
    payload = {
        "data": [
            {
                "id": "openai/gpt-4o-mini",
                "name": "GPT-4o mini",
                "pricing": {"prompt": "0.0001", "completion": "0.0002"},
                "architecture": {"input_modalities": ["text", "image"]},
            },
            {
                "id": "google/gemma-4-26b-a4b-it:free",
                "name": "Gemma",
                "pricing": {"prompt": "0", "completion": "0"},
            },
        ]
    }
    monkeypatch.setattr(providers, "_http_json", lambda *_args, **_kwargs: payload)
    monkeypatch.setattr(providers.settings, "openrouter_model_filter", "all")

    models = providers.list_openrouter_models("or-key")
    by_id = {m["id"]: m for m in models}
    assert by_id["openai/gpt-4o-mini"]["supports_vision"] is True
    assert by_id["google/gemma-4-26b-a4b-it:free"]["supports_vision"] is False


def test_to_model_response_includes_supports_vision() -> None:
    from app.routes.ai import _to_model_response

    response = _to_model_response(
        {
            "id": "gpt-4o-mini",
            "name": "GPT-4o mini",
            "supports_vision": True,
        }
    )
    assert response.supports_vision is True
