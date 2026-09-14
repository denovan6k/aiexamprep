"""Admin platform: support tickets, moderation appeals, audit logs, plan pricing.

Revision ID: 20260802_0023
Revises: 20260731_0022
Create Date: 2026-08-02
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260802_0023"
down_revision: str | None = "20260731_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.add_column("plans", sa.Column("price_cents", sa.Integer(), nullable=True))

    op.create_table(
        "support_tickets",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False, server_default="general"),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="open"),
        sa.Column("priority", sa.String(length=50), nullable=False, server_default="normal"),
        sa.Column(
            "assigned_admin_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_support_tickets_user_id", "support_tickets", ["user_id"])
    op.create_index("ix_support_tickets_status", "support_tickets", ["status"])
    op.create_index("ix_support_tickets_user_status", "support_tickets", ["user_id", "status"])
    op.create_index("ix_support_tickets_assigned_admin_id", "support_tickets", ["assigned_admin_id"])

    op.create_table(
        "moderation_appeals",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("appeal_type", sa.String(length=50), nullable=False),
        sa.Column("reference_type", sa.String(length=50), nullable=True),
        sa.Column("reference_id", uuid_type, nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column(
            "reviewed_by_user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("admin_response", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_moderation_appeals_user_id", "moderation_appeals", ["user_id"])
    op.create_index("ix_moderation_appeals_status", "moderation_appeals", ["status"])
    op.create_index("ix_moderation_appeals_user_status", "moderation_appeals", ["user_id", "status"])

    op.create_table(
        "admin_audit_logs",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("admin_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=False),
        sa.Column("target_id", uuid_type, nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_admin_audit_logs_admin_user_id", "admin_audit_logs", ["admin_user_id"])
    op.create_index("ix_admin_audit_logs_admin_created", "admin_audit_logs", ["admin_user_id", "created_at"])
    op.create_index("ix_admin_audit_logs_target", "admin_audit_logs", ["target_type", "target_id"])


def downgrade() -> None:
    op.drop_index("ix_admin_audit_logs_target", table_name="admin_audit_logs")
    op.drop_index("ix_admin_audit_logs_admin_created", table_name="admin_audit_logs")
    op.drop_index("ix_admin_audit_logs_admin_user_id", table_name="admin_audit_logs")
    op.drop_table("admin_audit_logs")

    op.drop_index("ix_moderation_appeals_user_status", table_name="moderation_appeals")
    op.drop_index("ix_moderation_appeals_status", table_name="moderation_appeals")
    op.drop_index("ix_moderation_appeals_user_id", table_name="moderation_appeals")
    op.drop_table("moderation_appeals")

    op.drop_index("ix_support_tickets_assigned_admin_id", table_name="support_tickets")
    op.drop_index("ix_support_tickets_user_status", table_name="support_tickets")
    op.drop_index("ix_support_tickets_status", table_name="support_tickets")
    op.drop_index("ix_support_tickets_user_id", table_name="support_tickets")
    op.drop_table("support_tickets")

    op.drop_column("plans", "price_cents")
