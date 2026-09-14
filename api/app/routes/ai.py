from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.models import User
from app.schemas.ai import (
    AiModelPricing,
    AiModelResponse,
    AiModelsListResponse,
    AiProviderModelsResponse,
)
from app.services.llm import is_llm_configured
from app.services.llm_providers import (
    list_configured_provider_catalogs,
    resolve_default_platform,
)

router = APIRouter()


def _to_model_response(model: dict) -> AiModelResponse:
    pricing = None
    raw_pricing = model.get("pricing")
    if isinstance(raw_pricing, dict):
        pricing = AiModelPricing(
            prompt=raw_pricing.get("prompt"),
            completion=raw_pricing.get("completion"),
        )
    return AiModelResponse(
        id=str(model["id"]),
        name=str(model.get("name") or model["id"]),
        description=model.get("description"),
        context_length=model.get("context_length"),
        is_free=model.get("is_free"),
        pricing=pricing,
        supports_reasoning=model.get("supports_reasoning"),
        supports_vision=model.get("supports_vision"),
    )


@router.get("/models", response_model=AiModelsListResponse)
def get_models(user: User = Depends(get_current_user)) -> AiModelsListResponse:
    del user
    catalogs = list_configured_provider_catalogs()
    default_provider, default_model = resolve_default_platform(catalogs)
    providers = [
        AiProviderModelsResponse(
            id=str(entry["id"]),
            name=str(entry["name"]),
            models=[_to_model_response(model) for model in entry.get("models") or []],
        )
        for entry in catalogs
    ]
    flat_models: list[AiModelResponse] = []
    for provider in providers:
        flat_models.extend(provider.models)
    return AiModelsListResponse(
        configured=is_llm_configured(),
        default_provider=default_provider,
        default_model=default_model,
        providers=providers,
        provider=default_provider,
        models=flat_models,
    )
