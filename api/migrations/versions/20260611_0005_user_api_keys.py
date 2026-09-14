"""Add user API keys and chat thread LLM source fields.

Revision ID: 20260611_0005
Revises: 20260611_0004
Create Date: 2026-06-11
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260611_0005"
down_revision: str | None = "20260611_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "user_api_keys",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("encrypted_key", sa.Text(), nullable=False),
        sa.Column("key_last4", sa.String(4), nullable=False),
        sa.Column("is_valid", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "provider", name="uq_user_api_keys_user_provider"),
    )
    op.create_index("ix_user_api_keys_user_id", "user_api_keys", ["user_id"])
    op.create_index("ix_user_api_keys_provider", "user_api_keys", ["provider"])

    op.add_column(
        "chat_threads",
        sa.Column("llm_source", sa.String(20), nullable=False, server_default="platform"),
    )
    op.add_column("chat_threads", sa.Column("llm_provider", sa.String(50), nullable=True))
    op.add_column(
        "chat_threads",
        sa.Column(
            "user_api_key_id",
            uuid_type,
            sa.ForeignKey("user_api_keys.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_chat_threads_user_api_key_id", "chat_threads", ["user_api_key_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_threads_user_api_key_id", table_name="chat_threads")
    op.drop_column("chat_threads", "user_api_key_id")
    op.drop_column("chat_threads", "llm_provider")
    op.drop_column("chat_threads", "llm_source")

    op.drop_index("ix_user_api_keys_provider", table_name="user_api_keys")
    op.drop_index("ix_user_api_keys_user_id", table_name="user_api_keys")
    op.drop_table("user_api_keys")
