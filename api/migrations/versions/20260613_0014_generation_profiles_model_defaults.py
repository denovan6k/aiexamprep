"""Add generation profiles and user model defaults.

Revision ID: 20260613_0014
Revises: 20260613_0013
Create Date: 2026-06-13
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260613_0014"
down_revision: str | None = "20260613_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True)
json_type = postgresql.JSONB()


def upgrade() -> None:
    op.add_column("users", sa.Column("default_chat_model", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("default_generation_model", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("default_embedding_model", sa.String(255), nullable=True))

    op.create_table(
        "generation_profiles",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("prompt_template", sa.Text(), nullable=False),
        sa.Column(
            "apply_on_upload",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("output_type", sa.String(50), nullable=False),
        sa.Column("metadata", json_type, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_generation_profiles_user_id", "generation_profiles", ["user_id"])
    op.create_index("ix_generation_profiles_output_type", "generation_profiles", ["output_type"])
    op.create_index(
        "ix_generation_profiles_user_upload",
        "generation_profiles",
        ["user_id", "apply_on_upload"],
    )

    op.create_table(
        "material_insights",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("material_id", uuid_type, sa.ForeignKey("materials.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "generation_profile_id",
            uuid_type,
            sa.ForeignKey("generation_profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("insight_type", sa.String(50), server_default=sa.text("'summary'"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("metadata", json_type, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_material_insights_material_id", "material_insights", ["material_id"])
    op.create_index("ix_material_insights_user_id", "material_insights", ["user_id"])
    op.create_index(
        "ix_material_insights_generation_profile_id",
        "material_insights",
        ["generation_profile_id"],
    )
    op.create_index(
        "ix_material_insights_material_type",
        "material_insights",
        ["material_id", "insight_type"],
    )

    op.add_column("quizzes", sa.Column("material_id", uuid_type, nullable=True))
    op.add_column("quizzes", sa.Column("generation_profile_id", uuid_type, nullable=True))
    op.create_foreign_key(
        "fk_quizzes_material_id_materials",
        "quizzes",
        "materials",
        ["material_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_quizzes_generation_profile_id_generation_profiles",
        "quizzes",
        "generation_profiles",
        ["generation_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_quizzes_material_id", "quizzes", ["material_id"])
    op.create_index("ix_quizzes_generation_profile_id", "quizzes", ["generation_profile_id"])

    op.add_column("flashcard_decks", sa.Column("material_id", uuid_type, nullable=True))
    op.add_column("flashcard_decks", sa.Column("generation_profile_id", uuid_type, nullable=True))
    op.create_foreign_key(
        "fk_flashcard_decks_material_id_materials",
        "flashcard_decks",
        "materials",
        ["material_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_flashcard_decks_generation_profile_id_generation_profiles",
        "flashcard_decks",
        "generation_profiles",
        ["generation_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_flashcard_decks_material_id", "flashcard_decks", ["material_id"])
    op.create_index(
        "ix_flashcard_decks_generation_profile_id",
        "flashcard_decks",
        ["generation_profile_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_flashcard_decks_generation_profile_id", table_name="flashcard_decks")
    op.drop_index("ix_flashcard_decks_material_id", table_name="flashcard_decks")
    op.drop_constraint(
        "fk_flashcard_decks_generation_profile_id_generation_profiles",
        "flashcard_decks",
        type_="foreignkey",
    )
    op.drop_constraint("fk_flashcard_decks_material_id_materials", "flashcard_decks", type_="foreignkey")
    op.drop_column("flashcard_decks", "generation_profile_id")
    op.drop_column("flashcard_decks", "material_id")

    op.drop_index("ix_quizzes_generation_profile_id", table_name="quizzes")
    op.drop_index("ix_quizzes_material_id", table_name="quizzes")
    op.drop_constraint(
        "fk_quizzes_generation_profile_id_generation_profiles",
        "quizzes",
        type_="foreignkey",
    )
    op.drop_constraint("fk_quizzes_material_id_materials", "quizzes", type_="foreignkey")
    op.drop_column("quizzes", "generation_profile_id")
    op.drop_column("quizzes", "material_id")

    op.drop_index("ix_material_insights_material_type", table_name="material_insights")
    op.drop_index("ix_material_insights_generation_profile_id", table_name="material_insights")
    op.drop_index("ix_material_insights_user_id", table_name="material_insights")
    op.drop_index("ix_material_insights_material_id", table_name="material_insights")
    op.drop_table("material_insights")

    op.drop_index("ix_generation_profiles_user_upload", table_name="generation_profiles")
    op.drop_index("ix_generation_profiles_output_type", table_name="generation_profiles")
    op.drop_index("ix_generation_profiles_user_id", table_name="generation_profiles")
    op.drop_table("generation_profiles")

    op.drop_column("users", "default_embedding_model")
    op.drop_column("users", "default_generation_model")
    op.drop_column("users", "default_chat_model")
