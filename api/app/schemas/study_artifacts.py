from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class StudyArtifactResponse(BaseModel):
    id: UUID
    artifact_type: str
    title: str
    content: dict[str, Any]
    schema_version: int
    thread_id: UUID | None = None
    message_id: UUID | None = None
    material_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class StudyArtifactUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    content: dict[str, Any] | None = None
