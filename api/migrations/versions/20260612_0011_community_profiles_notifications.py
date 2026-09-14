"""Add community profiles and notifications.

Revision ID: 20260612_0011
Revises: 20260612_0010
Create Date: 2026-06-12
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260612_0011"
down_revision: str | None = "20260612_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "community_profiles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("reputation_score", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("study_interests", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'"), nullable=False),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_community_profiles_reputation_score", "community_profiles", ["reputation_score"])

    op.create_table(
        "community_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notification_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reply_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["group_id"], ["community_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["thread_id"], ["community_threads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reply_id"], ["community_replies.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_community_notifications_user_id", "community_notifications", ["user_id"])
    op.create_index("ix_community_notifications_read_at", "community_notifications", ["read_at"])
    op.create_index(
        "ix_community_notifications_user_created",
        "community_notifications",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_community_notifications_user_created", table_name="community_notifications")
    op.drop_index("ix_community_notifications_read_at", table_name="community_notifications")
    op.drop_index("ix_community_notifications_user_id", table_name="community_notifications")
    op.drop_table("community_notifications")
    op.drop_index("ix_community_profiles_reputation_score", table_name="community_profiles")
    op.drop_table("community_profiles")
