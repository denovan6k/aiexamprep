from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.materials import (
    MaterialChatMessageRequest,
    MaterialChatMessageResponse,
    MaterialChatSessionCreateRequest,
    MaterialChatSessionResponse,
    MaterialReprocessResponse,
    MaterialResponse,
    MaterialStatusResponse,
    MaterialUpdateRequest,
)
from app.schemas.pagination import DEFAULT_PAGE_LIMIT, PaginatedResponse
from app.services.material_chat import (
    MaterialChatSessionNotFoundError,
    MaterialChatUnavailableError,
    material_chat_service,
)
from app.services.materials import (
    FileTooLargeError,
    MaterialNotFoundError,
    UnsupportedFileTypeError,
    materials_service,
)
from app.services.usage import enforce_limit, record_usage

router = APIRouter()


@router.get("", response_model=PaginatedResponse[MaterialResponse])
def list_materials(
    course_id: uuid.UUID | None = None,
    q: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    source: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[MaterialResponse]:
    return materials_service.list_materials(
        db,
        user.id,
        course_id=course_id,
        q=q,
        status=status_filter,
        source=source,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=MaterialResponse, status_code=status.HTTP_201_CREATED)
def upload_material(
    file: UploadFile = File(...),
    course_id: uuid.UUID | None = Form(default=None),
    title: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MaterialResponse:
    enforce_limit(db, user.id, "material_upload")
    try:
        response = materials_service.create_material(db, user.id, file, course_id, title)
        record_usage(db, user.id, "material_upload")
        db.commit()
        return response
    except UnsupportedFileTypeError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc)) from exc
    except FileTooLargeError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc


@router.get("/{material_id}/status", response_model=MaterialStatusResponse)
def get_material_status(
    material_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MaterialStatusResponse:
    try:
        return materials_service.get_material_status(db, user.id, material_id)
    except MaterialNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/{material_id}/chat/sessions",
    response_model=MaterialChatSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_material_chat_session(
    material_id: uuid.UUID,
    request: MaterialChatSessionCreateRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MaterialChatSessionResponse:
    try:
        response = material_chat_service.create_session(
            db,
            user.id,
            material_id,
            title=request.title if request else None,
        )
        db.commit()
        return response
    except MaterialNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/{material_id}/chat/sessions/{session_id}/messages",
    response_model=MaterialChatMessageResponse,
)
def send_material_chat_message(
    material_id: uuid.UUID,
    session_id: uuid.UUID,
    request: MaterialChatMessageRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MaterialChatMessageResponse:
    try:
        response = material_chat_service.send_message(
            db,
            user.id,
            material_id,
            session_id,
            request.content,
            model=request.model,
        )
        db.commit()
        return response
    except (MaterialNotFoundError, MaterialChatSessionNotFoundError) as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except MaterialChatUnavailableError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/{material_id}/download")
def download_material(
    material_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        if settings.storage_backend.strip().lower() == "s3":
            url = materials_service.create_material_download_url(db, user.id, material_id)
            return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)
        content, file_name, media_type = materials_service.read_material_file(db, user.id, material_id)
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
        )
    except MaterialNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{material_id}", response_model=MaterialResponse)
def get_material(
    material_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MaterialResponse:
    try:
        return materials_service.get_material(db, user.id, material_id)
    except MaterialNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    try:
        materials_service.delete_material(db, user.id, material_id)
        db.commit()
    except MaterialNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{material_id}", response_model=MaterialResponse)
def update_material(
    material_id: uuid.UUID,
    request: MaterialUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MaterialResponse:
    try:
        material = materials_service.update_material_title(
            db, user.id, material_id, request.title
        )
        db.commit()
        return material
    except MaterialNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{material_id}/reprocess", response_model=MaterialReprocessResponse)
def reprocess_material(
    material_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MaterialReprocessResponse:
    try:
        material = materials_service.reprocess_material(db, user.id, material_id)
        db.commit()
        return MaterialReprocessResponse(material=material, message="Material reprocessed.")
    except MaterialNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
