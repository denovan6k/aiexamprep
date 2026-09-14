"""Add chat thread and message tables.

Revision ID: 20260611_0003
Revises: 20260609_0002
Create Date: 2026-06-11
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260611_0003"
down_revision: str | None = "20260609_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "chat_threads",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False, server_default="New chat"),
        sa.Column("course_id", uuid_type, sa.ForeignKey("courses.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "professor_agent_id",
            uuid_type,
            sa.ForeignKey("professor_agents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "material_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_chat_threads_user_id", "chat_threads", ["user_id"])
    op.create_index("ix_chat_threads_course_id", "chat_threads", ["course_id"])
    op.create_index("ix_chat_threads_professor_agent_id", "chat_threads", ["professor_agent_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column(
            "thread_id",
            uuid_type,
            sa.ForeignKey("chat_threads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("quiz_id", uuid_type, sa.ForeignKey("quizzes.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "material_id",
            uuid_type,
            sa.ForeignKey("materials.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_chat_messages_thread_id", "chat_messages", ["thread_id"])
    op.create_index("ix_chat_messages_quiz_id", "chat_messages", ["quiz_id"])
    op.create_index("ix_chat_messages_material_id", "chat_messages", ["material_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_material_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_quiz_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_thread_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_chat_threads_professor_agent_id", table_name="chat_threads")
    op.drop_index("ix_chat_threads_course_id", table_name="chat_threads")
    op.drop_index("ix_chat_threads_user_id", table_name="chat_threads")
    op.drop_table("chat_threads")
