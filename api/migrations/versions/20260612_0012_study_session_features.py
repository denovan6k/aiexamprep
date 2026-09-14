"""Add quiz answer flags and flashcard review tracking.

Revision ID: 20260612_0012
Revises: 20260612_0011
Create Date: 2026-06-12
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260612_0012"
down_revision: str | None = "20260612_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.add_column(
        "quiz_answers",
        sa.Column("flagged", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.create_table(
        "flashcard_reviews",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "flashcard_id",
            uuid_type,
            sa.ForeignKey("flashcards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("confidence", sa.String(20), nullable=False),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "flashcard_id", name="uq_flashcard_reviews_user_card"),
    )
    op.create_index("ix_flashcard_reviews_user_id", "flashcard_reviews", ["user_id"])
    op.create_index("ix_flashcard_reviews_flashcard_id", "flashcard_reviews", ["flashcard_id"])


def downgrade() -> None:
    op.drop_index("ix_flashcard_reviews_flashcard_id", table_name="flashcard_reviews")
    op.drop_index("ix_flashcard_reviews_user_id", table_name="flashcard_reviews")
    op.drop_table("flashcard_reviews")
    op.drop_column("quiz_answers", "flagged")
