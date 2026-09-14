"""Seed default billing plan catalog rows.

Revision ID: 20260819_0027
Revises: 20260819_0026
Create Date: 2026-08-19
"""

import json
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260819_0027"
down_revision: str | None = "20260819_0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FREE_LIMITS = {
    "course_create": 3,
    "material_upload": 3,
    "quiz_generation": 20,
    "flashcard_generation": 20,
    "chat_prompt": 20,
    "agent_create": 2,
    "mcp_connection_create": 5,
    "cv_upload": 5,
    "cv_tailoring": 10,
}

PLAN_CODES = ("free", "pro_monthly", "pro_yearly", "enterprise_monthly", "enterprise_yearly")

DEFAULT_PLANS: tuple[tuple[str, str, str, dict | None], ...] = (
    ("free", "Free", "none", FREE_LIMITS),
    ("pro_monthly", "Student Pro Monthly", "month", None),
    ("pro_yearly", "Student Pro Yearly", "year", None),
    ("enterprise_monthly", "Enterprise Monthly", "month", None),
    ("enterprise_yearly", "Enterprise Yearly", "year", None),
)


def upgrade() -> None:
    bind = op.get_bind()
    for code, name, interval, limits in DEFAULT_PLANS:
        exists = bind.execute(
            sa.text("SELECT 1 FROM plans WHERE code = :code"),
            {"code": code},
        ).first()
        if exists:
            continue
        limits_json = json.dumps(limits) if limits is not None else None
        bind.execute(
            sa.text(
                """
                INSERT INTO plans (
                    id, code, name, stripe_price_id, interval, limits, active, created_at, updated_at
                )
                VALUES (
                    gen_random_uuid(),
                    :code,
                    :name,
                    NULL,
                    :interval,
                    CAST(:limits AS jsonb),
                    true,
                    now(),
                    now()
                )
                """
            ),
            {"code": code, "name": name, "interval": interval, "limits": limits_json},
        )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("DELETE FROM plans WHERE code = ANY(:codes)"),
        {"codes": list(PLAN_CODES)},
    )
