from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.integration import TopicScoreResponse


CoreEventName = Literal[
    "onboarding_started",
    "onboarding_completed",
    "course_created",
    "material_uploaded",
    "quiz_started",
    "quiz_submitted",
    "flashcard_reviewed",
    "course_workspace_viewed",
    "course_workspace_tab_changed",
    "study_plan_viewed",
    "study_plan_refreshed",
    "study_plan_item_started",
    "study_plan_item_completed",
    "study_plan_item_dismissed",
    "remediation_created",
]


class ProductEventCreate(BaseModel):
    event_id: str = Field(min_length=1, max_length=128)
    name: CoreEventName
    properties: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime


class ProductEventBatchRequest(BaseModel):
    events: list[ProductEventCreate] = Field(min_length=1, max_length=100)


class ProductEventBatchResponse(BaseModel):
    accepted: int
    duplicates: int


class StudyProfilePatch(BaseModel):
    daily_minutes: int | None = Field(default=None, ge=5, le=480)
    study_goal: str | None = Field(default=None, max_length=255)
    onboarding_completed: bool | None = None


class OnboardingCourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    exam_date: datetime
    confidence_level: Literal["low", "medium", "high"]


class OnboardingChecklist(BaseModel):
    profile: bool
    course: bool
    material: bool
    quiz: bool
    attempt: bool
    complete: bool


class StudyProfileResponse(BaseModel):
    daily_minutes: int
    study_goal: str | None = None
    onboarding_completed_at: datetime | None = None


class OnboardingResponse(BaseModel):
    profile: StudyProfileResponse
    checklist: OnboardingChecklist


class WorkspaceResource(BaseModel):
    id: UUID
    title: str
    status: str | None = None
    count: int | None = None
    updated_at: datetime | None = None


class CourseWorkspaceResponse(BaseModel):
    course_id: UUID
    title: str
    confidence_level: str | None = None
    exam_date: datetime | None = None
    materials: list[WorkspaceResource]
    quizzes: list[WorkspaceResource]
    flashcard_decks: list[WorkspaceResource]
    progress: dict[str, Any]


class StudyPlanItemResponse(BaseModel):
    id: UUID
    course_id: UUID | None = None
    plan_date: str
    item_type: str
    title: str
    topic: str | None = None
    target_id: UUID | None = None
    estimated_minutes: int
    priority: int
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    dismissed_at: datetime | None = None


class TodayStudyPlanResponse(BaseModel):
    date: str
    daily_minutes: int
    generated: bool
    items: list[StudyPlanItemResponse]


class StudyPlanItemPatch(BaseModel):
    action: Literal["start", "complete", "dismiss"]


class StudyPlanItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    estimated_minutes: int = Field(default=15, ge=5, le=180)
    item_type: Literal["custom", "flashcards", "weak_topic", "course_review"] = "custom"
    course_id: UUID | None = None
    topic: str | None = Field(default=None, max_length=255)
    target_id: UUID | None = None


class RemediationRequest(BaseModel):
    action: Literal["deck", "retry", "explain"]
    topics: list[str] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def normalize_topics(self) -> "RemediationRequest":
        self.topics = sorted({topic.strip() for topic in self.topics if topic.strip()})
        return self


class RemediationResponse(BaseModel):
    attempt_id: UUID
    action: Literal["deck", "retry", "explain"]
    topics: list[str]
    status: str
    resource_id: UUID | None = None
    url: str
    context: dict[str, Any] = Field(default_factory=dict)


class RemediationOptionsResponse(BaseModel):
    attempt_id: UUID
    weak_topics: list[str]
    available_actions: list[Literal["deck", "retry", "explain"]]
    existing: list[RemediationResponse] = Field(default_factory=list)


class FeedResourceMeta(BaseModel):
    question_count: int | None = None
    card_count: int | None = None
    status: str | None = None
    score_pct: float | None = None
    file_name: str | None = None
    chunk_count: int | None = None


class FeedResourceItemResponse(BaseModel):
    kind: Literal["quiz", "deck", "material"]
    id: UUID
    title: str
    course_id: UUID | None = None
    course_title: str | None = None
    last_activity_at: datetime
    activity_label: str
    meta: FeedResourceMeta = Field(default_factory=FeedResourceMeta)
    preview: list[str] = Field(default_factory=list)
    href: str


class CourseSummaryResponse(BaseModel):
    id: UUID
    title: str
    exam_date: datetime | None = None


class StudyFeedResponse(BaseModel):
    next_exam: CourseSummaryResponse | None = None
    exam_items: list[FeedResourceItemResponse] = Field(default_factory=list)
    recent_items: list[FeedResourceItemResponse] = Field(default_factory=list)
    weak_topics: list[TopicScoreResponse] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
