"""Add nested replies support for blog comments.

Revision ID: 20260731_0021
Revises: 20260724_0020
Create Date: 2026-07-31
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "20260731_0021"
down_revision: str | None = "20260724_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("blog_comments")}

    if "parent_id" not in columns:
        op.add_column(
            "blog_comments",
            sa.Column(
                "parent_id",
                uuid_type,
                sa.ForeignKey("blog_comments.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )

    indexes = {index["name"] for index in inspector.get_indexes("blog_comments")}
    if "ix_blog_comments_parent_id" not in indexes:
        op.create_index("ix_blog_comments_parent_id", "blog_comments", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_blog_comments_parent_id", table_name="blog_comments")
    op.drop_column("blog_comments", "parent_id")
