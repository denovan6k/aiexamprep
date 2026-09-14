"""Media storage service with multi-provider support."""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import MediaAttachment
from app.schemas.media import MediaUploadResponse
from app.services.anydoc import AnydocParser, SUPPORTED_FORMATS
from app.services.extraction import chunk_text
from app.services.storage import get_media_storage

logger = logging.getLogger(__name__)

# File validation constants
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25MB

SUPPORTED_IMAGE_TYPES = {
    "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico",
}

SUPPORTED_DOCUMENT_TYPES = SUPPORTED_FORMATS | {
    "txt", "md", "markdown",
}

SUPPORTED_FILE_TYPES = SUPPORTED_IMAGE_TYPES | SUPPORTED_DOCUMENT_TYPES


class MediaServiceError(Exception):
    """Base exception for media service errors."""


class UnsupportedMediaTypeError(MediaServiceError):
    """Raised when file type is not supported."""


class FileTooLargeError(MediaServiceError):
    """Raised when file exceeds size limit."""


class MediaNotFoundError(MediaServiceError):
    """Raised when media attachment is not found."""


def _safe_filename(name: str) -> str:
    """Sanitize filename to prevent path traversal attacks."""
    # Remove any path components
    name = Path(name).name
    # Replace unsafe characters with underscore
    name = re.sub(r"[^\w.\-]+", "_", name or "upload")
    # Prevent hidden files
    if name.startswith("."):
        name = f"file{name}"
    return name[:255]  # Limit filename length


def _get_file_extension(filename: str) -> str:
    """Extract normalized file extension."""
    ext = Path(filename).suffix.lower().lstrip(".")
    return ext


def _is_document(file_type: str) -> bool:
    """Check if file type is a document that can be parsed."""
    return file_type in SUPPORTED_DOCUMENT_TYPES


def _generate_storage_key(user_id: uuid.UUID, filename: str) -> str:
    """Generate storage key with timestamp for uniqueness."""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_name = _safe_filename(filename)
    return f"media/{user_id}/{timestamp}/{safe_name}"


class MediaService:
    """Service for handling media uploads, storage, and processing."""

    def upload_media(
        self,
        db: Session,
        user_id: uuid.UUID,
        file: UploadFile,
        metadata: dict[str, Any] | None = None,
    ) -> MediaUploadResponse:
        """
        Upload media file with validation, storage, and optional parsing.
        
        Args:
            db: Database session
            user_id: ID of the user uploading the file
            file: The uploaded file
            metadata: Optional metadata to store with the file
            
        Returns:
            MediaUploadResponse with upload details
            
        Raises:
            UnsupportedMediaTypeError: If file type is not supported
            FileTooLargeError: If file exceeds size limit
        """
        # Validate filename
        if not file.filename:
            raise MediaServiceError("Filename is required")
            
        filename = _safe_filename(file.filename)
        file_extension = _get_file_extension(filename)
        
        # Validate file type
        if file_extension not in SUPPORTED_FILE_TYPES:
            raise UnsupportedMediaTypeError(
                f"Unsupported file type: {file_extension}. "
                f"Supported types: {', '.join(sorted(SUPPORTED_FILE_TYPES))}"
            )
        
        # Read and validate file size
        file_content = file.file.read()
        file_size = len(file_content)
        
        if file_size > MAX_UPLOAD_BYTES:
            raise FileTooLargeError(
                f"File size ({file_size} bytes) exceeds maximum allowed size "
                f"({MAX_UPLOAD_BYTES} bytes, ~25MB)"
            )
        
        # Generate storage key
        storage_key = _generate_storage_key(user_id, filename)
        
        # Upload to storage provider
        storage = get_media_storage()
        provider_caps = storage.get_capabilities()
        provider_name = provider_caps.provider_name
        
        try:
            actual_key = storage.upload(
                storage_key,
                file_content,
                content_type=file.content_type,
                metadata={
                    "user_id": str(user_id),
                    "upload_date": datetime.utcnow().isoformat(timespec="seconds"),
                    **(metadata or {}),
                },
            )
        except Exception as exc:
            logger.exception("Failed to upload to storage provider: %s", exc)
            raise MediaServiceError(f"Failed to upload file: {exc}") from exc
        
        # Get media URL
        media_url = storage.get_url(actual_key) or ""
        
        # Generate thumbnail URL if supported
        thumbnail_url = None
        if file_extension in SUPPORTED_IMAGE_TYPES and provider_caps.supports_transformations:
            try:
                thumbnail_url = storage.transform_url(
                    actual_key,
                    width=200,
                    height=200,
                    crop="fill",
                    quality="auto",
                )
            except Exception as exc:
                logger.warning("Failed to generate thumbnail: %s", exc)
        
        # Parse document if applicable
        parsed_content = None
        parsing_method = None
        chunk_count = 0
        
        if _is_document(file_extension):
            try:
                parsed_content, parsing_method = self._parse_document(
                    file_content,
                    filename,
                    file_extension,
                )
                
                if parsed_content:
                    # Chunk the parsed content
                    chunks = chunk_text(
                        parsed_content,
                        max_chars=settings.material_chunk_size,
                        overlap=settings.material_chunk_overlap,
                        min_chars=getattr(settings, "material_min_chunk_size", 220),
                    )
                    chunk_count = len(chunks)
                    logger.info(
                        "Parsed document %s: %d chars, %d chunks",
                        filename,
                        len(parsed_content),
                        chunk_count,
                    )
            except Exception as exc:
                logger.warning("Failed to parse document %s: %s", filename, exc)
                # Don't fail the upload if parsing fails
        
        # Create database record
        media = MediaAttachment(
            user_id=user_id,
            storage_provider=provider_name,
            storage_key=actual_key,
            media_url=media_url,
            filename=filename,
            file_type=file_extension,
            file_size=file_size,
            parsed_content=parsed_content,
            chunk_count=chunk_count,
            parsing_method=parsing_method,
        )
        
        db.add(media)
        db.flush()
        
        return MediaUploadResponse(
            id=media.id,
            filename=media.filename,
            file_type=media.file_type,
            file_size=media.file_size,
            media_url=media.media_url,
            thumbnail_url=thumbnail_url,
            parsing_method=parsing_method,
            chunk_count=chunk_count,
        )
    
    def _parse_document(
        self,
        file_content: bytes,
        filename: str,
        file_extension: str,
    ) -> tuple[str, str]:
        """
        Parse document content using AnydocParser.
        
        Returns:
            Tuple of (parsed_text, parsing_method)
        """
        return AnydocParser.parse_document(file_content, filename, file_extension)
    
    def get_media(
        self,
        db: Session,
        user_id: uuid.UUID,
        media_id: uuid.UUID,
    ) -> MediaAttachment:
        """
        Get media attachment by ID.
        
        Args:
            db: Database session
            user_id: ID of the user (for access control)
            media_id: ID of the media attachment
            
        Returns:
            MediaAttachment model
            
        Raises:
            MediaNotFoundError: If media not found or user doesn't have access
        """
        from sqlalchemy import select
        
        media = db.scalar(
            select(MediaAttachment).where(
                MediaAttachment.id == media_id,
                MediaAttachment.user_id == user_id,
            )
        )
        
        if media is None:
            raise MediaNotFoundError(f"Media attachment {media_id} not found")
        
        return media
    
    def get_media_url(
        self,
        db: Session,
        user_id: uuid.UUID,
        media_id: uuid.UUID,
        expires: int = 3600,
    ) -> str:
        """
        Get signed/presigned URL for media access.
        
        Args:
            db: Database session
            user_id: ID of the user (for access control)
            media_id: ID of the media attachment
            expires: URL expiration time in seconds (default 1 hour)
            
        Returns:
            Signed URL for accessing the media
            
        Raises:
            MediaNotFoundError: If media not found or user doesn't have access
        """
        media = self.get_media(db, user_id, media_id)
        
        storage = get_media_storage()
        url = storage.get_url(media.storage_key, expires=expires)
        
        if not url:
            raise MediaServiceError(f"Failed to generate URL for media {media_id}")
        
        return url
    
    def delete_media(
        self,
        db: Session,
        user_id: uuid.UUID,
        media_id: uuid.UUID,
    ) -> None:
        """
        Delete media attachment.
        
        Args:
            db: Database session
            user_id: ID of the user (for access control)
            media_id: ID of the media attachment
            
        Raises:
            MediaNotFoundError: If media not found or user doesn't have access
        """
        media = self.get_media(db, user_id, media_id)
        
        # Delete from storage
        try:
            storage = get_media_storage()
            storage.delete(media.storage_key)
        except Exception as exc:
            logger.warning("Failed to delete from storage: %s", exc)
            # Continue with database deletion even if storage deletion fails
        
        # Delete from database
        db.delete(media)


media_service = MediaService()
