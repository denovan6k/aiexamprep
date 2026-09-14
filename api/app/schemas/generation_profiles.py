from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

GenerationOutputType = Literal["quiz", "flashcards", "summary"]
ModelTaskType = Literal["chat", "generation", "embedding"]


class GenerationProfileCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    prompt_template: str = Field(min_length=1, max_length=4000)
    apply_on_upload: bool = False
    output_type: GenerationOutputType
    metadata: dict[str, object] | None = None


class GenerationProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    prompt_template: str | None = Field(default=None, min_length=1, max_length=4000)
    apply_on_upload: bool | None = None
    output_type: GenerationOutputType | None = None
    metadata: dict[str, object] | None = None


class GenerationProfileResponse(BaseModel):
    id: UUID
    name: str
    prompt_template: str
    apply_on_upload: bool
    output_type: GenerationOutputType
    metadata: dict[str, object] | None
    created_at: datetime
    updated_at: datetime


class MaterialInsightResponse(BaseModel):
    id: UUID
    material_id: UUID
    generation_profile_id: UUID | None
    insight_type: str
    title: str
    body: str
    metadata: dict[str, object] | None
    created_at: datetime
    updated_at: datetime
