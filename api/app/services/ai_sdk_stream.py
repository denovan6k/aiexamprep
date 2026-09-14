"""AI SDK UI message stream (SSE) helpers for FastAPI responses."""
from __future__ import annotations

import json
import uuid
from collections.abc import Iterator, Mapping
from typing import Any

AI_SDK_UI_MESSAGE_STREAM_HEADER = "x-ai-ui-stream"
AI_SDK_UI_MESSAGE_STREAM_VERSION = "v1"
# Official AI SDK header (kept for clients/proxies that expect it).
AI_SDK_UI_MESSAGE_STREAM_HEADER_COMPAT = "x-vercel-ai-ui-message-stream"
AI_SDK_SSE_MEDIA_TYPE = "text/event-stream"


def sse_data(payload: Mapping[str, Any] | str) -> str:
    if isinstance(payload, str):
        body = payload
    else:
        body = json.dumps(payload, default=str, separators=(",", ":"))
    return f"data: {body}\n\n"


def sse_done() -> str:
    return sse_data("[DONE]")


def sse_status(message: str) -> str:
    return sse_data({"type": "data-status", "data": {"message": message}})


def new_message_id() -> str:
    return str(uuid.uuid4())


def new_part_id(prefix: str = "part") -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def iter_tool_status_events(tool_log: list[dict[str, Any]]) -> Iterator[str]:
    """Emit AI SDK-compatible tool lifecycle events for MCP tool invocations."""
    for entry in tool_log:
        tool_call_id = new_part_id("tool")
        tool_name = str(entry.get("tool") or "mcp_tool")
        yield sse_data(
            {
                "type": "tool-input-start",
                "toolCallId": tool_call_id,
                "toolName": tool_name,
                "providerExecuted": True,
            }
        )
        tool_input = entry.get("input")
        if isinstance(tool_input, dict):
            # Avoid streaming huge HTML / frame blobs in tool-input events (breaks SSE clients).
            safe_input = _truncate_tool_input_for_stream(tool_input)
            yield sse_data(
                {
                    "type": "tool-input-available",
                    "toolCallId": tool_call_id,
                    "toolName": tool_name,
                    "input": safe_input,
                    "providerExecuted": True,
                }
            )
        output: dict[str, Any] = {"result": entry.get("result", "")}
        if entry.get("visualization"):
            output["has_visualization"] = True
        yield sse_data(
            {
                "type": "tool-output-available",
                "toolCallId": tool_call_id,
                "output": output,
                "providerExecuted": True,
            }
        )


def _truncate_tool_input_for_stream(tool_input: dict[str, Any]) -> dict[str, Any]:
    safe_input = dict(tool_input)
    html_value = safe_input.get("html")
    if isinstance(html_value, str) and len(html_value) > 400:
        safe_input["html"] = f"{html_value[:400]}…[truncated]"
    frames = safe_input.get("frames")
    if isinstance(frames, list):
        slim_frames: list[Any] = []
        for item in frames[:8]:
            if not isinstance(item, dict):
                continue
            slim = {"message": str(item.get("message") or "")[:120]}
            frame_html = item.get("html")
            if isinstance(frame_html, str) and frame_html:
                slim["html"] = (
                    frame_html if len(frame_html) <= 200 else f"{frame_html[:200]}…[truncated]"
                )
            if "array" in item:
                slim["array"] = item.get("array")
            slim_frames.append(slim)
        if len(frames) > 8:
            slim_frames.append({"message": f"…+{len(frames) - 8} more shots"})
        safe_input["frames"] = slim_frames
    return safe_input


def iter_display_deltas(text: str, *, chunk_size: int = 24) -> Iterator[str]:
    """Split a completed reply into readable SSE deltas for progressive rendering."""
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        if end < len(text):
            boundary = text.rfind(" ", start, end + 1)
            if boundary > start:
                end = boundary + 1
        yield text[start:end]
        start = end


def ui_message_stream_headers() -> dict[str, str]:
    return {
        AI_SDK_UI_MESSAGE_STREAM_HEADER: AI_SDK_UI_MESSAGE_STREAM_VERSION,
        AI_SDK_UI_MESSAGE_STREAM_HEADER_COMPAT: AI_SDK_UI_MESSAGE_STREAM_VERSION,
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }


def data_parts_from_assistant_payload(payload: Mapping[str, Any]) -> list[tuple[str, Any]]:
    """Map a persisted assistant ChatMessage JSON payload to AI SDK data-* parts."""
    parts: list[tuple[str, Any]] = []
    metadata = payload.get("metadata") or {}
    event = metadata.get("event")

    if payload.get("quiz") is not None or metadata.get("quiz_preview") is not None:
        parts.append(
            (
                "quiz",
                {
                    "quiz": payload.get("quiz"),
                    "quiz_id": payload.get("quiz_id"),
                    "quiz_preview": metadata.get("quiz_preview"),
                    "question_count": metadata.get("question_count"),
                },
            )
        )

    if metadata.get("deck_id") is not None or metadata.get("flashcard_preview") is not None:
        parts.append(
            (
                "flashcards",
                {
                    "deck_id": metadata.get("deck_id"),
                    "flashcard_preview": metadata.get("flashcard_preview"),
                    "card_count": metadata.get("card_count"),
                },
            )
        )

    if event in {"generation_queued", "generation_completed", "generation_failed"} or metadata.get("job_id"):
        parts.append(
            (
                "generation",
                {
                    "event": event,
                    "job_id": metadata.get("job_id"),
                    "status": metadata.get("status"),
                    "progress_stage": metadata.get("progress_stage"),
                    "generation_type": metadata.get("generation_type"),
                },
            )
        )
        if metadata.get("progress_stage"):
            parts.append(
                (
                    "generation-progress",
                    {
                        "stage": metadata.get("progress_stage"),
                        "label": metadata.get("progress_label"),
                        "job_id": metadata.get("job_id"),
                    },
                )
            )

    if event == "artifact_choice" or metadata.get("choices"):
        parts.append(
            (
                "artifact-choice",
                {
                    "event": event,
                    "choices": metadata.get("choices"),
                    "attachment_names": metadata.get("attachment_names"),
                },
            )
        )

    if metadata.get("artifact_id") or metadata.get("artifact_preview"):
        parts.append(
            (
                "artifact",
                {
                    "artifact_id": metadata.get("artifact_id"),
                    "artifact_type": metadata.get("artifact_type"),
                    "artifact_title": metadata.get("artifact_title"),
                    "artifact_preview": metadata.get("artifact_preview"),
                },
            )
        )

    if event in {"material_attached", "material_failed", "material_processing", "material_queued"} or metadata.get(
        "material"
    ):
        parts.append(
            (
                "material",
                {
                    "event": event,
                    "material": metadata.get("material"),
                    "materials": metadata.get("materials"),
                    "attachments": metadata.get("attachments"),
                    "error": metadata.get("error"),
                },
            )
        )

    if event == "request_failed" or metadata.get("degradation_reason") is not None:
        parts.append(
            (
                "error",
                {
                    "event": event,
                    "degradation_reason": metadata.get("degradation_reason"),
                    "error": metadata.get("error"),
                },
            )
        )

    if event == "agent_switched":
        parts.append(
            (
                "agent",
                {
                    "event": event,
                    "agent_id": metadata.get("agent_id"),
                },
            )
        )

    visualization = metadata.get("visualization")
    if isinstance(visualization, dict) and visualization:
        parts.append(("visualization", visualization))

    parts.append(
        (
            "message",
            {
                "id": payload.get("id"),
                "thread_id": payload.get("thread_id"),
                "role": payload.get("role"),
                "content": payload.get("content"),
                "quiz_id": payload.get("quiz_id"),
                "material_id": payload.get("material_id"),
                "metadata": metadata,
                "quiz": payload.get("quiz"),
                "created_at": payload.get("created_at"),
            },
        )
    )
    return parts


def iter_completed_assistant_stream(
    *,
    message_id: str | None = None,
    text: str | None = None,
    reasoning: str | None = None,
    data_parts: list[tuple[str, Any]] | None = None,
    user_payload: Mapping[str, Any] | None = None,
) -> Iterator[str]:
    """Emit a finished assistant turn as an AI SDK UI message SSE stream."""
    assistant_id = message_id or new_message_id()
    yield sse_data({"type": "start", "messageId": assistant_id})
    yield sse_data({"type": "start-step"})

    if user_payload is not None:
        yield sse_data({"type": "data-user", "data": dict(user_payload)})

    if reasoning:
        reasoning_id = new_part_id("reasoning")
        yield sse_data({"type": "reasoning-start", "id": reasoning_id})
        for delta in iter_display_deltas(reasoning):
            yield sse_data({"type": "reasoning-delta", "id": reasoning_id, "delta": delta})
        yield sse_data({"type": "reasoning-end", "id": reasoning_id})

    if text:
        text_id = new_part_id("text")
        yield sse_data({"type": "text-start", "id": text_id})
        for delta in iter_display_deltas(text):
            yield sse_data({"type": "text-delta", "id": text_id, "delta": delta})
        yield sse_data({"type": "text-end", "id": text_id})

    for part_name, part_data in data_parts or []:
        yield sse_data({"type": f"data-{part_name}", "data": part_data})

    yield sse_data({"type": "finish-step"})
    yield sse_data({"type": "finish"})
    yield sse_done()
