from __future__ import annotations

from pydantic import BaseModel


class AiModelPricing(BaseModel):
    prompt: str | None = None
    completion: str | None = None


class AiModelResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    context_length: int | None = None
    is_free: bool | None = None
    pricing: AiModelPricing | None = None
    supports_reasoning: bool | None = None
    supports_vision: bool | None = None


class AiProviderModelsResponse(BaseModel):
    id: str
    name: str
    models: list[AiModelResponse]


class AiModelsListResponse(BaseModel):
    configured: bool
    default_provider: str | None = None
    default_model: str | None = None
    providers: list[AiProviderModelsResponse]
    # Legacy flat fields for older clients
    provider: str | None = None
    models: list[AiModelResponse] = []
