"""Add super admin flag and blog comments.

Revision ID: 20260612_0008
Revises: 20260611_0007
Create Date: 2026-06-12
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260612_0008"
down_revision: str | None = "20260611_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_super_admin", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.create_table(
        "blog_comments",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("post_id", uuid_type, sa.ForeignKey("blog_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_hidden", sa.Boolean(), server_default=sa.text("false"), nullable=False),
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
    op.create_index("ix_blog_comments_post_id", "blog_comments", ["post_id"])
    op.create_index("ix_blog_comments_user_id", "blog_comments", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_blog_comments_user_id", table_name="blog_comments")
    op.drop_index("ix_blog_comments_post_id", table_name="blog_comments")
    op.drop_table("blog_comments")
    op.drop_column("users", "is_super_admin")
