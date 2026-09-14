"""Add institutions, memberships, and institution material context.

Revision ID: 20260611_0007
Revises: 20260611_0004
Create Date: 2026-06-11
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260611_0007"
down_revision: str | None = "20260611_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "institutions",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
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
    op.create_index(op.f("ix_institutions_slug"), "institutions", ["slug"], unique=True)

    op.create_table(
        "institution_memberships",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column(
            "institution_id",
            uuid_type,
            sa.ForeignKey("institutions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=50), server_default="member", nullable=False),
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
        sa.UniqueConstraint("institution_id", "user_id", name="uq_institution_memberships_user"),
    )
    op.create_index(
        op.f("ix_institution_memberships_institution_id"),
        "institution_memberships",
        ["institution_id"],
    )
    op.create_index(
        op.f("ix_institution_memberships_user_id"),
        "institution_memberships",
        ["user_id"],
    )

    op.add_column("users", sa.Column("institution_id", uuid_type, nullable=True))
    op.create_foreign_key(
        "fk_users_institution_id",
        "users",
        "institutions",
        ["institution_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_users_institution_id"), "users", ["institution_id"])

    op.add_column("materials", sa.Column("institution_id", uuid_type, nullable=True))
    op.create_foreign_key(
        "fk_materials_institution_id",
        "materials",
        "institutions",
        ["institution_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(op.f("ix_materials_institution_id"), "materials", ["institution_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_materials_institution_id"), table_name="materials")
    op.drop_constraint("fk_materials_institution_id", "materials", type_="foreignkey")
    op.drop_column("materials", "institution_id")

    op.drop_index(op.f("ix_users_institution_id"), table_name="users")
    op.drop_constraint("fk_users_institution_id", "users", type_="foreignkey")
    op.drop_column("users", "institution_id")

    op.drop_index(op.f("ix_institution_memberships_user_id"), table_name="institution_memberships")
    op.drop_index(
        op.f("ix_institution_memberships_institution_id"),
        table_name="institution_memberships",
    )
    op.drop_table("institution_memberships")

    op.drop_index(op.f("ix_institutions_slug"), table_name="institutions")
    op.drop_table("institutions")
