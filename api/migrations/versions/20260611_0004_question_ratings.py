"""Add question ratings for agent quality feedback.

Revision ID: 20260611_0004
Revises: 20260611_0003
Create Date: 2026-06-11
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260611_0004"
down_revision: str | None = "20260611_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "question_ratings",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "question_id",
            uuid_type,
            sa.ForeignKey("questions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "professor_agent_id",
            uuid_type,
            sa.ForeignKey("professor_agents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("rating", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "question_id", name="uq_question_ratings_user_question"),
    )
    op.create_index("ix_question_ratings_user_id", "question_ratings", ["user_id"])
    op.create_index("ix_question_ratings_question_id", "question_ratings", ["question_id"])
    op.create_index("ix_question_ratings_professor_agent_id", "question_ratings", ["professor_agent_id"])


def downgrade() -> None:
    op.drop_index("ix_question_ratings_professor_agent_id", table_name="question_ratings")
    op.drop_index("ix_question_ratings_question_id", table_name="question_ratings")
    op.drop_index("ix_question_ratings_user_id", table_name="question_ratings")
    op.drop_table("question_ratings")
