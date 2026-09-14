"""Add the core study loop models and provenance.

Revision ID: 20260720_0019
Revises: 20260624_0018
Create Date: 2026-07-20
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0019"
down_revision: str | None = "20260624_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True).with_variant(sa.Uuid(), "sqlite")
json_type = postgresql.JSONB().with_variant(sa.JSON(), "sqlite")


def upgrade() -> None:
    op.add_column("courses", sa.Column("confidence_level", sa.String(20), nullable=True))
    op.add_column("quizzes", sa.Column("source_attempt_id", uuid_type, nullable=True))
    op.add_column("quizzes", sa.Column("source_action", sa.String(20), nullable=True))
    op.add_column("quizzes", sa.Column("source_topics", json_type, nullable=True))
    op.create_foreign_key(
        "fk_quizzes_source_attempt",
        "quizzes",
        "quiz_attempts",
        ["source_attempt_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_quizzes_source_attempt_id", "quizzes", ["source_attempt_id"])
    op.create_index("ix_quizzes_source_action", "quizzes", ["source_action"])

    op.add_column("quiz_attempts", sa.Column("source_attempt_id", uuid_type, nullable=True))
    op.add_column("quiz_attempts", sa.Column("source_action", sa.String(20), nullable=True))
    op.create_foreign_key(
        "fk_quiz_attempts_source_attempt",
        "quiz_attempts",
        "quiz_attempts",
        ["source_attempt_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_quiz_attempts_source_attempt_id", "quiz_attempts", ["source_attempt_id"])

    op.add_column("flashcard_decks", sa.Column("source_attempt_id", uuid_type, nullable=True))
    op.add_column("flashcard_decks", sa.Column("source_action", sa.String(20), nullable=True))
    op.add_column("flashcard_decks", sa.Column("source_topics", json_type, nullable=True))
    op.create_foreign_key(
        "fk_flashcard_decks_source_attempt",
        "flashcard_decks",
        "quiz_attempts",
        ["source_attempt_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_flashcard_decks_source_attempt_id",
        "flashcard_decks",
        ["source_attempt_id"],
    )
    op.create_index("ix_flashcard_decks_source_action", "flashcard_decks", ["source_action"])

    op.create_table(
        "study_profiles",
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("daily_minutes", sa.Integer(), server_default=sa.text("30"), nullable=False),
        sa.Column("study_goal", sa.String(255), nullable=True),
        sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True),
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

    op.create_table(
        "product_events",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_id", sa.String(128), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("properties", json_type, nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "event_id", name="uq_product_events_user_event"),
    )
    op.create_index("ix_product_events_user_id", "product_events", ["user_id"])
    op.create_index("ix_product_events_name", "product_events", ["name"])
    op.create_index(
        "ix_product_events_user_name_created",
        "product_events",
        ["user_id", "name", "created_at"],
    )

    op.create_table(
        "study_plan_items",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            uuid_type,
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("plan_date", sa.Date(), nullable=False),
        sa.Column("item_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("topic", sa.String(255), nullable=True),
        sa.Column("target_id", uuid_type, nullable=True),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("dedupe_key", sa.String(255), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.UniqueConstraint("user_id", "plan_date", "dedupe_key", name="uq_study_plan_items_key"),
    )
    op.create_index("ix_study_plan_items_user_id", "study_plan_items", ["user_id"])
    op.create_index("ix_study_plan_items_course_id", "study_plan_items", ["course_id"])
    op.create_index("ix_study_plan_items_plan_date", "study_plan_items", ["plan_date"])
    op.create_index("ix_study_plan_items_status", "study_plan_items", ["status"])
    op.create_index(
        "ix_study_plan_items_user_date_status",
        "study_plan_items",
        ["user_id", "plan_date", "status"],
    )


def downgrade() -> None:
    op.drop_table("study_plan_items")
    op.drop_table("product_events")
    op.drop_table("study_profiles")

    op.drop_index("ix_flashcard_decks_source_action", table_name="flashcard_decks")
    op.drop_index("ix_flashcard_decks_source_attempt_id", table_name="flashcard_decks")
    op.drop_constraint(
        "fk_flashcard_decks_source_attempt",
        "flashcard_decks",
        type_="foreignkey",
    )
    op.drop_column("flashcard_decks", "source_topics")
    op.drop_column("flashcard_decks", "source_action")
    op.drop_column("flashcard_decks", "source_attempt_id")

    op.drop_index("ix_quiz_attempts_source_attempt_id", table_name="quiz_attempts")
    op.drop_constraint("fk_quiz_attempts_source_attempt", "quiz_attempts", type_="foreignkey")
    op.drop_column("quiz_attempts", "source_action")
    op.drop_column("quiz_attempts", "source_attempt_id")

    op.drop_index("ix_quizzes_source_action", table_name="quizzes")
    op.drop_index("ix_quizzes_source_attempt_id", table_name="quizzes")
    op.drop_constraint("fk_quizzes_source_attempt", "quizzes", type_="foreignkey")
    op.drop_column("quizzes", "source_topics")
    op.drop_column("quizzes", "source_action")
    op.drop_column("quizzes", "source_attempt_id")
    op.drop_column("courses", "confidence_level")
