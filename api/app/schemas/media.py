"""Pydantic schemas for multi-provider media storage and upload."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MediaUploadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    file_type: str
    file_size: int
    media_url: str
    thumbnail_url: str | None = None
    parsing_method: str | None = None
    chunk_count: int = 0

    @property
    def content_type(self) -> str:
        return self.file_type

    @property
    def url(self) -> str:
        return self.media_url


class MediaAttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    message_id: UUID | None = None
    user_id: UUID
    storage_provider: str
    storage_key: str
    media_url: str
    filename: str
    file_type: str
    file_size: int
    parsed_content: str | None = None
    chunk_count: int = 0
    parsing_method: str | None = None
    created_at: datetime


class StorageCapabilitiesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    supports_transformations: bool
    supports_signed_urls: bool
    supports_streaming: bool
    provider_name: str
