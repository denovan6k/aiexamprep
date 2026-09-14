"""Promote material chunk embeddings to pgvector.

Revision ID: 20260613_0013
Revises: 20260612_0012
Create Date: 2026-06-13
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260613_0013"
down_revision: str | None = "20260612_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute(
        """
        ALTER TABLE material_chunks
        ALTER COLUMN embedding TYPE vector(1536)
        USING CASE
            WHEN embedding IS NULL THEN NULL
            ELSE embedding::text::vector(1536)
        END
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_material_chunks_embedding_cosine
        ON material_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute("DROP INDEX IF EXISTS ix_material_chunks_embedding_cosine")
    op.execute(
        """
        ALTER TABLE material_chunks
        ALTER COLUMN embedding TYPE jsonb
        USING NULL
        """
    )
