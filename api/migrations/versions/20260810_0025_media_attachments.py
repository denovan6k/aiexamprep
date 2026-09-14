"""Add media_attachments table.

Revision ID: 20260810_0025
Revises: 20260803_0024
Create Date: 2026-08-10
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260810_0025"
down_revision: str | None = "20260803_0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "media_attachments",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "message_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("chat_messages.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("storage_provider", sa.String(20), nullable=False),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("media_url", sa.Text(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("parsed_content", sa.Text(), nullable=True),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("parsing_method", sa.String(20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_media_attachments_message_id", "media_attachments", ["message_id"])
    op.create_index("ix_media_attachments_user_id", "media_attachments", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_media_attachments_user_id", table_name="media_attachments")
    op.drop_index("ix_media_attachments_message_id", table_name="media_attachments")
    op.drop_table("media_attachments")
