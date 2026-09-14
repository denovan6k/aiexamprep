from __future__ import annotations

import ipaddress
import json
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decrypt_secret, encrypt_secret
from app.models import AgentMcpConnection, ProfessorAgent, User
from app.services.usage import enforce_limit, record_usage
from app.schemas.agent_mcp import (
    AgentMcpConnectionCreateRequest,
    AgentMcpConnectionResponse,
    AgentMcpConnectionUpdateRequest,
    AgentMcpOAuthStartResponse,
    AgentMcpSyncResponse,
    AgentMcpTestResponse,
)

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 5
MCP_REQUEST_TIMEOUT = 30.0


class AgentMcpError(Exception):
    pass


def _validate_server_url(server_url: str) -> str:
    parsed = urlparse(server_url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="MCP server URL must use http or https.")
    host = parsed.hostname
    if not host:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="MCP server URL is invalid.")
    if settings.app_env != "development":
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="Private network MCP URLs are not allowed.",
                )
        except ValueError:
            pass
    return server_url.strip()


def _encrypt_auth_config(payload: dict[str, Any]) -> str:
    return encrypt_secret(json.dumps(payload), secret=settings.encryption_secret)


def _decrypt_auth_config(encrypted: str | None) -> dict[str, Any]:
    if not encrypted:
        return {}
    try:
        return json.loads(decrypt_secret(encrypted, secret=settings.encryption_secret))
    except Exception:
        return {}


def _connection_headers(connection: AgentMcpConnection) -> dict[str, str]:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if connection.auth_type == "bearer":
        config = _decrypt_auth_config(connection.auth_config_encrypted)
        token = config.get("bearer_token") or config.get("access_token")
        if token:
            headers["Authorization"] = f"Bearer {token}"
    return headers


def _mcp_jsonrpc(url: str, method: str, params: dict[str, Any] | None, headers: dict[str, str]) -> Any:
    payload = {"jsonrpc": "2.0", "id": secrets.token_hex(8), "method": method, "params": params or {}}
    with httpx.Client(timeout=MCP_REQUEST_TIMEOUT) as client:
        response = client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
    if "error" in data:
        raise AgentMcpError(str(data["error"]))
    return data.get("result")


def _to_response(connection: AgentMcpConnection) -> AgentMcpConnectionResponse:
    return AgentMcpConnectionResponse(
        id=connection.id,
        agent_id=connection.agent_id,
        name=connection.name,
        server_url=connection.server_url,
        transport=connection.transport,
        auth_type=connection.auth_type,
        enabled=connection.enabled,
        discovered_tools=connection.discovered_tools,
        oauth_expires_at=connection.oauth_expires_at,
        created_at=connection.created_at,
        updated_at=connection.updated_at,
    )


def _owned_agent(db: Session, user_id: uuid.UUID, agent_id: uuid.UUID) -> ProfessorAgent:
    agent = db.scalar(
        select(ProfessorAgent).where(ProfessorAgent.id == agent_id, ProfessorAgent.user_id == user_id)
    )
    if agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} was not found.")
    return agent


def _owned_connection(
    db: Session, user_id: uuid.UUID, agent_id: uuid.UUID, connection_id: uuid.UUID
) -> AgentMcpConnection:
    _owned_agent(db, user_id, agent_id)
    connection = db.scalar(
        select(AgentMcpConnection).where(
            AgentMcpConnection.id == connection_id,
            AgentMcpConnection.agent_id == agent_id,
            AgentMcpConnection.user_id == user_id,
        )
    )
    if connection is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="MCP connection not found.")
    return connection


def list_connections(db: Session, user_id: uuid.UUID, agent_id: uuid.UUID) -> list[AgentMcpConnectionResponse]:
    _owned_agent(db, user_id, agent_id)
    connections = db.scalars(
        select(AgentMcpConnection)
        .where(AgentMcpConnection.agent_id == agent_id, AgentMcpConnection.user_id == user_id)
        .order_by(AgentMcpConnection.created_at.desc())
    ).all()
    return [_to_response(item) for item in connections]


def create_connection(
    db: Session,
    user: User,
    agent_id: uuid.UUID,
    request: AgentMcpConnectionCreateRequest,
) -> AgentMcpConnectionResponse:
    _owned_agent(db, user.id, agent_id)
    enforce_limit(db, user.id, "mcp_connection_create")
    server_url = _validate_server_url(request.server_url)
    auth_config: dict[str, Any] = {}
    if request.auth_type == "bearer" and request.bearer_token:
        auth_config["bearer_token"] = request.bearer_token.strip()
    connection = AgentMcpConnection(
        agent_id=agent_id,
        user_id=user.id,
        name=request.name.strip(),
        server_url=server_url,
        transport=request.transport,
        auth_type=request.auth_type,
        auth_config_encrypted=_encrypt_auth_config(auth_config) if auth_config else None,
        enabled=request.enabled,
    )
    db.add(connection)
    db.flush()
    record_usage(db, user.id, "mcp_connection_create")
    db.commit()
    db.refresh(connection)
    return _to_response(connection)


def update_connection(
    db: Session,
    user_id: uuid.UUID,
    agent_id: uuid.UUID,
    connection_id: uuid.UUID,
    request: AgentMcpConnectionUpdateRequest,
) -> AgentMcpConnectionResponse:
    connection = _owned_connection(db, user_id, agent_id, connection_id)
    if request.name is not None:
        connection.name = request.name.strip()
    if request.server_url is not None:
        connection.server_url = _validate_server_url(request.server_url)
    if request.transport is not None:
        connection.transport = request.transport
    if request.auth_type is not None:
        connection.auth_type = request.auth_type
    if request.enabled is not None:
        connection.enabled = request.enabled
    if request.bearer_token is not None:
        config = _decrypt_auth_config(connection.auth_config_encrypted)
        config["bearer_token"] = request.bearer_token.strip()
        connection.auth_config_encrypted = _encrypt_auth_config(config)
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return _to_response(connection)


def delete_connection(
    db: Session, user_id: uuid.UUID, agent_id: uuid.UUID, connection_id: uuid.UUID
) -> None:
    connection = _owned_connection(db, user_id, agent_id, connection_id)
    db.delete(connection)
    db.commit()


def sync_connection_tools(
    db: Session, user_id: uuid.UUID, agent_id: uuid.UUID, connection_id: uuid.UUID
) -> AgentMcpSyncResponse:
    connection = _owned_connection(db, user_id, agent_id, connection_id)
    try:
        _mcp_jsonrpc(connection.server_url, "initialize", {"protocolVersion": "2024-11-05", "capabilities": {}}, _connection_headers(connection))
        result = _mcp_jsonrpc(connection.server_url, "tools/list", {}, _connection_headers(connection))
        tools = result.get("tools") if isinstance(result, dict) else []
        if not isinstance(tools, list):
            tools = []
        connection.discovered_tools = tools
        db.add(connection)
        db.commit()
        db.refresh(connection)
        return AgentMcpSyncResponse(connection=_to_response(connection), tool_count=len(tools))
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"MCP sync failed: {exc}") from exc


def test_connection(
    db: Session, user_id: uuid.UUID, agent_id: uuid.UUID, connection_id: uuid.UUID
) -> AgentMcpTestResponse:
    result = sync_connection_tools(db, user_id, agent_id, connection_id)
    return AgentMcpTestResponse(ok=True, message="Connection successful.", tool_count=result.tool_count)


def start_oauth_flow(
    db: Session, user_id: uuid.UUID, agent_id: uuid.UUID, connection_id: uuid.UUID, redirect_uri: str
) -> AgentMcpOAuthStartResponse:
    connection = _owned_connection(db, user_id, agent_id, connection_id)
    if connection.auth_type != "oauth":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Connection is not configured for OAuth.")
    config = _decrypt_auth_config(connection.auth_config_encrypted)
    auth_url = config.get("authorization_url")
    client_id = config.get("client_id")
    if not auth_url or not client_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="OAuth connection requires authorization_url and client_id in config.",
        )
    state = secrets.token_urlsafe(24)
    connection.oauth_state = state
    db.add(connection)
    db.commit()
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": config.get("scope", ""),
    }
    return AgentMcpOAuthStartResponse(authorization_url=f"{auth_url}?{urlencode(params)}", state=state)


def complete_oauth_callback(db: Session, state: str, code: str) -> AgentMcpConnectionResponse:
    connection = db.scalar(select(AgentMcpConnection).where(AgentMcpConnection.oauth_state == state))
    if connection is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state.")
    config = _decrypt_auth_config(connection.auth_config_encrypted)
    token_url = config.get("token_url")
    client_id = config.get("client_id")
    client_secret = config.get("client_secret")
    if not token_url or not client_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="OAuth token URL is not configured.")
    with httpx.Client(timeout=MCP_REQUEST_TIMEOUT) as client:
        response = client.post(
            token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret or "",
                "redirect_uri": config.get("redirect_uri", ""),
            },
        )
        response.raise_for_status()
        token_payload = response.json()
    config["access_token"] = token_payload.get("access_token")
    if token_payload.get("refresh_token"):
        config["refresh_token"] = token_payload.get("refresh_token")
    expires_in = token_payload.get("expires_in")
    connection.oauth_expires_at = (
        datetime.now(UTC) + timedelta(seconds=int(expires_in)) if expires_in else None
    )
    connection.auth_config_encrypted = _encrypt_auth_config(config)
    connection.oauth_state = None
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return _to_response(connection)


def mcp_tools_for_agent(db: Session, agent_id: uuid.UUID) -> list[dict[str, Any]]:
    connections = db.scalars(
        select(AgentMcpConnection).where(
            AgentMcpConnection.agent_id == agent_id,
            AgentMcpConnection.enabled.is_(True),
        )
    ).all()
    tools: list[dict[str, Any]] = []
    for connection in connections:
        for tool in connection.discovered_tools or []:
            name = tool.get("name")
            if not name:
                continue
            tools.append(
                {
                    "connection_id": str(connection.id),
                    "name": name,
                    "description": tool.get("description") or "",
                    "input_schema": tool.get("inputSchema") or tool.get("input_schema") or {"type": "object"},
                }
            )
    return tools


def openai_tools_from_agent(db: Session, agent_id: uuid.UUID) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": f"mcp_{tool['connection_id']}_{tool['name']}".replace("-", "_")[:64],
                "description": tool["description"] or f"MCP tool {tool['name']}",
                "parameters": tool["input_schema"],
                "_mcp": tool,
            },
        }
        for tool in mcp_tools_for_agent(db, agent_id)
    ]


def call_agent_tool(db: Session, agent_id: uuid.UUID, tool_meta: dict[str, Any], arguments: dict[str, Any]) -> str:
    connection = db.scalar(
        select(AgentMcpConnection).where(
            AgentMcpConnection.id == uuid.UUID(tool_meta["connection_id"]),
            AgentMcpConnection.agent_id == agent_id,
            AgentMcpConnection.enabled.is_(True),
        )
    )
    if connection is None:
        raise AgentMcpError("MCP connection not found.")
    result = _mcp_jsonrpc(
        connection.server_url,
        "tools/call",
        {"name": tool_meta["name"], "arguments": arguments},
        _connection_headers(connection),
    )
    if isinstance(result, dict):
        content = result.get("content")
        if isinstance(content, list):
            texts = [item.get("text", "") for item in content if isinstance(item, dict)]
            return "\n".join(text for text in texts if text).strip() or json.dumps(result)
        return json.dumps(result)
    return str(result)


def run_tool_loop(
    db: Session,
    agent_id: uuid.UUID | None,
    messages: list[dict[str, Any]],
    *,
    model: str | None = None,
    extra_tools: list[dict[str, Any]] | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    from app.services.headroom_compression import compress_tool_result
    from app.services.llm import llm_chat_with_tools
    from app.services.visualization_tool import (
        RENDER_VISUALIZATION_TOOL_NAME,
        execute_visualization,
        visualization_tool_result_text,
    )

    tools: list[dict[str, Any]] = []
    if agent_id is not None:
        tools.extend(openai_tools_from_agent(db, agent_id))
    if extra_tools:
        tools.extend(extra_tools)
    if not tools:
        return "", []
    tool_log: list[dict[str, Any]] = []
    working_messages = list(messages)
    for _ in range(MAX_TOOL_ITERATIONS):
        response = llm_chat_with_tools(working_messages, tools=tools, model=model)
        if not response:
            break
        tool_calls = response.get("tool_calls") or []
        content = (response.get("content") or "").strip()
        if not tool_calls:
            return content, tool_log
        working_messages.append(
            {"role": "assistant", "content": content or None, "tool_calls": tool_calls}
        )
        for call in tool_calls:
            fn = call.get("function") or {}
            fn_name = fn.get("name", "")
            args_raw = fn.get("arguments") or "{}"
            try:
                args = json.loads(args_raw) if isinstance(args_raw, str) else args_raw
            except json.JSONDecodeError:
                args = {}
            if not isinstance(args, dict):
                args = {}

            log_entry: dict[str, Any] = {"tool": fn_name, "input": args, "result": ""}

            if fn_name == RENDER_VISUALIZATION_TOOL_NAME:
                try:
                    visualization = execute_visualization(args)
                    result_text = visualization_tool_result_text(visualization)
                    log_entry["visualization"] = visualization
                except Exception as exc:
                    result_text = f"Tool error: {exc}"
            else:
                tool_meta = next(
                    (
                        item["function"]["_mcp"]
                        for item in tools
                        if item["function"]["name"] == fn_name
                        and isinstance(item["function"].get("_mcp"), dict)
                    ),
                    None,
                )
                if not tool_meta or agent_id is None:
                    result_text = "Tool not found."
                else:
                    try:
                        result_text = call_agent_tool(db, agent_id, tool_meta, args)
                    except Exception as exc:
                        result_text = f"Tool error: {exc}"

            log_entry["result"] = result_text[:2000]
            tool_log.append(log_entry)
            compressed_result = compress_tool_result(result_text, model=model)
            working_messages.append(
                {"role": "tool", "tool_call_id": call.get("id"), "content": compressed_result}
            )
    return "", tool_log
