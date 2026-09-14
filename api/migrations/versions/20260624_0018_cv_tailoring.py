"""Add CV documents and tailorings.

Revision ID: 20260624_0018
Revises: 20260622_0017
Create Date: 2026-06-24
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260624_0018"
down_revision: str | None = "20260613_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True)
json_type = postgresql.JSONB()


def upgrade() -> None:
    op.create_table(
        "cv_documents",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(100), nullable=True),
        sa.Column("storage_path", sa.String(1024), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(50), server_default=sa.text("'uploaded'"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_cv_documents_user_id", "cv_documents", ["user_id"])
    op.create_index("ix_cv_documents_status", "cv_documents", ["status"])
    op.create_index("ix_cv_documents_user_status", "cv_documents", ["user_id", "status"])

    op.create_table(
        "cv_tailorings",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "cv_document_id",
            uuid_type,
            sa.ForeignKey("cv_documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job_title", sa.String(255), nullable=True),
        sa.Column("company", sa.String(255), nullable=True),
        sa.Column("job_description", sa.Text(), nullable=False),
        sa.Column("tailored_sections", json_type, nullable=True),
        sa.Column("status", sa.String(50), server_default=sa.text("'queued'"), nullable=False),
        sa.Column("storage_path", sa.String(1024), nullable=True),
        sa.Column("model", sa.String(255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_cv_tailorings_user_id", "cv_tailorings", ["user_id"])
    op.create_index("ix_cv_tailorings_cv_document_id", "cv_tailorings", ["cv_document_id"])
    op.create_index("ix_cv_tailorings_status", "cv_tailorings", ["status"])
    op.create_index("ix_cv_tailorings_user_status", "cv_tailorings", ["user_id", "status"])
    op.create_index("ix_cv_tailorings_cv_created", "cv_tailorings", ["cv_document_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_cv_tailorings_cv_created", table_name="cv_tailorings")
    op.drop_index("ix_cv_tailorings_user_status", table_name="cv_tailorings")
    op.drop_index("ix_cv_tailorings_status", table_name="cv_tailorings")
    op.drop_index("ix_cv_tailorings_cv_document_id", table_name="cv_tailorings")
    op.drop_index("ix_cv_tailorings_user_id", table_name="cv_tailorings")
    op.drop_table("cv_tailorings")
    op.drop_index("ix_cv_documents_user_status", table_name="cv_documents")
    op.drop_index("ix_cv_documents_status", table_name="cv_documents")
    op.drop_index("ix_cv_documents_user_id", table_name="cv_documents")
    op.drop_table("cv_documents")
