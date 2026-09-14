"""Add persistent auth foundation.

Revision ID: 20260609_0002
Revises: 20260609_0001
Create Date: 2026-06-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260609_0002"
down_revision: str | None = "20260609_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


uuid_type = postgresql.UUID(as_uuid=True)


def uuid_pk() -> sa.Column:
    return sa.Column("id", uuid_type, primary_key=True, nullable=False)


def timestamps() -> tuple[sa.Column, sa.Column]:
    return (
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
    )


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True)))

    op.create_table(
        "auth_accounts",
        uuid_pk(),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_account_id", sa.String(length=255), nullable=False),
        sa.Column("provider_email", sa.String(length=320)),
        sa.Column("access_token_hash", sa.String(length=128)),
        sa.Column("refresh_token_hash", sa.String(length=128)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        *timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("provider", "provider_account_id", name="uq_auth_accounts_provider"),
    )
    op.create_index(op.f("ix_auth_accounts_provider"), "auth_accounts", ["provider"])
    op.create_index(
        op.f("ix_auth_accounts_provider_email"), "auth_accounts", ["provider_email"]
    )
    op.create_index(op.f("ix_auth_accounts_user_id"), "auth_accounts", ["user_id"])

    op.create_table(
        "auth_sessions",
        uuid_pk(),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("user_agent", sa.String(length=512)),
        sa.Column("ip_address", sa.String(length=45)),
        *timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_auth_sessions_expires_at"), "auth_sessions", ["expires_at"])
    op.create_index(op.f("ix_auth_sessions_revoked_at"), "auth_sessions", ["revoked_at"])
    op.create_index(op.f("ix_auth_sessions_token_hash"), "auth_sessions", ["token_hash"])
    op.create_index(op.f("ix_auth_sessions_user_id"), "auth_sessions", ["user_id"])

    op.create_table(
        "password_reset_tokens",
        uuid_pk(),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        *timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_password_reset_tokens_consumed_at"),
        "password_reset_tokens",
        ["consumed_at"],
    )
    op.create_index(
        op.f("ix_password_reset_tokens_expires_at"),
        "password_reset_tokens",
        ["expires_at"],
    )
    op.create_index(
        op.f("ix_password_reset_tokens_token_hash"),
        "password_reset_tokens",
        ["token_hash"],
    )
    op.create_index(
        op.f("ix_password_reset_tokens_user_id"), "password_reset_tokens", ["user_id"]
    )

    op.create_table(
        "email_verification_tokens",
        uuid_pk(),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        *timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_email_verification_tokens_consumed_at"),
        "email_verification_tokens",
        ["consumed_at"],
    )
    op.create_index(
        op.f("ix_email_verification_tokens_expires_at"),
        "email_verification_tokens",
        ["expires_at"],
    )
    op.create_index(
        op.f("ix_email_verification_tokens_token_hash"),
        "email_verification_tokens",
        ["token_hash"],
    )
    op.create_index(
        op.f("ix_email_verification_tokens_user_id"),
        "email_verification_tokens",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_table("email_verification_tokens")
    op.drop_table("password_reset_tokens")
    op.drop_table("auth_sessions")
    op.drop_table("auth_accounts")
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "is_active")
