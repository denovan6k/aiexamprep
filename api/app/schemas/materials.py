from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

ProcessingStatus = Literal["pending", "uploaded", "processing", "processed", "failed", "parsed", "parse_failed", "chunked", "ready"]


class MaterialResponse(BaseModel):
    id: UUID
    course_id: UUID | None
    institution_id: UUID | None = None
    title: str
    file_name: str
    file_type: str | None
    status: str
    extracted_text_preview: str | None
    chunk_count: int
    created_at: datetime
    source: Literal["material", "chat"] = "material"
    media_attachment_id: UUID | None = None
    thread_id: UUID | None = None
    media_url: str | None = None


class MaterialUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class MaterialReprocessResponse(BaseModel):
    material: MaterialResponse
    message: str


class MaterialStatusResponse(BaseModel):
    id: UUID
    status: ProcessingStatus
    chunk_count: int
    embedded: bool
    error_message: str | None = None
    processing_job_id: UUID | None = None


class MaterialChatSessionCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)


class MaterialChatSessionResponse(BaseModel):
    id: UUID
    material_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class MaterialChatMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    model: str | None = Field(default=None, max_length=200)


class MaterialChatContextIndicator(BaseModel):
    chunk_id: str
    material_title: str
    source: str
    token_count: int


class MaterialChatMessage(BaseModel):
    id: UUID
    session_id: UUID
    material_id: UUID | None = None
    role: Literal["user", "assistant"]
    content: str
    metadata: dict[str, Any] | None = None
    created_at: datetime


class MaterialChatMessageResponse(BaseModel):
    user_message: MaterialChatMessage
    assistant_message: MaterialChatMessage
    context_indicators: list[MaterialChatContextIndicator]
    token_estimate: int
    truncated: bool
