from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class QuestionResponse(BaseModel):
    id: UUID
    type: str
    prompt: str
    options: list[dict[str, Any]] | dict[str, Any] | None = None
    correct_answers: list[Any] | None = None
    explanation: str | None = None
    topic: str | None = None
    difficulty: str | None = None
    source_refs: list[dict[str, Any]] | None = None
    rubric: dict[str, Any] | None = None


class QuizEditorResponse(BaseModel):
    id: UUID
    course_id: UUID | None
    professor_agent_id: UUID | None
    title: str
    config: dict[str, Any] | None
    status: str
    questions: list[QuestionResponse]
    created_at: datetime
    updated_at: datetime


class QuizManualMCQOptionInput(BaseModel):
    id: str = Field(min_length=1, max_length=50)
    text: str


class QuizManualMCQQuestionInput(BaseModel):
    type: str = Field(default="mcq", pattern="^mcq$")
    prompt: str = ""
    options: list[QuizManualMCQOptionInput] = Field(default_factory=list)
    correct_option_id: str = ""
    explanation: str | None = None
    topic: str | None = None
    difficulty: str | None = None


class QuizManualShortAnswerQuestionInput(BaseModel):
    type: str = Field(default="short_answer", pattern="^short_answer$")
    prompt: str = ""
    model_answers: list[str] = Field(default_factory=list)
    explanation: str | None = None
    topic: str | None = None
    difficulty: str | None = None


class QuizManualCreateRequest(BaseModel):
    course_id: UUID | None = None
    title: str = Field(default="Manual quiz", min_length=1, max_length=255)
    # Only one question type per manual quiz (v1). UI enforces the same.
    questions: list[QuizManualMCQQuestionInput | QuizManualShortAnswerQuestionInput]
    # Used for short-answer quizzes only; affects whether submit uses LLM grading vs keyword heuristic.
    short_answer_grading: str = Field(default="provided_answers", max_length=50)
    # Used for mcq quizzes only (and stored to quiz.config for later populate).
    options_count: int | None = Field(default=None, ge=2, le=6)
    # Optional: allow specifying shuffle defaults for how the quiz should start.
    shuffle_questions: bool = False
    shuffle_options: bool = True
    timer_minutes: int | None = Field(default=None, ge=1, le=180)
    # Optional: examiner profile to bias AI populate (populate only; manual authored questions stay unchanged).
    professor_agent_id: UUID | None = None


class QuizManualContentUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: str = Field(default="draft", pattern="^(draft|ready)$")
    short_answer_grading: str | None = Field(default=None, max_length=50)
    options_count: int | None = Field(default=None, ge=2, le=6)
    shuffle_questions: bool | None = None
    shuffle_options: bool | None = None
    timer_minutes: int | None = Field(default=None, ge=1, le=180)
    questions: list[QuizManualMCQQuestionInput | QuizManualShortAnswerQuestionInput] = Field(
        default_factory=list
    )


class QuizPopulateRequest(BaseModel):
    material_ids: list[UUID] = Field(default_factory=list)
    # Optional overrides; if omitted we try to reuse the existing quiz.config settings.
    count: int | None = Field(default=None, ge=1, le=50)
    question_types: list[str] | None = None
    difficulty: str | None = Field(default=None, max_length=50)
    options_count: int | None = Field(default=None, ge=2, le=6)
    topic_focus: str | None = Field(default=None, max_length=500)
    model: str | None = Field(default=None, max_length=200)


class FlashcardManualCardInput(BaseModel):
    front: str
    back: str
    topic: str | None = None
    difficulty: str | None = None


class FlashcardDeckCreateRequest(BaseModel):
    course_id: UUID | None = None
    title: str = Field(default="Manual flashcards", min_length=1, max_length=255)
    cards: list[FlashcardManualCardInput] = Field(default_factory=list)


class FlashcardDeckUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    cards: list[FlashcardManualCardInput] = Field(default_factory=list)


class FlashcardDeckPopulateRequest(BaseModel):
    material_ids: list[UUID] = Field(default_factory=list)
    count: int | None = Field(default=None, ge=1, le=100)
    title: str | None = Field(default=None, max_length=255)


class QuestionPlayResponse(BaseModel):
    id: UUID
    type: str
    prompt: str
    options: list[dict[str, Any]] | dict[str, Any] | None = None
    topic: str | None = None
    difficulty: str | None = None


class QuizGenerateRequest(BaseModel):
    course_id: UUID | None = None
    material_ids: list[UUID] = Field(default_factory=list)
    professor_agent_id: UUID | None = None
    title: str = Field(default="Generated quiz", min_length=1, max_length=255)
    count: int = Field(default=8, ge=1, le=50)
    question_types: list[str] = Field(default_factory=lambda: ["mcq", "short_answer"])
    difficulty: str = Field(default="medium", max_length=50)
    timer_minutes: int | None = Field(default=None, ge=1, le=180)
    shuffle_questions: bool = False
    shuffle_options: bool = True
    options_count: int = Field(default=4, ge=2, le=6)


class QuizUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    timer_minutes: int | None = Field(default=None, ge=1, le=180)
    shuffle_questions: bool | None = None
    shuffle_options: bool | None = None
    options_count: int | None = Field(default=None, ge=2, le=6)
    professor_agent_id: UUID | None = None


class QuizRegenerateRequest(BaseModel):
    count: int | None = Field(default=None, ge=1, le=50)
    question_types: list[str] | None = None
    difficulty: str | None = Field(default=None, max_length=50)
    topic_focus: str | None = Field(default=None, max_length=500)
    options_count: int | None = Field(default=None, ge=2, le=6)
    professor_agent_id: UUID | None = None
    model: str | None = Field(default=None, max_length=200)
    timer_minutes: int | None = Field(default=None, ge=1, le=180)
    shuffle_questions: bool | None = None
    shuffle_options: bool | None = None


class QuizResponse(BaseModel):
    id: UUID
    course_id: UUID | None
    professor_agent_id: UUID | None
    title: str
    config: dict[str, Any] | None
    status: str
    source_attempt_id: UUID | None = None
    source_action: str | None = None
    source_topics: list[str] = Field(default_factory=list)
    questions: list[QuestionPlayResponse]
    created_at: datetime
    updated_at: datetime


class QuizListItemResponse(BaseModel):
    id: UUID
    course_id: UUID | None
    professor_agent_id: UUID | None
    title: str
    config: dict[str, Any] | None
    status: str
    question_count: int
    source_attempt_id: UUID | None = None
    source_action: str | None = None
    source_topics: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class QuizAttemptResponse(BaseModel):
    id: UUID
    quiz_id: UUID
    status: str
    started_at: datetime
    submitted_at: datetime | None = None
    score: Decimal | None = None
    max_score: Decimal | None = None
    timer_seconds: int | None = None
    seconds_remaining: int | None = None
    timer_expired: bool = False
    deadline_at: datetime | None = None


class SaveAnswerRequest(BaseModel):
    answer: dict[str, Any] | list[Any] | str | None = None


class QuizAnswerResponse(BaseModel):
    id: UUID
    attempt_id: UUID
    question_id: UUID
    answer: dict[str, Any] | list[Any] | str | None
    is_correct: bool | None = None
    score: Decimal | None = None
    feedback: str | None = None
    flagged: bool = False


class QuizAnswerProgressResponse(BaseModel):
    id: UUID
    attempt_id: UUID
    question_id: UUID
    answer: dict[str, Any] | list[Any] | str | None
    flagged: bool = False


class FlagAnswerRequest(BaseModel):
    flagged: bool = True


class TopicScoreResponse(BaseModel):
    topic: str
    score_pct: float


class AgentSummaryResponse(BaseModel):
    id: UUID
    name: str
    subject_area: str | None = None
    style_summary: str | None = None


class NextUpFlashcardResponse(BaseModel):
    deck_id: UUID
    card_id: UUID
    topic: str | None = None
    label: str


class QuizSessionContextResponse(BaseModel):
    agent: AgentSummaryResponse | None = None
    average_score: float
    cards_due: int
    next_up: NextUpFlashcardResponse | None = None
    topic_focus: list[TopicScoreResponse]
    agent_insight: str | None = None
    answered_count: int
    flagged_count: int
    correct_count: int
    graded_count: int
    elapsed_seconds: int
    pace_estimate_minutes: int | None = None
    timer_seconds: int | None = None
    seconds_remaining: int | None = None
    timer_expired: bool = False
    deadline_at: datetime | None = None


class QuizAttemptDetailResponse(BaseModel):
    attempt: QuizAttemptResponse
    answers: list[QuizAnswerProgressResponse]


class FlashcardStudyStatsResponse(BaseModel):
    cards_due: int
    total_cards: int
    next_up: NextUpFlashcardResponse | None = None


class FlashcardReviewRequest(BaseModel):
    confidence: str = Field(pattern="^(again|known)$")


class FlashcardReviewResponse(BaseModel):
    flashcard_id: UUID
    confidence: str
    reviewed_at: datetime


class QuizReviewResponse(BaseModel):
    attempt: QuizAttemptResponse
    answers: list[QuizAnswerResponse]
    questions: list[QuestionResponse] = Field(default_factory=list)
    weak_topics: list[str]
    incorrect_question_ids: list[UUID] = Field(default_factory=list)
    remediation_actions: list[str] = Field(default_factory=lambda: ["deck", "retry", "explain"])


class FlashcardGenerateRequest(BaseModel):
    course_id: UUID | None = None
    material_ids: list[UUID] = Field(default_factory=list)
    title: str = Field(default="Generated flashcards", min_length=1, max_length=255)
    count: int = Field(default=12, ge=1, le=100)


class FlashcardResponse(BaseModel):
    id: UUID
    front: str
    back: str
    topic: str | None = None
    difficulty: str | None = None
    source_refs: list[dict[str, Any]] | None = None


class FlashcardDeckResponse(BaseModel):
    id: UUID
    course_id: UUID | None
    title: str
    source_attempt_id: UUID | None = None
    source_action: str | None = None
    source_topics: list[str] = Field(default_factory=list)
    flashcards: list[FlashcardResponse]
    created_at: datetime
    updated_at: datetime


class FlashcardDeckListItemResponse(BaseModel):
    id: UUID
    course_id: UUID | None
    title: str
    card_count: int
    source_attempt_id: UUID | None = None
    source_action: str | None = None
    source_topics: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ProgressOverviewResponse(BaseModel):
    quizzes_taken: int
    average_score: float
    mastered_topics: list[str]
    weak_topics: list[str]
    recommendations: list[str]
    topic_scores: list[TopicScoreResponse] = Field(default_factory=list)


class BlogPostResponse(BaseModel):
    id: str
    title: str
    slug: str
    excerpt: str | None = None
    content: str | None = None
    category: str | None = None
    category_id: UUID | None = None
    author: str | None = None
    author_id: UUID | None = None
    author_slug: str | None = None
    author_bio: str | None = None
    author_avatar_url: str | None = None
    author_social_links: dict[str, str] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    status: str | None = None
    cover_image_url: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    reading_time_minutes: int | None = None
    comment_count: int = 0
    published_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class BlogCommentCreateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    parent_id: UUID | None = None


class BlogCommentUpdateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class BlogCommentResponse(BaseModel):
    id: UUID
    post_id: UUID
    parent_id: UUID | None = None
    body: str
    author_name: str
    author_id: UUID
    author_avatar_url: str | None = None
    score: int = 0
    user_vote: int | None = None
    created_at: datetime
    updated_at: datetime


class BlogAuthorResponse(BaseModel):
    id: UUID
    display_name: str
    slug: str
    bio: str | None = None
    avatar_url: str | None = None
    social_links: dict[str, str] = Field(default_factory=dict)
    post_count: int = 0


class BlogAuthorUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    bio: str | None = Field(default=None, max_length=2000)
    avatar_url: str | None = Field(default=None, max_length=1024)
    social_links: dict[str, str] | None = None


class CommunityGroupCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    visibility: str = Field(default="public", max_length=50)
    course_id: UUID | None = None
    school_name: str | None = Field(default=None, max_length=255)
    school_domain: str | None = Field(default=None, max_length=255)


class CommunityGroupResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None
    visibility: str
    school_name: str | None
    school_domain: str | None = None
    course_id: UUID | None = None
    course_title: str | None = None
    featured: bool = False
    owner_id: UUID | None = None
    owner_name: str | None = None
    member_count: int
    is_member: bool = False
    invitation_pending: bool = False
    membership_role: str | None = None
    created_at: datetime
    updated_at: datetime


class CommunityGroupCourseOption(BaseModel):
    id: UUID
    title: str


class CommunityGroupListResponse(BaseModel):
    items: list[CommunityGroupResponse] = Field(default_factory=list)
    total: int
    page: int
    page_size: int
    courses: list[CommunityGroupCourseOption] = Field(default_factory=list)


class CommunityInviteRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)


class CommunityGroupUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    visibility: str | None = Field(default=None, max_length=50)
    school_name: str | None = Field(default=None, max_length=255)
    school_domain: str | None = Field(default=None, max_length=255)


class CommunityMemberResponse(BaseModel):
    user_id: UUID
    name: str
    role: str
    status: str
    joined_at: datetime


class CommunityThreadCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)


class CommunityThreadResponse(BaseModel):
    id: UUID
    group_id: UUID
    title: str
    body: str
    author_id: UUID | None = None
    author_name: str | None = None
    pinned: bool
    locked: bool
    tags: list[str] = Field(default_factory=list)
    reply_count: int = 0
    upvote_count: int = 0
    downvote_count: int = 0
    score: int = 0
    user_vote: int | None = None
    bookmarked: bool = False
    subscribed: bool = False
    unread: bool = False
    created_at: datetime
    updated_at: datetime


class CommunityThreadUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    body: str | None = Field(default=None, min_length=1)


class CommunityReplyCreateRequest(BaseModel):
    body: str = Field(min_length=1)
    parent_id: UUID | None = None


class CommunityReplyResponse(BaseModel):
    id: UUID
    thread_id: UUID
    parent_id: UUID | None = None
    body: str
    author_id: UUID | None = None
    author_name: str | None = None
    upvote_count: int = 0
    downvote_count: int = 0
    score: int = 0
    user_vote: int | None = None
    created_at: datetime
    updated_at: datetime


class CommunityReplyUpdateRequest(BaseModel):
    body: str = Field(min_length=1)


class CommunitySearchResponse(BaseModel):
    groups: list[CommunityGroupResponse] = Field(default_factory=list)
    threads: list[CommunityThreadResponse] = Field(default_factory=list)


class CommunityFeedItemResponse(CommunityThreadResponse):
    group_slug: str
    group_name: str


class ContentReportCreateRequest(BaseModel):
    target_type: str = Field(min_length=1, max_length=50)
    target_id: UUID
    reason: str = Field(min_length=1, max_length=255)
    details: str | None = None


class ContentReportResponse(BaseModel):
    id: UUID
    target_type: str
    target_id: UUID
    reason: str
    details: str | None
    status: str
    group_id: UUID | None = None
    group_slug: str | None = None
    thread_id: UUID | None = None
    target_title: str | None = None
    target_preview: str | None = None
    created_at: datetime
    reviewed_at: datetime | None = None


class ContentReportResolveRequest(BaseModel):
    status: str = Field(default="resolved", max_length=50)
    notes: str | None = None


class SharedResourceCreateRequest(BaseModel):
    resource_type: str = Field(min_length=1, max_length=50)
    resource_id: UUID
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    visibility: str = Field(default="group", max_length=50)


class SharedResourceResponse(BaseModel):
    id: UUID
    group_id: UUID
    resource_type: str
    resource_id: UUID
    title: str
    description: str | None
    visibility: str
    shared_by_user_id: UUID | None = None
    shared_by_name: str | None = None
    intro_thread_id: UUID | None = None
    created_at: datetime


class SharedAgentPreview(BaseModel):
    id: UUID | None = None
    name: str
    description: str | None = None
    subject_area: str | None = None
    difficulty: str | None = None
    marking_strictness: str | None = None
    feedback_tone: str | None = None
    avatar_url: str | None = None
    intro_message: str | None = None
    capabilities_summary: str | None = None
    favorite_topics: list[str] = Field(default_factory=list)
    common_traps: list[str] = Field(default_factory=list)


class SharedResourceDetailResponse(SharedResourceResponse):
    agent_preview: SharedAgentPreview | None = None
    is_owner: bool = False


class CommunityVoteRequest(BaseModel):
    vote: int = Field(..., ge=-1, le=1)


class CommunityProfileUpdateRequest(BaseModel):
    bio: str | None = Field(default=None, max_length=2000)
    study_interests: list[str] | None = None
    school_domain: str | None = Field(default=None, max_length=255)


class CommunityProfileGroupSummary(BaseModel):
    id: UUID
    name: str
    slug: str


class CommunityProfileThreadSummary(BaseModel):
    id: UUID
    group_id: UUID
    group_slug: str
    title: str
    reply_count: int = 0
    score: int = 0
    created_at: datetime


class CommunityProfileReplySummary(BaseModel):
    id: UUID
    thread_id: UUID
    group_slug: str
    body: str
    score: int = 0
    created_at: datetime


class CommunityProfileResponse(BaseModel):
    user_id: UUID
    name: str
    reputation_score: int = 0
    reputation_tier: str = "newcomer"
    bio: str | None = None
    study_interests: list[str] = Field(default_factory=list)
    school_domain: str | None = None
    joined_groups: list[CommunityProfileGroupSummary] = Field(default_factory=list)
    thread_count: int = 0
    reply_count: int = 0
    recent_threads: list[CommunityProfileThreadSummary] = Field(default_factory=list)
    recent_replies: list[CommunityProfileReplySummary] = Field(default_factory=list)


class CommunityNotificationResponse(BaseModel):
    id: UUID
    notification_type: str
    title: str
    body: str | None = None
    actor_user_id: UUID | None = None
    actor_name: str | None = None
    group_id: UUID | None = None
    group_slug: str | None = None
    thread_id: UUID | None = None
    reply_id: UUID | None = None
    read_at: datetime | None = None
    created_at: datetime


class CommunityNotificationUnreadResponse(BaseModel):
    unread_count: int


class CommunityTagResponse(BaseModel):
    id: UUID
    group_id: UUID
    name: str
    slug: str


class CommunityBookmarkResponse(BaseModel):
    thread_id: UUID
    group_slug: str
    group_name: str
    title: str
    score: int = 0
    reply_count: int = 0
    created_at: datetime


class CommunityGroupDigestResponse(BaseModel):
    period_days: int
    new_threads: int
    new_replies: int
    new_resources: int
    top_threads: list[dict[str, str]] = Field(default_factory=list)


class CommunityUploadResponse(BaseModel):
    url: str


class CommunityAdminStatsResponse(BaseModel):
    group_count: int
    thread_count: int
    reply_count: int
    open_reports: int
    featured_group_count: int


class CommunityFeaturedGroupsUpdateRequest(BaseModel):
    group_ids: list[UUID] = Field(default_factory=list)


class CommunityAuditLogResponse(BaseModel):
    id: UUID
    group_id: UUID | None = None
    actor_user_id: UUID | None = None
    actor_name: str | None = None
    action: str
    target_type: str | None = None
    target_id: UUID | None = None
    details: dict | None = None
    created_at: datetime


class CommunityUnreadCountResponse(BaseModel):
    unread_count: int


class BlogPostCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=255)
    excerpt: str | None = None
    content: str = Field(min_length=1)
    category_id: UUID | None = None
    tags: list[str] = Field(default_factory=list)
    cover_image_url: str | None = Field(default=None, max_length=1024)
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = None


class BlogPostUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=255)
    excerpt: str | None = None
    content: str | None = None
    category_id: UUID | None = None
    tags: list[str] | None = None
    cover_image_url: str | None = Field(default=None, max_length=1024)
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = None


class BlogCategoryCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class BlogCategoryResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None = None
    post_count: int = 0


class BlogTagResponse(BaseModel):
    name: str
    post_count: int = 0
