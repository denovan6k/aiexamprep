"""Add credit grants and usage ledger tables.

Revision ID: 20260819_0026
Revises: 20260810_0025
Create Date: 2026-08-19
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260819_0026"
down_revision: str | None = "20260810_0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "credit_grants",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("credits_total", sa.Integer(), nullable=False),
        sa.Column("credits_remaining", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False, server_default=sa.text("'purchase'")),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_credit_grants_user_id", "credit_grants", ["user_id"])
    op.create_index("ix_credit_grants_expires_at", "credit_grants", ["expires_at"])
    op.create_index("ix_credit_grants_user_expires", "credit_grants", ["user_id", "expires_at"])

    op.create_table(
        "credit_usages",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "credit_grant_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("credit_grants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("credits_used", sa.Integer(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_credit_usages_user_id", "credit_usages", ["user_id"])
    op.create_index("ix_credit_usages_credit_grant_id", "credit_usages", ["credit_grant_id"])
    op.create_index("ix_credit_usages_user_created", "credit_usages", ["user_id", "created_at"])
    op.create_index("ix_credit_usages_grant_created", "credit_usages", ["credit_grant_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_credit_usages_grant_created", table_name="credit_usages")
    op.drop_index("ix_credit_usages_user_created", table_name="credit_usages")
    op.drop_index("ix_credit_usages_credit_grant_id", table_name="credit_usages")
    op.drop_index("ix_credit_usages_user_id", table_name="credit_usages")
    op.drop_table("credit_usages")

    op.drop_index("ix_credit_grants_user_expires", table_name="credit_grants")
    op.drop_index("ix_credit_grants_expires_at", table_name="credit_grants")
    op.drop_index("ix_credit_grants_user_id", table_name="credit_grants")
    op.drop_table("credit_grants")
