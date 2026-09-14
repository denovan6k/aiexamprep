from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.integration import QuizResponse
from app.schemas.materials import MaterialResponse


ChatRole = Literal["user", "assistant"]
PlatformLlmProvider = Literal["openai", "anthropic", "gemini", "openrouter"]
ByokLlmProvider = Literal["openai", "anthropic"]


class ChatThreadCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    course_id: UUID | None = None
    professor_agent_id: UUID | None = None
    project_id: UUID | None = None


class ChatThreadUpdateRequest(BaseModel):
    professor_agent_id: UUID | None = None
    title: str | None = Field(default=None, max_length=255)
    llm_source: Literal["platform", "byok"] | None = None
    llm_provider: PlatformLlmProvider | None = None
    user_api_key_id: UUID | None = None
    pinned: bool | None = None
    archived: bool | None = None
    project_id: UUID | None = None


class ChatAgentSummary(BaseModel):
    id: UUID
    name: str
    subject_area: str | None = None
    difficulty: str | None = None
    avatar_url: str | None = None


class ChatThreadResponse(BaseModel):
    id: UUID
    title: str
    course_id: UUID | None
    project_id: UUID | None = None
    professor_agent_id: UUID | None
    material_ids: list[UUID]
    llm_source: Literal["platform", "byok"] = "platform"
    llm_provider: PlatformLlmProvider | None = None
    user_api_key_id: UUID | None = None
    pinned: bool = False
    archived: bool = False
    created_at: datetime
    updated_at: datetime


class ChatProjectCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    instructions: str | None = Field(default=None, max_length=20000)
    material_ids: list[UUID] = Field(default_factory=list, max_length=50)


class ChatProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    instructions: str | None = Field(default=None, max_length=20000)
    material_ids: list[UUID] | None = Field(default=None, max_length=50)
    starred: bool | None = None
    archived: bool | None = None


class ChatProjectResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    instructions: str | None = None
    material_ids: list[UUID] = Field(default_factory=list)
    starred: bool = False
    archived: bool = False
    thread_count: int = 0
    created_at: datetime
    updated_at: datetime


BulkThreadAction = Literal[
    "archive",
    "unarchive",
    "delete",
    "pin",
    "unpin",
    "move_to_project",
    "remove_from_project",
]


class ChatThreadsBulkRequest(BaseModel):
    thread_ids: list[UUID] = Field(min_length=1, max_length=100)
    action: BulkThreadAction
    project_id: UUID | None = None


class ChatThreadsBulkResponse(BaseModel):
    updated: int
    failed: int


class ChatMessageResponse(BaseModel):
    id: UUID
    thread_id: UUID
    role: ChatRole
    content: str
    quiz_id: UUID | None = None
    material_id: UUID | None = None
    metadata: dict[str, Any] | None = None
    quiz: QuizResponse | None = None
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime


class QuizGenerationSettings(BaseModel):
    count: int | None = Field(default=None, ge=1, le=50)
    question_types: list[str] | None = None
    timer_minutes: int | None = Field(default=None, ge=1, le=180)
    shuffle_questions: bool | None = None
    shuffle_options: bool | None = None
    options_count: int | None = Field(default=None, ge=2, le=6)
    topic_focus: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=200)


class ChatSendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    professor_agent_id: UUID | None = None
    generation_settings: QuizGenerationSettings | None = None
    model: str | None = Field(default=None, max_length=200)
    llm_provider: PlatformLlmProvider | None = None
    media_attachment_ids: list[UUID] = Field(default_factory=list, max_length=10)
    artifact_type: str | None = Field(default=None, max_length=40)


class ChatSendMessageResponse(BaseModel):
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
    thread_title: str | None = None


class ChatAttachResponse(BaseModel):
    material: MaterialResponse
    assistant_message: ChatMessageResponse


class ChatContextPreviewRequest(BaseModel):
    thread_id: UUID
    query: str | None = Field(default=None, max_length=1000)
    max_tokens: int = Field(default=3200, ge=400, le=12000)


class ChatContextIndicator(BaseModel):
    chunk_id: str
    material_title: str
    source: str
    token_count: int


class ChatContextPreviewResponse(BaseModel):
    prompt_text: str
    indicators: list[ChatContextIndicator]
    token_estimate: int
    truncated: bool
