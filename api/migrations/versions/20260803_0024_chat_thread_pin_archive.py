"""Add pinned and archived flags to chat threads.

Revision ID: 20260803_0024
Revises: 20260802_0023
Create Date: 2026-08-03
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260803_0024"
down_revision: str | None = "20260802_0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "chat_threads",
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "chat_threads",
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("chat_threads", "archived")
    op.drop_column("chat_threads", "pinned")
