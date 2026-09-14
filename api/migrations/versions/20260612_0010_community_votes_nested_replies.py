"""Add nested replies and community voting.

Revision ID: 20260612_0010
Revises: 20260612_0009
Create Date: 2026-06-12
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260612_0010"
down_revision: str | None = "20260612_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "community_replies",
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_community_replies_parent_id", "community_replies", ["parent_id"])
    op.create_foreign_key(
        "fk_community_replies_parent_id",
        "community_replies",
        "community_replies",
        ["parent_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_table(
        "community_votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vote", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "target_type", "target_id", name="uq_community_votes_user_target"),
    )
    op.create_index("ix_community_votes_user_id", "community_votes", ["user_id"])
    op.create_index("ix_community_votes_target", "community_votes", ["target_type", "target_id"])


def downgrade() -> None:
    op.drop_index("ix_community_votes_target", table_name="community_votes")
    op.drop_index("ix_community_votes_user_id", table_name="community_votes")
    op.drop_table("community_votes")
    op.drop_constraint("fk_community_replies_parent_id", "community_replies", type_="foreignkey")
    op.drop_index("ix_community_replies_parent_id", table_name="community_replies")
    op.drop_column("community_replies", "parent_id")
