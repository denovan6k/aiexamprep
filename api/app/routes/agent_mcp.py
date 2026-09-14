from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.agent_mcp import (
    AgentMcpConnectionCreateRequest,
    AgentMcpConnectionResponse,
    AgentMcpConnectionUpdateRequest,
    AgentMcpOAuthStartResponse,
    AgentMcpSyncResponse,
    AgentMcpTestResponse,
)
from app.services import agent_mcp as agent_mcp_service

router = APIRouter()


@router.get("/{agent_id}/mcp-connections", response_model=list[AgentMcpConnectionResponse])
def list_mcp_connections(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AgentMcpConnectionResponse]:
    return agent_mcp_service.list_connections(db, user.id, agent_id)


@router.post(
    "/{agent_id}/mcp-connections",
    response_model=AgentMcpConnectionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_mcp_connection(
    agent_id: uuid.UUID,
    request: AgentMcpConnectionCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentMcpConnectionResponse:
    return agent_mcp_service.create_connection(db, user, agent_id, request)


@router.patch(
    "/{agent_id}/mcp-connections/{connection_id}",
    response_model=AgentMcpConnectionResponse,
)
def update_mcp_connection(
    agent_id: uuid.UUID,
    connection_id: uuid.UUID,
    request: AgentMcpConnectionUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentMcpConnectionResponse:
    return agent_mcp_service.update_connection(db, user.id, agent_id, connection_id, request)


@router.delete(
    "/{agent_id}/mcp-connections/{connection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_mcp_connection(
    agent_id: uuid.UUID,
    connection_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    agent_mcp_service.delete_connection(db, user.id, agent_id, connection_id)


@router.post(
    "/{agent_id}/mcp-connections/{connection_id}/sync",
    response_model=AgentMcpSyncResponse,
)
def sync_mcp_connection(
    agent_id: uuid.UUID,
    connection_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentMcpSyncResponse:
    return agent_mcp_service.sync_connection_tools(db, user.id, agent_id, connection_id)


@router.post(
    "/{agent_id}/mcp-connections/{connection_id}/test",
    response_model=AgentMcpTestResponse,
)
def test_mcp_connection(
    agent_id: uuid.UUID,
    connection_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentMcpTestResponse:
    return agent_mcp_service.test_connection(db, user.id, agent_id, connection_id)


@router.post(
    "/{agent_id}/mcp-connections/{connection_id}/oauth/start",
    response_model=AgentMcpOAuthStartResponse,
)
def start_mcp_oauth(
    agent_id: uuid.UUID,
    connection_id: uuid.UUID,
    redirect_uri: str = Query(min_length=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentMcpOAuthStartResponse:
    return agent_mcp_service.start_oauth_flow(db, user.id, agent_id, connection_id, redirect_uri)


@router.get("/mcp/oauth/callback", response_model=AgentMcpConnectionResponse)
def mcp_oauth_callback(
    state: str = Query(min_length=1),
    code: str = Query(min_length=1),
    db: Session = Depends(get_db),
) -> AgentMcpConnectionResponse:
    return agent_mcp_service.complete_oauth_callback(db, state, code)
