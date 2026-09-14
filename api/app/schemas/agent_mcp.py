from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class AgentMcpConnectionCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    server_url: str = Field(min_length=1, max_length=2048)
    transport: Literal["stdio", "sse", "streamable-http"] = "streamable-http"
    auth_type: Literal["none", "bearer", "oauth"] = "none"
    bearer_token: str | None = Field(default=None, max_length=4096)
    enabled: bool = True


class AgentMcpConnectionUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    server_url: str | None = Field(default=None, max_length=2048)
    transport: Literal["stdio", "sse", "streamable-http"] | None = None
    auth_type: Literal["none", "bearer", "oauth"] | None = None
    bearer_token: str | None = Field(default=None, max_length=4096)
    enabled: bool | None = None


class AgentMcpConnectionResponse(BaseModel):
    id: UUID
    agent_id: UUID
    name: str
    server_url: str
    transport: str
    auth_type: str
    enabled: bool
    discovered_tools: list[dict[str, Any]] | None
    oauth_expires_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AgentMcpSyncResponse(BaseModel):
    connection: AgentMcpConnectionResponse
    tool_count: int


class AgentMcpTestResponse(BaseModel):
    ok: bool
    message: str
    tool_count: int = 0


class AgentMcpOAuthStartResponse(BaseModel):
    authorization_url: str
    state: str
