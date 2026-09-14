"""Create initial core tables.

Revision ID: 20260609_0001
Revises:
Create Date: 2026-06-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260609_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


uuid_type = postgresql.UUID(as_uuid=True)
json_type = postgresql.JSONB(astext_type=sa.Text())


def uuid_pk() -> sa.Column:
    return sa.Column("id", uuid_type, primary_key=True, nullable=False)


def timestamps() -> tuple[sa.Column, sa.Column]:
    return (
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def upgrade() -> None:
    op.create_table(
        "users",
        uuid_pk(),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("external_auth_id", sa.String(length=255), nullable=True),
        *timestamps(),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("external_auth_id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"])

    op.create_table(
        "plans",
        uuid_pk(),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("stripe_price_id", sa.String(length=255), nullable=True),
        sa.Column("interval", sa.String(length=50), nullable=True),
        sa.Column("limits", json_type, nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False),
        *timestamps(),
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("stripe_price_id"),
    )
    op.create_index(op.f("ix_plans_active"), "plans", ["active"])
    op.create_index(op.f("ix_plans_code"), "plans", ["code"])

    op.create_table(
        "blog_categories",
        uuid_pk(),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(op.f("ix_blog_categories_slug"), "blog_categories", ["slug"])

    op.create_table(
        "courses",
        uuid_pk(),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("exam_date", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_courses_user_id"), "courses", ["user_id"])

    op.create_table(
        "professor_agents",
        uuid_pk(),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("subject_area", sa.String(length=255), nullable=True),
        sa.Column("difficulty", sa.String(length=50), nullable=True),
        sa.Column("marking_strictness", sa.String(length=50), nullable=True),
        sa.Column("question_style", json_type, nullable=True),
        sa.Column("favorite_topics", json_type, nullable=True),
        sa.Column("common_traps", json_type, nullable=True),
        sa.Column("feedback_tone", sa.String(length=100), nullable=True),
        sa.Column("rubric_preferences", json_type, nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_professor_agents_user_id"), "professor_agents", ["user_id"])

    op.create_table(
        "blog_authors",
        uuid_pk(),
        sa.Column("user_id", uuid_type, nullable=True),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.String(length=1024), nullable=True),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(op.f("ix_blog_authors_slug"), "blog_authors", ["slug"])
    op.create_index(op.f("ix_blog_authors_user_id"), "blog_authors", ["user_id"])

    op.create_table(
        "materials",
        uuid_pk(),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("course_id", uuid_type, nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_type", sa.String(length=100), nullable=True),
        sa.Column("storage_path", sa.String(length=1024), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="pending", nullable=False),
        sa.Column("extracted_text_preview", sa.Text(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_materials_course_id"), "materials", ["course_id"])
    op.create_index(op.f("ix_materials_status"), "materials", ["status"])
    op.create_index(op.f("ix_materials_user_id"), "materials", ["user_id"])

    op.create_table(
        "quizzes",
        uuid_pk(),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("course_id", uuid_type, nullable=True),
        sa.Column("professor_agent_id", uuid_type, nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("config", json_type, nullable=True),
        sa.Column("status", sa.String(length=50), server_default="draft", nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["professor_agent_id"], ["professor_agents.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_quizzes_course_id"), "quizzes", ["course_id"])
    op.create_index(op.f("ix_quizzes_professor_agent_id"), "quizzes", ["professor_agent_id"])
    op.create_index(op.f("ix_quizzes_status"), "quizzes", ["status"])
    op.create_index(op.f("ix_quizzes_user_id"), "quizzes", ["user_id"])

    op.create_table(
        "flashcard_decks",
        uuid_pk(),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("course_id", uuid_type, nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_flashcard_decks_course_id"), "flashcard_decks", ["course_id"])
    op.create_index(op.f("ix_flashcard_decks_user_id"), "flashcard_decks", ["user_id"])

    op.create_table(
        "community_groups",
        uuid_pk(),
        sa.Column("owner_id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("visibility", sa.String(length=50), server_default="private", nullable=False),
        sa.Column("course_id", uuid_type, nullable=True),
        sa.Column("school_name", sa.String(length=255), nullable=True),
        sa.Column("member_count", sa.Integer(), server_default="0", nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(op.f("ix_community_groups_course_id"), "community_groups", ["course_id"])
    op.create_index(op.f("ix_community_groups_owner_id"), "community_groups", ["owner_id"])
    op.create_index(op.f("ix_community_groups_school_name"), "community_groups", ["school_name"])
    op.create_index(op.f("ix_community_groups_slug"), "community_groups", ["slug"])
    op.create_index(op.f("ix_community_groups_visibility"), "community_groups", ["visibility"])

    op.create_table(
        "subscriptions",
        uuid_pk(),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("plan_id", uuid_type, nullable=True),
        sa.Column("stripe_customer_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="incomplete", nullable=False),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), server_default=sa.false(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("stripe_subscription_id"),
    )
    op.create_index(op.f("ix_subscriptions_plan_id"), "subscriptions", ["plan_id"])
    op.create_index(op.f("ix_subscriptions_status"), "subscriptions", ["status"])
    op.create_index(
        op.f("ix_subscriptions_stripe_customer_id"), "subscriptions", ["stripe_customer_id"]
    )
    op.create_index(op.f("ix_subscriptions_user_id"), "subscriptions", ["user_id"])

    op.create_table(
        "usage_events",
        uuid_pk(),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("metadata", json_type, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_usage_events_user_id"), "usage_events", ["user_id"])
    op.create_index(
        "ix_usage_events_user_type_created", "usage_events", ["user_id", "event_type", "created_at"]
    )

    op.create_table(
        "blog_posts",
        uuid_pk(),
        sa.Column("author_id", uuid_type, nullable=True),
        sa.Column("category_id", uuid_type, nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("excerpt", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("cover_image_url", sa.String(length=1024), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="draft", nullable=False),
        sa.Column("tags", json_type, nullable=True),
        sa.Column("seo_title", sa.String(length=255), nullable=True),
        sa.Column("seo_description", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["author_id"], ["blog_authors.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["category_id"], ["blog_categories.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(op.f("ix_blog_posts_author_id"), "blog_posts", ["author_id"])
    op.create_index(op.f("ix_blog_posts_category_id"), "blog_posts", ["category_id"])
    op.create_index(op.f("ix_blog_posts_published_at"), "blog_posts", ["published_at"])
    op.create_index(op.f("ix_blog_posts_slug"), "blog_posts", ["slug"])
    op.create_index(op.f("ix_blog_posts_status"), "blog_posts", ["status"])

    op.create_table(
        "material_chunks",
        uuid_pk(),
        sa.Column("material_id", uuid_type, nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("embedding", json_type, nullable=True),
        sa.Column("metadata", json_type, nullable=True),
        sa.ForeignKeyConstraint(["material_id"], ["materials.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("material_id", "chunk_index", name="uq_material_chunks_order"),
    )
    op.create_index(op.f("ix_material_chunks_material_id"), "material_chunks", ["material_id"])

    op.create_table(
        "questions",
        uuid_pk(),
        sa.Column("quiz_id", uuid_type, nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("options", json_type, nullable=True),
        sa.Column("correct_answers", json_type, nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("topic", sa.String(length=255), nullable=True),
        sa.Column("difficulty", sa.String(length=50), nullable=True),
        sa.Column("source_refs", json_type, nullable=True),
        sa.Column("rubric", json_type, nullable=True),
        sa.ForeignKeyConstraint(["quiz_id"], ["quizzes.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_questions_quiz_id"), "questions", ["quiz_id"])
    op.create_index(op.f("ix_questions_topic"), "questions", ["topic"])

    op.create_table(
        "flashcards",
        uuid_pk(),
        sa.Column("deck_id", uuid_type, nullable=False),
        sa.Column("front", sa.Text(), nullable=False),
        sa.Column("back", sa.Text(), nullable=False),
        sa.Column("topic", sa.String(length=255), nullable=True),
        sa.Column("difficulty", sa.String(length=50), nullable=True),
        sa.Column("source_refs", json_type, nullable=True),
        sa.ForeignKeyConstraint(["deck_id"], ["flashcard_decks.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_flashcards_deck_id"), "flashcards", ["deck_id"])
    op.create_index(op.f("ix_flashcards_topic"), "flashcards", ["topic"])

    op.create_table(
        "community_memberships",
        uuid_pk(),
        sa.Column("group_id", uuid_type, nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("role", sa.String(length=50), server_default="member", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="active", nullable=False),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["group_id"], ["community_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("group_id", "user_id", name="uq_community_memberships_user"),
    )
    op.create_index(
        op.f("ix_community_memberships_group_id"), "community_memberships", ["group_id"]
    )
    op.create_index(op.f("ix_community_memberships_status"), "community_memberships", ["status"])
    op.create_index(op.f("ix_community_memberships_user_id"), "community_memberships", ["user_id"])

    op.create_table(
        "community_threads",
        uuid_pk(),
        sa.Column("group_id", uuid_type, nullable=False),
        sa.Column("author_id", uuid_type, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("pinned", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("locked", sa.Boolean(), server_default=sa.false(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["community_groups.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_community_threads_author_id"), "community_threads", ["author_id"])
    op.create_index(op.f("ix_community_threads_group_id"), "community_threads", ["group_id"])

    op.create_table(
        "shared_resources",
        uuid_pk(),
        sa.Column("group_id", uuid_type, nullable=False),
        sa.Column("shared_by_user_id", uuid_type, nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=False),
        sa.Column("resource_id", uuid_type, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("visibility", sa.String(length=50), server_default="group", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["group_id"], ["community_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["shared_by_user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_shared_resources_group_id"), "shared_resources", ["group_id"])
    op.create_index(
        "ix_shared_resources_resource", "shared_resources", ["resource_type", "resource_id"]
    )
    op.create_index(
        op.f("ix_shared_resources_shared_by_user_id"), "shared_resources", ["shared_by_user_id"]
    )
    op.create_index(op.f("ix_shared_resources_visibility"), "shared_resources", ["visibility"])

    op.create_table(
        "content_reports",
        uuid_pk(),
        sa.Column("reporter_id", uuid_type, nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=False),
        sa.Column("target_id", uuid_type, nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="open", nullable=False),
        sa.Column("reviewed_by_user_id", uuid_type, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index(op.f("ix_content_reports_reporter_id"), "content_reports", ["reporter_id"])
    op.create_index(
        op.f("ix_content_reports_reviewed_by_user_id"),
        "content_reports",
        ["reviewed_by_user_id"],
    )
    op.create_index(op.f("ix_content_reports_status"), "content_reports", ["status"])
    op.create_index("ix_content_reports_target", "content_reports", ["target_type", "target_id"])

    op.create_table(
        "quiz_attempts",
        uuid_pk(),
        sa.Column("quiz_id", uuid_type, nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("score", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("max_score", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="in_progress", nullable=False),
        sa.Column("timing_metadata", json_type, nullable=True),
        sa.ForeignKeyConstraint(["quiz_id"], ["quizzes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_quiz_attempts_quiz_id"), "quiz_attempts", ["quiz_id"])
    op.create_index(op.f("ix_quiz_attempts_status"), "quiz_attempts", ["status"])
    op.create_index(op.f("ix_quiz_attempts_user_id"), "quiz_attempts", ["user_id"])

    op.create_table(
        "community_replies",
        uuid_pk(),
        sa.Column("thread_id", uuid_type, nullable=False),
        sa.Column("author_id", uuid_type, nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["thread_id"], ["community_threads.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_community_replies_author_id"), "community_replies", ["author_id"])
    op.create_index(op.f("ix_community_replies_thread_id"), "community_replies", ["thread_id"])

    op.create_table(
        "quiz_answers",
        uuid_pk(),
        sa.Column("attempt_id", uuid_type, nullable=False),
        sa.Column("question_id", uuid_type, nullable=False),
        sa.Column("answer", json_type, nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("score", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["attempt_id"], ["quiz_attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("attempt_id", "question_id", name="uq_quiz_answers_question"),
    )
    op.create_index(op.f("ix_quiz_answers_attempt_id"), "quiz_answers", ["attempt_id"])
    op.create_index(op.f("ix_quiz_answers_question_id"), "quiz_answers", ["question_id"])


def downgrade() -> None:
    op.drop_table("quiz_answers")
    op.drop_table("community_replies")
    op.drop_table("quiz_attempts")
    op.drop_table("content_reports")
    op.drop_table("shared_resources")
    op.drop_table("community_threads")
    op.drop_table("community_memberships")
    op.drop_table("flashcards")
    op.drop_table("questions")
    op.drop_table("material_chunks")
    op.drop_table("blog_posts")
    op.drop_table("usage_events")
    op.drop_table("subscriptions")
    op.drop_table("community_groups")
    op.drop_table("flashcard_decks")
    op.drop_table("quizzes")
    op.drop_table("materials")
    op.drop_table("blog_authors")
    op.drop_table("professor_agents")
    op.drop_table("courses")
    op.drop_table("blog_categories")
    op.drop_table("plans")
    op.drop_table("users")
