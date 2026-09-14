"""Replace is_super_admin boolean with users.role.

Revision ID: 20260612_0009
Revises: 20260612_0008
Create Date: 2026-06-12
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260612_0009"
down_revision: str | None = "20260612_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=50), server_default=sa.text("'user'"), nullable=False),
    )
    op.create_index("ix_users_role", "users", ["role"])
    op.execute("UPDATE users SET role = 'super_admin' WHERE is_super_admin = true")
    op.drop_column("users", "is_super_admin")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_super_admin", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.execute("UPDATE users SET is_super_admin = true WHERE role = 'super_admin'")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "role")
