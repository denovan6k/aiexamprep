from __future__ import annotations

from typing import Literal

from app.core.config import settings
from app.services.storage.base import StorageBackend
from app.services.storage.local import LocalStorageBackend

StorageScope = Literal["private", "public"]

_private_backend: StorageBackend | None = None
_public_backend: StorageBackend | None = None


def _use_s3() -> bool:
    return settings.storage_backend.strip().lower() == "s3"


def _s3_backend(*, bucket: str) -> StorageBackend:
    from app.services.storage.s3 import S3StorageBackend

    return S3StorageBackend(bucket=bucket)


def get_storage(scope: StorageScope = "private") -> StorageBackend:
    global _private_backend, _public_backend

    if _use_s3():
        if scope == "public":
            if _public_backend is None:
                _public_backend = _s3_backend(bucket=settings.s3_public_bucket)
            return _public_backend
        if _private_backend is None:
            _private_backend = _s3_backend(bucket=settings.s3_private_bucket)
        return _private_backend

    if scope == "public":
        if _public_backend is None:
            _public_backend = LocalStorageBackend()
        return _public_backend

    if _private_backend is None:
        _private_backend = LocalStorageBackend()
    return _private_backend

from app.services.storage.base import MediaStorageProvider
import logging

logger = logging.getLogger(__name__)

_media_provider: MediaStorageProvider | None = None

def get_media_storage() -> MediaStorageProvider:
    global _media_provider
    if _media_provider is not None:
        return _media_provider

    provider_type = settings.media_storage_provider.strip().lower()
    logger.info("Initializing media storage provider: %s", provider_type)

    if provider_type == "cloudinary":
        from app.services.storage.cloudinary import CloudinaryMediaStorage
        _media_provider = CloudinaryMediaStorage()
    elif provider_type == "s3":
        from app.services.storage.s3 import S3MediaStorage
        bucket = settings.media_s3_bucket or settings.s3_private_bucket
        if not bucket:
            raise ValueError("MEDIA_S3_BUCKET or S3_PRIVATE_BUCKET is required for MEDIA_STORAGE_PROVIDER=s3.")
        _media_provider = S3MediaStorage(bucket=bucket)
    elif provider_type == "local":
        from app.services.storage.local import LocalMediaStorage
        _media_provider = LocalMediaStorage()
    else:
        raise ValueError("MEDIA_STORAGE_PROVIDER must be one of: local, s3, cloudinary.")

    return _media_provider


def public_asset_url(key: str) -> str:
    normalized = key.replace("\\", "/").lstrip("/")
    if _use_s3() and settings.s3_public_base_url.strip():
        return f"{settings.s3_public_base_url.rstrip('/')}/{normalized}"
    public_base = settings.public_upload_base_url.rstrip("/")
    return f"{public_base}/{normalized}"


def material_storage_key(
    *,
    user_id: str,
    material_id: str,
    file_name: str,
    institution_id: str | None = None,
) -> str:
    if institution_id:
        return (
            f"materials/institutions/{institution_id}/{material_id}/{file_name}"
        )
    return f"materials/users/{user_id}/{material_id}/{file_name}"


def cv_storage_key(*, user_id: str, cv_id: str, file_name: str) -> str:
    return f"cvs/users/{user_id}/{cv_id}/{file_name}"


def cv_tailoring_storage_key(*, user_id: str, tailoring_id: str) -> str:
    return f"cvs/users/{user_id}/tailorings/{tailoring_id}/tailored.docx"


def reset_storage_backends_for_tests() -> None:
    global _private_backend, _public_backend
    _private_backend = None
    _public_backend = None
