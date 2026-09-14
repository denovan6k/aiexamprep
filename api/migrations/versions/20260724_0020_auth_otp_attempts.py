"""Add attempt counters for authentication OTP challenges.

Revision ID: 20260724_0020
Revises: 20260720_0019
Create Date: 2026-07-24
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260724_0020"
down_revision: str | None = "20260720_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "password_reset_tokens",
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "email_verification_tokens",
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("email_verification_tokens", "attempt_count")
    op.drop_column("password_reset_tokens", "attempt_count")
