"""Add generation_jobs table for Redis-backed job queue.

Revision ID: 20260611_0006
Revises: 20260611_0004
Create Date: 2026-06-11
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260611_0006"
down_revision: str | None = "20260611_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True)
jsonb_type = postgresql.JSONB(astext_type=sa.Text())


def upgrade() -> None:
    op.create_table(
        "generation_jobs",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="queued"),
        sa.Column("payload", jsonb_type, nullable=True),
        sa.Column("result", jsonb_type, nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "thread_id",
            uuid_type,
            sa.ForeignKey("chat_threads.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "material_id",
            uuid_type,
            sa.ForeignKey("materials.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("message_id", uuid_type, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_generation_jobs_user_id", "generation_jobs", ["user_id"])
    op.create_index("ix_generation_jobs_status", "generation_jobs", ["status"])
    op.create_index("ix_generation_jobs_job_type", "generation_jobs", ["job_type"])
    op.create_index(
        "ix_generation_jobs_user_status",
        "generation_jobs",
        ["user_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_generation_jobs_user_status", table_name="generation_jobs")
    op.drop_index("ix_generation_jobs_job_type", table_name="generation_jobs")
    op.drop_index("ix_generation_jobs_status", table_name="generation_jobs")
    op.drop_index("ix_generation_jobs_user_id", table_name="generation_jobs")
    op.drop_table("generation_jobs")
