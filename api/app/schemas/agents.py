from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


class AgentCreateRequest(BaseModel):
    description: str = Field(min_length=10, max_length=4000)
    name: str | None = Field(default=None, max_length=255)
    subject_area: str | None = Field(default=None, max_length=255)


class AgentUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    subject_area: str | None = None
    difficulty: str | None = None
    marking_strictness: str | None = None
    question_style: dict[str, Any] | None = None
    favorite_topics: list[str] | None = None
    common_traps: list[str] | None = None
    feedback_tone: str | None = None
    rubric_preferences: dict[str, Any] | None = None
    intro_message: str | None = Field(default=None, max_length=4000)
    capabilities_summary: str | None = Field(default=None, max_length=512)
    avatar_url: str | None = Field(default=None, max_length=1024)


class QuestionRatingRequest(BaseModel):
    rating: Literal["up", "down"]


class QuestionRatingResponse(BaseModel):
    id: UUID
    question_id: UUID
    professor_agent_id: UUID | None
    rating: Literal["up", "down"]
    created_at: datetime
    updated_at: datetime


class AgentResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    subject_area: str | None
    difficulty: str | None
    marking_strictness: str | None
    question_style: dict[str, Any] | None
    favorite_topics: list[str] | None
    common_traps: list[str] | None
    feedback_tone: str | None
    rubric_preferences: dict[str, Any] | None
    avatar_url: str | None = None
    intro_message: str | None = None
    capabilities_summary: str | None = None
    mcp_connection_count: int = 0
    created_at: datetime
    updated_at: datetime


class AgentAvatarUploadResponse(BaseModel):
    avatar_url: str


class AgentPublicPreview(BaseModel):
    id: UUID
    name: str
    description: str | None
    subject_area: str | None
    avatar_url: str | None
    intro_message: str | None
    capabilities_summary: str | None
