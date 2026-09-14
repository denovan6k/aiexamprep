"""Media upload and management API routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.media import MediaAttachmentResponse, MediaUploadResponse, StorageCapabilitiesResponse
from app.services.media import (
    FileTooLargeError,
    MediaNotFoundError,
    MediaServiceError,
    UnsupportedMediaTypeError,
    media_service,
)
from app.services.storage import get_media_storage
from app.services.usage import enforce_limit, record_usage

router = APIRouter()


@router.get("/capabilities", response_model=StorageCapabilitiesResponse)
def storage_capabilities() -> StorageCapabilitiesResponse:
    """Expose the active provider features for clients that need to tailor their UI."""
    try:
        return StorageCapabilitiesResponse.model_validate(get_media_storage().get_capabilities())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/upload", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_media(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MediaUploadResponse:
    """
    Upload a media file (image or document).
    
    Supported image formats: jpg, jpeg, png, gif, webp, svg, bmp, ico
    Supported document formats: pdf, doc, docx, ppt, pptx, xls, xlsx, txt, md, csv, etc.
    
    Maximum file size: 25MB
    
    Documents will be automatically parsed and chunked for search/retrieval.
    Images on Cloudinary will have thumbnail URLs generated.
    """
    enforce_limit(db, user.id, "material_upload")
    try:
        response = media_service.upload_media(db, user.id, file)
        record_usage(db, user.id, "material_upload")
        db.commit()
        return response
    except UnsupportedMediaTypeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(exc),
        ) from exc
    except FileTooLargeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(exc),
        ) from exc
    except MediaServiceError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.get("/{media_id}", response_model=MediaAttachmentResponse)
def get_media_metadata(
    media_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MediaAttachmentResponse:
    """
    Get metadata for a media attachment.
    
    Returns information about the file including:
    - File type, size, filename
    - Storage provider and location
    - Parsed content (for documents)
    - Chunk count (for documents)
    """
    try:
        media = media_service.get_media(db, user.id, media_id)
        return MediaAttachmentResponse.model_validate(media)
    except MediaNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get("/{media_id}/url", response_model=dict[str, str])
def get_media_access_url(
    media_id: uuid.UUID,
    expires: int = 3600,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """
    Get a signed/presigned URL for accessing the media file.
    
    The URL will be valid for the specified expiration time (default 1 hour).
    
    For S3-based storage, this returns a presigned URL.
    For Cloudinary, this returns a signed URL.
    """
    try:
        url = media_service.get_media_url(db, user.id, media_id, expires=expires)
        return {"url": url}
    except MediaNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except MediaServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(
    media_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """
    Delete a media attachment.
    
    This removes the file from storage and deletes the database record.
    """
    try:
        media_service.delete_media(db, user.id, media_id)
        db.commit()
    except MediaNotFoundError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
