from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import Iterator

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import rate_limit_chat_generation
from app.models import User
from app.schemas.chat import (
    ChatAgentSummary,
    ChatAttachResponse,
    ChatContextPreviewRequest,
    ChatContextPreviewResponse,
    ChatMessageResponse,
    ChatProjectCreateRequest,
    ChatProjectResponse,
    ChatProjectUpdateRequest,
    ChatSendMessageRequest,
    ChatSendMessageResponse,
    ChatThreadCreateRequest,
    ChatThreadResponse,
    ChatThreadsBulkRequest,
    ChatThreadsBulkResponse,
    ChatThreadUpdateRequest,
)
from app.services.ai_sdk_stream import (
    AI_SDK_SSE_MEDIA_TYPE,
    data_parts_from_assistant_payload,
    iter_completed_assistant_stream,
    ui_message_stream_headers,
)
from app.services.chat import ChatGenerationError, ChatThreadNotFoundError, chat_service
from app.services.chat import ChatAttachmentError
from app.services.chat_projects import (
    ChatProjectError,
    ChatProjectNotFoundError,
    chat_projects_service,
)
from app.services.materials import FileTooLargeError, UnsupportedFileTypeError

router = APIRouter()


async def _sse_stream(chunks: Iterator[str]):
    """Yield SSE chunks and yield to the event loop so uvicorn can flush each frame."""
    for chunk in chunks:
        yield chunk
        await asyncio.sleep(0)


@router.post("/threads", response_model=ChatThreadResponse, status_code=status.HTTP_201_CREATED)
def create_thread(
    request: ChatThreadCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatThreadResponse:
    return chat_service.create_thread(
        db,
        user,
        title=request.title,
        course_id=request.course_id,
        professor_agent_id=request.professor_agent_id,
        project_id=request.project_id,
    )


@router.get("/threads", response_model=list[ChatThreadResponse])
def list_threads(
    include_archived: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatThreadResponse]:
    return chat_service.list_threads(db, user.id, include_archived=include_archived)


@router.get("/threads/{thread_id}", response_model=ChatThreadResponse)
def get_thread(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatThreadResponse:
    try:
        return chat_service.get_thread(db, user.id, thread_id)
    except ChatThreadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/threads/{thread_id}", response_model=ChatThreadResponse)
def update_thread(
    thread_id: uuid.UUID,
    request: ChatThreadUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatThreadResponse:
    try:
        payload = request.model_dump(exclude_unset=True)
        return chat_service.update_thread(
            db,
            user.id,
            thread_id,
            professor_agent_id=payload.get("professor_agent_id"),
            title=payload.get("title"),
            unset_agent="professor_agent_id" in payload and payload["professor_agent_id"] is None,
            llm_source=payload.get("llm_source"),
            llm_provider=payload.get("llm_provider"),
            user_api_key_id=payload.get("user_api_key_id"),
            pinned=payload.get("pinned"),
            archived=payload.get("archived"),
            project_id=payload.get("project_id"),
            unset_project="project_id" in payload and payload["project_id"] is None,
        )
    except ChatThreadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChatGenerationError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_thread(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    try:
        chat_service.delete_thread(db, user.id, thread_id)
    except ChatThreadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/agents", response_model=list[ChatAgentSummary])
def list_chat_agents(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ChatAgentSummary]:
    return chat_service.list_agents(db, user.id)


@router.get("/threads/{thread_id}/messages", response_model=list[ChatMessageResponse])
def list_messages(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatMessageResponse]:
    try:
        return chat_service.list_messages(db, user.id, thread_id)
    except ChatThreadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/threads/{thread_id}/messages/last-turn")
def undo_last_turn(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    try:
        return chat_service.undo_last_turn(db, user.id, thread_id)
    except ChatThreadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChatGenerationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/threads/{thread_id}/messages/last-user")
def delete_last_user_prompt(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    try:
        return chat_service.delete_last_user_prompt(db, user.id, thread_id)
    except ChatThreadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChatGenerationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/context", response_model=ChatContextPreviewResponse)
def preview_context(
    request: ChatContextPreviewRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatContextPreviewResponse:
    try:
        return chat_service.preview_context(
            db,
            user,
            request.thread_id,
            query=request.query,
            max_tokens=request.max_tokens,
        )
    except ChatThreadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/threads/{thread_id}/messages",
    response_model=ChatSendMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    thread_id: uuid.UUID,
    request: ChatSendMessageRequest,
    _rate_limit: None = Depends(rate_limit_chat_generation),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatSendMessageResponse:
    try:
        settings = (
            request.generation_settings.model_dump(exclude_none=True)
            if request.generation_settings
            else None
        )
        return chat_service.send_message(
            db,
            user,
            thread_id,
            request.content,
            request.professor_agent_id,
            settings,
            request.model,
            request.media_attachment_ids,
            request.artifact_type,
        )
    except ChatThreadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChatGenerationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.post("/threads/{thread_id}/messages/stream")
async def stream_message(
    thread_id: uuid.UUID,
    http_request: Request,
    _rate_limit: None = Depends(rate_limit_chat_generation),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    try:
        content_type = http_request.headers.get("content-type", "")
        if content_type.startswith("multipart/form-data"):
            form = await http_request.form()
            generation_settings_raw = form.get("generation_settings")
            settings = (
                json.loads(str(generation_settings_raw))
                if generation_settings_raw
                else None
            )
            content = str(form.get("content") or "").strip()
            if not content:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message content is required.")
            files = [file for file in form.getlist("files") if hasattr(file, "filename")]
            return StreamingResponse(
                _sse_stream(
                    chat_service.stream_message_with_attachments_events(
                        db,
                        user,
                        thread_id,
                        content,
                        files,  # type: ignore[arg-type]
                        uuid.UUID(str(form["professor_agent_id"])) if form.get("professor_agent_id") else None,
                        settings,
                        str(form.get("model")) if form.get("model") else None,
                    )
                ),
                media_type=AI_SDK_SSE_MEDIA_TYPE,
                headers=ui_message_stream_headers(),
            )

        payload = ChatSendMessageRequest.model_validate(await http_request.json())
        settings = payload.generation_settings.model_dump(exclude_none=True) if payload.generation_settings else None
        if payload.media_attachment_ids or payload.artifact_type:
            result = chat_service.send_message(
                db,
                user,
                thread_id,
                payload.content,
                payload.professor_agent_id,
                settings,
                payload.model,
                payload.media_attachment_ids,
                payload.artifact_type,
                llm_provider=payload.llm_provider,
            )
            return StreamingResponse(
                _sse_stream(_stream_send_result(result)),
                media_type=AI_SDK_SSE_MEDIA_TYPE,
                headers=ui_message_stream_headers(),
            )
        return StreamingResponse(
            _sse_stream(
                chat_service.stream_message_events(
                    db,
                    user,
                    thread_id,
                    payload.content,
                    payload.professor_agent_id,
                    settings,
                    payload.model,
                    payload.media_attachment_ids,
                    payload.artifact_type,
                    llm_provider=payload.llm_provider,
                )
            ),
            media_type=AI_SDK_SSE_MEDIA_TYPE,
            headers=ui_message_stream_headers(),
        )
    except json.JSONDecodeError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid generation settings.") from exc
    except ChatThreadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChatGenerationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc)) from exc
    except FileTooLargeError as exc:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc
    except ChatAttachmentError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.post("/threads/{thread_id}/messages/stream-with-attachments")
def stream_message_with_attachments(
    thread_id: uuid.UUID,
    content: str = Form(..., min_length=1, max_length=8000),
    professor_agent_id: uuid.UUID | None = Form(default=None),
    generation_settings: str | None = Form(default=None),
    model: str | None = Form(default=None),
    llm_provider: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
    _rate_limit: None = Depends(rate_limit_chat_generation),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    try:
        settings = json.loads(generation_settings) if generation_settings else None
        return StreamingResponse(
            _sse_stream(
                chat_service.stream_message_with_attachments_events(
                    db,
                    user,
                    thread_id,
                    content,
                    files,
                    professor_agent_id,
                    settings,
                    model,
                    llm_provider,
                )
            ),
            media_type=AI_SDK_SSE_MEDIA_TYPE,
            headers=ui_message_stream_headers(),
        )
    except json.JSONDecodeError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid generation settings.") from exc
    except ChatThreadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc)) from exc
    except FileTooLargeError as exc:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc
    except ChatAttachmentError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


def _stream_send_result(result: ChatSendMessageResponse):
    assistant_payload = result.assistant_message.model_dump(mode="json")
    data_parts = data_parts_from_assistant_payload(assistant_payload)
    if result.thread_title:
        data_parts.append(("thread-title", {"title": result.thread_title}))
    yield from iter_completed_assistant_stream(
        message_id=str(result.assistant_message.id),
        text=result.assistant_message.content,
        reasoning=(result.assistant_message.metadata or {}).get("reasoning")
        if result.assistant_message.metadata
        else None,
        data_parts=data_parts,
        user_payload=result.user_message.model_dump(mode="json"),
    )

@router.post(
    "/threads/{thread_id}/attach",
    response_model=ChatAttachResponse,
    status_code=status.HTTP_201_CREATED,
)
def attach_material(
    thread_id: uuid.UUID,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatAttachResponse:
    try:
        return chat_service.attach_material(db, user, thread_id, file, title)
    except ChatThreadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc)) from exc
    except FileTooLargeError as exc:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


@router.get("/projects", response_model=list[ChatProjectResponse])
def list_projects(
    include_archived: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatProjectResponse]:
    return chat_projects_service.list_projects(db, user.id, include_archived=include_archived)


@router.post("/projects", response_model=ChatProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    request: ChatProjectCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatProjectResponse:
    try:
        return chat_projects_service.create_project(
            db,
            user,
            name=request.name,
            description=request.description,
            instructions=request.instructions,
            material_ids=request.material_ids or [],
        )
    except ChatProjectError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/projects/{project_id}", response_model=ChatProjectResponse)
def get_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatProjectResponse:
    try:
        return chat_projects_service.get_project(db, user.id, project_id)
    except ChatProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/projects/{project_id}", response_model=ChatProjectResponse)
def update_project(
    project_id: uuid.UUID,
    request: ChatProjectUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatProjectResponse:
    try:
        payload = request.model_dump(exclude_unset=True)
        return chat_projects_service.update_project(
            db,
            user.id,
            project_id,
            name=payload.get("name"),
            description=payload.get("description"),
            instructions=payload.get("instructions"),
            material_ids=payload.get("material_ids"),
            starred=payload.get("starred"),
            archived=payload.get("archived"),
            unset_description="description" in payload and payload["description"] is None,
            unset_instructions="instructions" in payload and payload["instructions"] is None,
        )
    except ChatProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChatProjectError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    try:
        chat_projects_service.delete_project(db, user.id, project_id)
    except ChatProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Bulk thread actions
# ---------------------------------------------------------------------------


@router.post("/threads/bulk", response_model=ChatThreadsBulkResponse)
def bulk_threads(
    request: ChatThreadsBulkRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatThreadsBulkResponse:
    try:
        return chat_service.bulk_thread_action(
            db,
            user,
            thread_ids=request.thread_ids,
            action=request.action,
            project_id=request.project_id,
        )
    except ChatThreadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChatProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChatGenerationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
