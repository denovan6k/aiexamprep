"""Add chat projects and thread.project_id.

Revision ID: 20260908_0030
Revises: 20260827_0029
Create Date: 2026-09-08
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260908_0030"
down_revision: str | None = "20260827_0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chat_projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column(
            "material_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.Column("starred", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_projects_user_id", "chat_projects", ["user_id"])
    op.create_index(
        "ix_chat_projects_user_archived", "chat_projects", ["user_id", "archived"]
    )

    op.add_column(
        "chat_threads",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_chat_threads_project_id",
        "chat_threads",
        "chat_projects",
        ["project_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_chat_threads_project_id", "chat_threads", ["project_id"])
    op.create_index(
        "ix_chat_threads_user_project", "chat_threads", ["user_id", "project_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_chat_threads_user_project", table_name="chat_threads")
    op.drop_index("ix_chat_threads_project_id", table_name="chat_threads")
    op.drop_constraint("fk_chat_threads_project_id", "chat_threads", type_="foreignkey")
    op.drop_column("chat_threads", "project_id")

    op.drop_index("ix_chat_projects_user_archived", table_name="chat_projects")
    op.drop_index("ix_chat_projects_user_id", table_name="chat_projects")
    op.drop_table("chat_projects")
