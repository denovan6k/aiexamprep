"""Agent platform: avatars, intro messages, MCP connections.

Revision ID: 20260731_0022
Revises: 20260731_0021
Create Date: 2026-07-31
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260731_0022"
down_revision: str | None = "20260731_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

uuid_type = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.add_column("professor_agents", sa.Column("avatar_url", sa.String(length=1024), nullable=True))
    op.add_column("professor_agents", sa.Column("intro_message", sa.Text(), nullable=True))
    op.add_column("professor_agents", sa.Column("capabilities_summary", sa.String(length=512), nullable=True))

    op.create_table(
        "agent_mcp_connections",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("agent_id", uuid_type, sa.ForeignKey("professor_agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("server_url", sa.String(length=2048), nullable=False),
        sa.Column("transport", sa.String(length=50), nullable=False, server_default="streamable-http"),
        sa.Column("auth_type", sa.String(length=50), nullable=False, server_default="none"),
        sa.Column("auth_config_encrypted", sa.Text(), nullable=True),
        sa.Column("oauth_state", sa.String(length=255), nullable=True),
        sa.Column("oauth_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("discovered_tools", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_agent_mcp_connections_agent_id", "agent_mcp_connections", ["agent_id"])
    op.create_index("ix_agent_mcp_connections_user_id", "agent_mcp_connections", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_agent_mcp_connections_user_id", table_name="agent_mcp_connections")
    op.drop_index("ix_agent_mcp_connections_agent_id", table_name="agent_mcp_connections")
    op.drop_table("agent_mcp_connections")
    op.drop_column("professor_agents", "capabilities_summary")
    op.drop_column("professor_agents", "intro_message")
    op.drop_column("professor_agents", "avatar_url")
