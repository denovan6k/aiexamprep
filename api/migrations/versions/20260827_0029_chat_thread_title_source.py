"""Add title_source to chat threads for auto-title ownership.

Revision ID: 20260827_0029
Revises: 20260819_0028
Create Date: 2026-08-27
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260827_0029"
down_revision: str | None = "20260819_0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "chat_threads",
        sa.Column(
            "title_source",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'default'"),
        ),
    )
    # Preserve existing non-placeholder titles as user-owned so auto-refine never overwrites them.
    op.execute(
        sa.text(
            "UPDATE chat_threads SET title_source = 'user' "
            "WHERE title IS NOT NULL AND title <> 'New chat'"
        )
    )


def downgrade() -> None:
    op.drop_column("chat_threads", "title_source")
