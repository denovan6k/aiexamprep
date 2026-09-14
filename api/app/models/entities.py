from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.types import UserDefinedType
from sqlalchemy.dialects.postgresql import JSONB as PostgreSQLJSONB
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped, mapped_column, relationship

try:
    from app.core.database import Base
except ImportError:
    class Base(DeclarativeBase):
        pass


def UUID(*, as_uuid: bool = True):
    return PostgreSQLUUID(as_uuid=as_uuid).with_variant(Uuid(as_uuid=as_uuid), "sqlite")


JSONB = PostgreSQLJSONB().with_variant(JSON(), "sqlite")


class PGVector(UserDefinedType):
    cache_ok = True

    def __init__(self, dimension: int = 1536) -> None:
        self.dimension = dimension

    def get_col_spec(self, **kw: Any) -> str:
        return f"vector({self.dimension})"

    def bind_processor(self, dialect: Any):
        def process(value: Any) -> str | None:
            if value is None:
                return None
            return "[" + ",".join(str(float(item)) for item in value) + "]"

        return process

    def result_processor(self, dialect: Any, coltype: Any):
        def process(value: Any) -> list[float] | None:
            if value is None:
                return None
            if isinstance(value, list):
                return [float(item) for item in value]
            text_value = str(value).strip()
            if text_value.startswith("[") and text_value.endswith("]"):
                text_value = text_value[1:-1]
            if not text_value:
                return []
            return [float(item) for item in text_value.split(",")]

        return process


EmbeddingVector = PGVector(1536).with_variant(JSON(), "sqlite")


def utc_now() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, server_default=text("now()")
    )


class Institution(TimestampMixin, Base):
    __tablename__ = "institutions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    users: Mapped[list[User]] = relationship(back_populates="institution")
    materials: Mapped[list[Material]] = relationship(back_populates="institution")
    memberships: Mapped[list[InstitutionMembership]] = relationship(
        back_populates="institution", cascade="all, delete-orphan"
    )


class InstitutionMembership(TimestampMixin, Base):
    __tablename__ = "institution_memberships"
    __table_args__ = (
        UniqueConstraint("institution_id", "user_id", name="uq_institution_memberships_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(50), default="member", server_default=text("'member'"))

    institution: Mapped[Institution] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="institution_memberships")


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    external_auth_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    role: Mapped[str] = mapped_column(String(50), default="user", server_default=text("'user'"), index=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    institution_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("institutions.id", ondelete="SET NULL"), index=True
    )

    institution: Mapped[Institution | None] = relationship(back_populates="users")
    institution_memberships: Mapped[list[InstitutionMembership]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    courses: Mapped[list[Course]] = relationship(back_populates="user")
    professor_agents: Mapped[list[ProfessorAgent]] = relationship(back_populates="user")
    cv_documents: Mapped[list["CvDocument"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    cv_tailorings: Mapped[list["CvTailoring"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    quizzes: Mapped[list[Quiz]] = relationship(back_populates="user")
    quiz_attempts: Mapped[list[QuizAttempt]] = relationship(back_populates="user")
    flashcard_decks: Mapped[list[FlashcardDeck]] = relationship(back_populates="user")
    blog_author: Mapped[BlogAuthor | None] = relationship(back_populates="user")
    subscriptions: Mapped[list[Subscription]] = relationship(back_populates="user")
    usage_events: Mapped[list[UsageEvent]] = relationship(back_populates="user")
    auth_accounts: Mapped[list[AuthAccount]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    auth_sessions: Mapped[list[AuthSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    password_reset_tokens: Mapped[list[PasswordResetToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    email_verification_tokens: Mapped[list[EmailVerificationToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    chat_threads: Mapped[list[ChatThread]] = relationship(back_populates="user")
    chat_projects: Mapped[list[ChatProject]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    support_tickets: Mapped[list[SupportTicket]] = relationship(
        back_populates="user", cascade="all, delete-orphan", foreign_keys="SupportTicket.user_id"
    )
    moderation_appeals: Mapped[list[ModerationAppeal]] = relationship(
        back_populates="user", cascade="all, delete-orphan", foreign_keys="ModerationAppeal.user_id"
    )
    api_keys: Mapped[list[UserApiKey]] = relationship(back_populates="user", cascade="all, delete-orphan")
    generation_profiles: Mapped[list[GenerationProfile]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    media_attachments: Mapped[list[MediaAttachment]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    default_chat_model: Mapped[str | None] = mapped_column(String(255))
    default_generation_model: Mapped[str | None] = mapped_column(String(255))
    default_embedding_model: Mapped[str | None] = mapped_column(String(255))


class AuthAccount(TimestampMixin, Base):
    __tablename__ = "auth_accounts"
    __table_args__ = (
        UniqueConstraint("provider", "provider_account_id", name="uq_auth_accounts_provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(50), index=True)
    provider_account_id: Mapped[str] = mapped_column(String(255))
    provider_email: Mapped[str | None] = mapped_column(String(320), index=True)
    access_token_hash: Mapped[str | None] = mapped_column(String(128))
    refresh_token_hash: Mapped[str | None] = mapped_column(String(128))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="auth_accounts")


class AuthSession(TimestampMixin, Base):
    __tablename__ = "auth_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    user_agent: Mapped[str | None] = mapped_column(String(512))
    ip_address: Mapped[str | None] = mapped_column(String(45))

    user: Mapped[User] = relationship(back_populates="auth_sessions")


class PasswordResetToken(TimestampMixin, Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))

    user: Mapped[User] = relationship(back_populates="password_reset_tokens")


class EmailVerificationToken(TimestampMixin, Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))

    user: Mapped[User] = relationship(back_populates="email_verification_tokens")


class Course(TimestampMixin, Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    exam_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confidence_level: Mapped[str | None] = mapped_column(String(20))

    user: Mapped[User] = relationship(back_populates="courses")
    materials: Mapped[list[Material]] = relationship(back_populates="course")
    quizzes: Mapped[list[Quiz]] = relationship(back_populates="course")
    flashcard_decks: Mapped[list[FlashcardDeck]] = relationship(back_populates="course")
    community_groups: Mapped[list[CommunityGroup]] = relationship(back_populates="course")


class StudyProfile(TimestampMixin, Base):
    __tablename__ = "study_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    daily_minutes: Mapped[int] = mapped_column(Integer, default=30, server_default=text("30"))
    study_goal: Mapped[str | None] = mapped_column(String(255))
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()


class ProductEvent(Base):
    __tablename__ = "product_events"
    __table_args__ = (
        UniqueConstraint("user_id", "event_id", name="uq_product_events_user_event"),
        Index("ix_product_events_user_name_created", "user_id", "name", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    event_id: Mapped[str] = mapped_column(String(128))
    name: Mapped[str] = mapped_column(String(100), index=True)
    properties: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=text("now()")
    )

    user: Mapped[User] = relationship()


class Material(TimestampMixin, Base):
    __tablename__ = "materials"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )
    institution_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    file_name: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str | None] = mapped_column(String(100))
    storage_path: Mapped[str] = mapped_column(String(1024))
    status: Mapped[str] = mapped_column(String(50), default="pending", index=True)
    extracted_text_preview: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship()
    course: Mapped[Course | None] = relationship(back_populates="materials")
    institution: Mapped[Institution | None] = relationship(back_populates="materials")
    chunks: Mapped[list[MaterialChunk]] = relationship(
        back_populates="material", cascade="all, delete-orphan"
    )


class MaterialChunk(Base):
    __tablename__ = "material_chunks"
    __table_args__ = (
        UniqueConstraint("material_id", "chunk_index", name="uq_material_chunks_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("materials.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int | None] = mapped_column(Integer)
    embedding: Mapped[list[float] | None] = mapped_column(EmbeddingVector)
    chunk_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)

    material: Mapped[Material] = relationship(back_populates="chunks")


class GenerationProfile(TimestampMixin, Base):
    __tablename__ = "generation_profiles"
    __table_args__ = (
        Index("ix_generation_profiles_user_upload", "user_id", "apply_on_upload"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    prompt_template: Mapped[str] = mapped_column(Text)
    apply_on_upload: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    output_type: Mapped[str] = mapped_column(String(50), index=True)
    profile_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)

    user: Mapped[User] = relationship(back_populates="generation_profiles")
    material_insights: Mapped[list[MaterialInsight]] = relationship(back_populates="generation_profile")


class MaterialInsight(TimestampMixin, Base):
    __tablename__ = "material_insights"
    __table_args__ = (
        Index("ix_material_insights_material_type", "material_id", "insight_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("materials.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    generation_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("generation_profiles.id", ondelete="SET NULL"), index=True
    )
    insight_type: Mapped[str] = mapped_column(String(50), default="summary", server_default=text("'summary'"))
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    insight_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)

    material: Mapped[Material] = relationship()
    user: Mapped[User] = relationship()
    generation_profile: Mapped[GenerationProfile | None] = relationship(
        back_populates="material_insights"
    )


class StudyArtifact(TimestampMixin, Base):
    __tablename__ = "study_artifacts"
    __table_args__ = (Index("ix_study_artifacts_user_type", "user_id", "artifact_type"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    thread_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("chat_threads.id", ondelete="SET NULL"), index=True
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    material_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("materials.id", ondelete="SET NULL"), index=True
    )
    artifact_type: Mapped[str] = mapped_column(String(50), index=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[dict[str, Any]] = mapped_column(JSONB)
    schema_version: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"))

    user: Mapped[User] = relationship()
    thread: Mapped[ChatThread | None] = relationship()
    material: Mapped[Material | None] = relationship()


class ProfessorAgent(TimestampMixin, Base):
    __tablename__ = "professor_agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    subject_area: Mapped[str | None] = mapped_column(String(255))
    difficulty: Mapped[str | None] = mapped_column(String(50))
    marking_strictness: Mapped[str | None] = mapped_column(String(50))
    question_style: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    favorite_topics: Mapped[list[str] | None] = mapped_column(JSONB)
    common_traps: Mapped[list[str] | None] = mapped_column(JSONB)
    feedback_tone: Mapped[str | None] = mapped_column(String(100))
    rubric_preferences: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    avatar_url: Mapped[str | None] = mapped_column(String(1024))
    intro_message: Mapped[str | None] = mapped_column(Text)
    capabilities_summary: Mapped[str | None] = mapped_column(String(512))

    user: Mapped[User] = relationship(back_populates="professor_agents")
    quizzes: Mapped[list[Quiz]] = relationship(back_populates="professor_agent")
    mcp_connections: Mapped[list["AgentMcpConnection"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )


class AgentMcpConnection(TimestampMixin, Base):
    __tablename__ = "agent_mcp_connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("professor_agents.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    server_url: Mapped[str] = mapped_column(String(2048))
    transport: Mapped[str] = mapped_column(String(50), default="streamable-http")
    auth_type: Mapped[str] = mapped_column(String(50), default="none")
    auth_config_encrypted: Mapped[str | None] = mapped_column(Text)
    oauth_state: Mapped[str | None] = mapped_column(String(255))
    oauth_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    discovered_tools: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)

    agent: Mapped[ProfessorAgent] = relationship(back_populates="mcp_connections")
    user: Mapped[User] = relationship()


class CvDocument(TimestampMixin, Base):
    __tablename__ = "cv_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    file_name: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str | None] = mapped_column(String(100))
    storage_path: Mapped[str] = mapped_column(String(1024))
    extracted_text: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="uploaded", index=True)
    error_message: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="cv_documents")
    tailorings: Mapped[list["CvTailoring"]] = relationship(
        back_populates="cv_document", cascade="all, delete-orphan"
    )


class CvTailoring(TimestampMixin, Base):
    __tablename__ = "cv_tailorings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    cv_document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cv_documents.id", ondelete="CASCADE"), index=True
    )
    job_title: Mapped[str | None] = mapped_column(String(255))
    company: Mapped[str | None] = mapped_column(String(255))
    job_description: Mapped[str] = mapped_column(Text)
    tailored_sections: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(50), default="queued", index=True)
    storage_path: Mapped[str | None] = mapped_column(String(1024))
    model: Mapped[str | None] = mapped_column(String(255))
    error_message: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="cv_tailorings")
    cv_document: Mapped[CvDocument] = relationship(back_populates="tailorings")


class Quiz(TimestampMixin, Base):
    __tablename__ = "quizzes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )
    professor_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("professor_agents.id", ondelete="SET NULL"), index=True
    )
    material_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("materials.id", ondelete="SET NULL"), index=True
    )
    generation_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("generation_profiles.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    config: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(50), default="draft", index=True)
    source_attempt_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(
            "quiz_attempts.id",
            ondelete="SET NULL",
            name="fk_quizzes_source_attempt",
            use_alter=True,
        ),
        index=True,
    )
    source_action: Mapped[str | None] = mapped_column(String(20), index=True)
    source_topics: Mapped[list[str] | None] = mapped_column(JSONB)

    user: Mapped[User] = relationship(back_populates="quizzes")
    course: Mapped[Course | None] = relationship(back_populates="quizzes")
    material: Mapped[Material | None] = relationship()
    generation_profile: Mapped[GenerationProfile | None] = relationship()
    professor_agent: Mapped[ProfessorAgent | None] = relationship(back_populates="quizzes")
    questions: Mapped[list[Question]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan"
    )
    attempts: Mapped[list[QuizAttempt]] = relationship(
        back_populates="quiz", foreign_keys="QuizAttempt.quiz_id"
    )


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String(50))
    prompt: Mapped[str] = mapped_column(Text)
    options: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    correct_answers: Mapped[list[Any] | None] = mapped_column(JSONB)
    explanation: Mapped[str | None] = mapped_column(Text)
    topic: Mapped[str | None] = mapped_column(String(255), index=True)
    difficulty: Mapped[str | None] = mapped_column(String(50))
    source_refs: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    rubric: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    quiz: Mapped[Quiz] = relationship(back_populates="questions")
    answers: Mapped[list[QuizAnswer]] = relationship(back_populates="question")
    ratings: Mapped[list[QuestionRating]] = relationship(
        back_populates="question", cascade="all, delete-orphan"
    )


class QuestionRating(TimestampMixin, Base):
    __tablename__ = "question_ratings"
    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_question_ratings_user_question"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    professor_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("professor_agents.id", ondelete="SET NULL"), index=True
    )
    rating: Mapped[str] = mapped_column(String(10))

    user: Mapped[User] = relationship()
    question: Mapped[Question] = relationship(back_populates="ratings")
    professor_agent: Mapped[ProfessorAgent | None] = relationship()


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=text("now()")
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    score: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    max_score: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    status: Mapped[str] = mapped_column(String(50), default="in_progress", index=True)
    timing_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    source_attempt_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="SET NULL"), index=True
    )
    source_action: Mapped[str | None] = mapped_column(String(20))

    quiz: Mapped[Quiz] = relationship(back_populates="attempts", foreign_keys=[quiz_id])
    user: Mapped[User] = relationship(back_populates="quiz_attempts")
    answers: Mapped[list[QuizAnswer]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"
    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_quiz_answers_question"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    answer: Mapped[dict[str, Any] | list[Any] | str | None] = mapped_column(JSONB)
    is_correct: Mapped[bool | None] = mapped_column(Boolean)
    score: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    feedback: Mapped[str | None] = mapped_column(Text)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    attempt: Mapped[QuizAttempt] = relationship(back_populates="answers")
    question: Mapped[Question] = relationship(back_populates="answers")


class FlashcardDeck(TimestampMixin, Base):
    __tablename__ = "flashcard_decks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )
    material_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("materials.id", ondelete="SET NULL"), index=True
    )
    generation_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("generation_profiles.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    source_attempt_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="SET NULL"), index=True
    )
    source_action: Mapped[str | None] = mapped_column(String(20), index=True)
    source_topics: Mapped[list[str] | None] = mapped_column(JSONB)

    user: Mapped[User] = relationship(back_populates="flashcard_decks")
    course: Mapped[Course | None] = relationship(back_populates="flashcard_decks")
    material: Mapped[Material | None] = relationship()
    generation_profile: Mapped[GenerationProfile | None] = relationship()
    flashcards: Mapped[list[Flashcard]] = relationship(
        back_populates="deck", cascade="all, delete-orphan"
    )


class StudyPlanItem(TimestampMixin, Base):
    __tablename__ = "study_plan_items"
    __table_args__ = (
        UniqueConstraint("user_id", "plan_date", "dedupe_key", name="uq_study_plan_items_key"),
        Index("ix_study_plan_items_user_date_status", "user_id", "plan_date", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    plan_date: Mapped[date] = mapped_column(Date, index=True)
    item_type: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(255))
    topic: Mapped[str | None] = mapped_column(String(255))
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    dedupe_key: Mapped[str] = mapped_column(String(255))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()
    course: Mapped[Course | None] = relationship()


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deck_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("flashcard_decks.id", ondelete="CASCADE"), index=True
    )
    front: Mapped[str] = mapped_column(Text)
    back: Mapped[str] = mapped_column(Text)
    topic: Mapped[str | None] = mapped_column(String(255), index=True)
    difficulty: Mapped[str | None] = mapped_column(String(50))
    source_refs: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)

    deck: Mapped[FlashcardDeck] = relationship(back_populates="flashcards")
    reviews: Mapped[list[FlashcardReview]] = relationship(
        back_populates="flashcard", cascade="all, delete-orphan"
    )


class FlashcardReview(Base):
    __tablename__ = "flashcard_reviews"
    __table_args__ = (
        UniqueConstraint("user_id", "flashcard_id", name="uq_flashcard_reviews_user_card"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    flashcard_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("flashcards.id", ondelete="CASCADE"), index=True
    )
    confidence: Mapped[str] = mapped_column(String(20))
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=text("now()")
    )

    flashcard: Mapped[Flashcard] = relationship(back_populates="reviews")


class BlogAuthor(Base):
    __tablename__ = "blog_authors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    display_name: Mapped[str] = mapped_column(String(255))
    bio: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(String(1024))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    user: Mapped[User | None] = relationship(back_populates="blog_author")
    posts: Mapped[list[BlogPost]] = relationship(back_populates="author")


class BlogCategory(Base):
    __tablename__ = "blog_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)

    posts: Mapped[list[BlogPost]] = relationship(back_populates="category")


class BlogPost(TimestampMixin, Base):
    __tablename__ = "blog_posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("blog_authors.id", ondelete="SET NULL"), index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("blog_categories.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    excerpt: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    cover_image_url: Mapped[str | None] = mapped_column(String(1024))
    status: Mapped[str] = mapped_column(String(50), default="draft", index=True)
    tags: Mapped[list[str] | None] = mapped_column(JSONB)
    seo_title: Mapped[str | None] = mapped_column(String(255))
    seo_description: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    author: Mapped[BlogAuthor | None] = relationship(back_populates="posts")
    category: Mapped[BlogCategory | None] = relationship(back_populates="posts")
    comments: Mapped[list[BlogComment]] = relationship(
        back_populates="post", cascade="all, delete-orphan"
    )


class BlogComment(TimestampMixin, Base):
    __tablename__ = "blog_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("blog_posts.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("blog_comments.id", ondelete="CASCADE"), index=True
    )
    body: Mapped[str] = mapped_column(Text)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))

    post: Mapped[BlogPost] = relationship(back_populates="comments")
    user: Mapped[User] = relationship()
    parent: Mapped[BlogComment | None] = relationship(
        remote_side="BlogComment.id", back_populates="children"
    )
    children: Mapped[list[BlogComment]] = relationship(back_populates="parent")


class CommunityGroup(TimestampMixin, Base):
    __tablename__ = "community_groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    visibility: Mapped[str] = mapped_column(String(50), default="private", index=True)
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )
    school_name: Mapped[str | None] = mapped_column(String(255), index=True)
    member_count: Mapped[int] = mapped_column(Integer, default=0)

    owner: Mapped[User] = relationship()
    course: Mapped[Course | None] = relationship(back_populates="community_groups")
    memberships: Mapped[list[CommunityMembership]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )
    threads: Mapped[list[CommunityThread]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )
    shared_resources: Mapped[list[SharedResource]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class CommunityMembership(Base):
    __tablename__ = "community_memberships"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_community_memberships_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("community_groups.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(50), default="member")
    status: Mapped[str] = mapped_column(String(50), default="active", index=True)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=text("now()")
    )

    group: Mapped[CommunityGroup] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship()


class CommunityThread(TimestampMixin, Base):
    __tablename__ = "community_threads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("community_groups.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    locked: Mapped[bool] = mapped_column(Boolean, default=False)

    group: Mapped[CommunityGroup] = relationship(back_populates="threads")
    author: Mapped[User] = relationship()
    replies: Mapped[list[CommunityReply]] = relationship(
        back_populates="thread", cascade="all, delete-orphan"
    )


class CommunityReply(TimestampMixin, Base):
    __tablename__ = "community_replies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("community_threads.id", ondelete="CASCADE"), index=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("community_replies.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    body: Mapped[str] = mapped_column(Text)

    thread: Mapped[CommunityThread] = relationship(back_populates="replies")
    author: Mapped[User] = relationship()
    parent: Mapped[CommunityReply | None] = relationship(
        remote_side="CommunityReply.id", back_populates="children"
    )
    children: Mapped[list[CommunityReply]] = relationship(back_populates="parent")


class CommunityVote(Base):
    __tablename__ = "community_votes"
    __table_args__ = (
        UniqueConstraint("user_id", "target_type", "target_id", name="uq_community_votes_user_target"),
        Index("ix_community_votes_target", "target_type", "target_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    target_type: Mapped[str] = mapped_column(String(50))
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    vote: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    user: Mapped[User] = relationship()


class CommunityProfile(TimestampMixin, Base):
    __tablename__ = "community_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    reputation_score: Mapped[int] = mapped_column(Integer, default=0, index=True)
    bio: Mapped[str | None] = mapped_column(Text)
    study_interests: Mapped[list[str]] = mapped_column(
        JSONB, default=lambda: [], server_default=text("'[]'")
    )

    user: Mapped[User] = relationship()


class CommunityNotification(Base):
    __tablename__ = "community_notifications"
    __table_args__ = (Index("ix_community_notifications_user_created", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    notification_type: Mapped[str] = mapped_column(String(50), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str | None] = mapped_column(Text)
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("community_groups.id", ondelete="CASCADE"), index=True
    )
    thread_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("community_threads.id", ondelete="CASCADE"), index=True
    )
    reply_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("community_replies.id", ondelete="CASCADE"), index=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    actor: Mapped[User | None] = relationship(foreign_keys=[actor_user_id])
    group: Mapped[CommunityGroup | None] = relationship()
    thread: Mapped[CommunityThread | None] = relationship()
    reply: Mapped[CommunityReply | None] = relationship()


class SharedResource(Base):
    __tablename__ = "shared_resources"
    __table_args__ = (
        Index("ix_shared_resources_resource", "resource_type", "resource_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("community_groups.id", ondelete="CASCADE"), index=True
    )
    shared_by_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    resource_type: Mapped[str] = mapped_column(String(50))
    resource_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    visibility: Mapped[str] = mapped_column(String(50), default="group", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    group: Mapped[CommunityGroup] = relationship(back_populates="shared_resources")
    shared_by_user: Mapped[User] = relationship()


class ContentReport(Base):
    __tablename__ = "content_reports"
    __table_args__ = (Index("ix_content_reports_target", "target_type", "target_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    target_type: Mapped[str] = mapped_column(String(50))
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    reason: Mapped[str] = mapped_column(String(255))
    details: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="open", index=True)
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    reporter: Mapped[User] = relationship(foreign_keys=[reporter_id])
    reviewed_by_user: Mapped[User | None] = relationship(foreign_keys=[reviewed_by_user_id])


class Plan(TimestampMixin, Base):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    stripe_price_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    interval: Mapped[str | None] = mapped_column(String(50))
    price_cents: Mapped[int | None] = mapped_column(Integer)
    limits: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    subscriptions: Mapped[list[Subscription]] = relationship(back_populates="plan")


class Subscription(TimestampMixin, Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("plans.id", ondelete="SET NULL"), index=True
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), index=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    status: Mapped[str] = mapped_column(String(50), default="incomplete", index=True)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="subscriptions")
    plan: Mapped[Plan | None] = relationship(back_populates="subscriptions")


class UsageEvent(Base):
    __tablename__ = "usage_events"
    __table_args__ = (
        Index("ix_usage_events_user_type_created", "user_id", "event_type", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(100))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    event_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=text("now()")
    )

    user: Mapped[User] = relationship(back_populates="usage_events")


class CreditGrant(TimestampMixin, Base):
    __tablename__ = "credit_grants"
    __table_args__ = (
        Index("ix_credit_grants_user_expires", "user_id", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    credits_total: Mapped[int] = mapped_column(Integer)
    credits_remaining: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(50), default="purchase", server_default=text("'purchase'"))
    description: Mapped[str | None] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    user: Mapped[User] = relationship()


class CreditUsage(Base):
    __tablename__ = "credit_usages"
    __table_args__ = (
        Index("ix_credit_usages_user_created", "user_id", "created_at"),
        Index("ix_credit_usages_grant_created", "credit_grant_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    credit_grant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("credit_grants.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(100))
    credits_used: Mapped[int] = mapped_column(Integer)
    usage_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=text("now()")
    )

    user: Mapped[User] = relationship()
    credit_grant: Mapped[CreditGrant] = relationship()


class UserApiKey(TimestampMixin, Base):
    __tablename__ = "user_api_keys"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_user_api_keys_user_provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(50), index=True)
    label: Mapped[str | None] = mapped_column(String(255))
    encrypted_key: Mapped[str] = mapped_column(Text)
    key_last4: Mapped[str] = mapped_column(String(4))
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    last_validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="api_keys")
    chat_threads: Mapped[list[ChatThread]] = relationship(back_populates="user_api_key")


class ChatProject(TimestampMixin, Base):
    __tablename__ = "chat_projects"
    __table_args__ = (Index("ix_chat_projects_user_archived", "user_id", "archived"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    instructions: Mapped[str | None] = mapped_column(Text)
    material_ids: Mapped[list[str]] = mapped_column(
        JSONB, default=lambda: [], server_default=text("'[]'")
    )
    starred: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
    archived: Mapped[bool] = mapped_column(default=False, server_default=text("false"))

    user: Mapped[User] = relationship(back_populates="chat_projects")
    threads: Mapped[list[ChatThread]] = relationship(back_populates="project")


class ChatThread(TimestampMixin, Base):
    __tablename__ = "chat_threads"
    __table_args__ = (Index("ix_chat_threads_user_project", "user_id", "project_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255), default="New chat")
    title_source: Mapped[str] = mapped_column(
        String(20), default="default", server_default=text("'default'")
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("chat_projects.id", ondelete="SET NULL"), index=True
    )
    professor_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("professor_agents.id", ondelete="SET NULL"), index=True
    )
    material_ids: Mapped[list[str]] = mapped_column(
        JSONB, default=lambda: [], server_default=text("'[]'")
    )
    llm_source: Mapped[str] = mapped_column(String(20), default="platform", server_default=text("'platform'"))
    llm_provider: Mapped[str | None] = mapped_column(String(50))
    user_api_key_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user_api_keys.id", ondelete="SET NULL"), index=True
    )
    pinned: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
    archived: Mapped[bool] = mapped_column(default=False, server_default=text("false"))

    user: Mapped[User] = relationship(back_populates="chat_threads")
    project: Mapped[ChatProject | None] = relationship(back_populates="threads")
    course: Mapped[Course | None] = relationship()
    professor_agent: Mapped[ProfessorAgent | None] = relationship()
    user_api_key: Mapped[UserApiKey | None] = relationship(back_populates="chat_threads")
    messages: Mapped[list[ChatMessage]] = relationship(
        back_populates="thread", cascade="all, delete-orphan", order_by="ChatMessage.created_at"
    )


class GenerationJob(TimestampMixin, Base):
    __tablename__ = "generation_jobs"
    __table_args__ = (Index("ix_generation_jobs_user_status", "user_id", "status"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    job_type: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[str] = mapped_column(String(50), default="queued", index=True)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    error_message: Mapped[str | None] = mapped_column(Text)
    thread_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("chat_threads.id", ondelete="SET NULL"), index=True
    )
    material_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("materials.id", ondelete="SET NULL"), index=True
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)

    user: Mapped[User] = relationship()
    thread: Mapped[ChatThread | None] = relationship()
    material: Mapped[Material | None] = relationship()


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("chat_threads.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    quiz_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("quizzes.id", ondelete="SET NULL"), index=True
    )
    material_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("materials.id", ondelete="SET NULL"), index=True
    )
    message_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=text("now()")
    )

    thread: Mapped[ChatThread] = relationship(back_populates="messages")
    quiz: Mapped[Quiz | None] = relationship()
    material: Mapped[Material | None] = relationship()
    media_attachments: Mapped[list[MediaAttachment]] = relationship(back_populates="message")


class SupportTicket(TimestampMixin, Base):
    __tablename__ = "support_tickets"
    __table_args__ = (Index("ix_support_tickets_user_status", "user_id", "status"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(50), default="general", server_default=text("'general'"))
    subject: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="open", server_default=text("'open'"), index=True)
    priority: Mapped[str] = mapped_column(String(50), default="normal", server_default=text("'normal'"))
    assigned_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    admin_notes: Mapped[str | None] = mapped_column(Text)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="support_tickets", foreign_keys=[user_id])
    assigned_admin: Mapped[User | None] = relationship(foreign_keys=[assigned_admin_id])


class ModerationAppeal(TimestampMixin, Base):
    __tablename__ = "moderation_appeals"
    __table_args__ = (Index("ix_moderation_appeals_user_status", "user_id", "status"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    appeal_type: Mapped[str] = mapped_column(String(50))
    reference_type: Mapped[str | None] = mapped_column(String(50))
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="pending", server_default=text("'pending'"), index=True)
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    admin_response: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="moderation_appeals", foreign_keys=[user_id])
    reviewed_by_user: Mapped[User | None] = relationship(foreign_keys=[reviewed_by_user_id])


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"
    __table_args__ = (
        Index("ix_admin_audit_logs_admin_created", "admin_user_id", "created_at"),
        Index("ix_admin_audit_logs_target", "target_type", "target_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    action: Mapped[str] = mapped_column(String(100))
    target_type: Mapped[str] = mapped_column(String(50))
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    audit_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=text("now()")
    )

    admin_user: Mapped[User] = relationship(foreign_keys=[admin_user_id])


class MediaAttachment(Base):
    __tablename__ = "media_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    storage_provider: Mapped[str] = mapped_column(String(20))
    storage_key: Mapped[str] = mapped_column(String(512))
    media_url: Mapped[str] = mapped_column(Text)
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    parsed_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    parsing_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=text("now()")
    )

    user: Mapped[User] = relationship(back_populates="media_attachments", foreign_keys=[user_id])
    message: Mapped[ChatMessage | None] = relationship(back_populates="media_attachments", foreign_keys=[message_id])
