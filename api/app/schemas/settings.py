from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

ApiKeyProvider = Literal["openai", "anthropic"]


class ApiKeyCreateRequest(BaseModel):
    provider: ApiKeyProvider
    api_key: str = Field(min_length=8, max_length=512)
    label: str | None = Field(default=None, max_length=255)


class ApiKeyResponse(BaseModel):
    id: UUID
    provider: ApiKeyProvider
    label: str | None
    key_last4: str
    is_valid: bool
    last_validated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ModelDefaultsRequest(BaseModel):
    default_chat_model: str | None = Field(default=None, max_length=255)
    default_generation_model: str | None = Field(default=None, max_length=255)
    default_embedding_model: str | None = Field(default=None, max_length=255)


class ModelDefaultsResponse(BaseModel):
    default_chat_model: str | None
    default_generation_model: str | None
    default_embedding_model: str | None
