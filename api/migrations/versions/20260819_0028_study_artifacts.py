"""Add study_artifacts table for chat-rendered study outputs.

Revision ID: 20260819_0028
Revises: 20260819_0027
Create Date: 2026-08-19
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260819_0028"
down_revision: str | None = "20260819_0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "study_artifacts",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "thread_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("chat_threads.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("message_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column(
            "material_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("materials.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("artifact_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_study_artifacts_user_id", "study_artifacts", ["user_id"])
    op.create_index("ix_study_artifacts_thread_id", "study_artifacts", ["thread_id"])
    op.create_index("ix_study_artifacts_message_id", "study_artifacts", ["message_id"])
    op.create_index("ix_study_artifacts_material_id", "study_artifacts", ["material_id"])
    op.create_index("ix_study_artifacts_artifact_type", "study_artifacts", ["artifact_type"])
    op.create_index("ix_study_artifacts_user_type", "study_artifacts", ["user_id", "artifact_type"])


def downgrade() -> None:
    op.drop_index("ix_study_artifacts_user_type", table_name="study_artifacts")
    op.drop_index("ix_study_artifacts_artifact_type", table_name="study_artifacts")
    op.drop_index("ix_study_artifacts_material_id", table_name="study_artifacts")
    op.drop_index("ix_study_artifacts_message_id", table_name="study_artifacts")
    op.drop_index("ix_study_artifacts_thread_id", table_name="study_artifacts")
    op.drop_index("ix_study_artifacts_user_id", table_name="study_artifacts")
    op.drop_table("study_artifacts")
