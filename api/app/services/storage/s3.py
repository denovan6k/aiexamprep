from __future__ import annotations

import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import settings


class S3StorageBackend:
    def __init__(self, *, bucket: str) -> None:
        self.bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.media_s3_endpoint or settings.s3_endpoint_url or None,
            aws_access_key_id=settings.media_s3_access_key or settings.s3_access_key_id,
            aws_secret_access_key=settings.media_s3_secret_key or settings.s3_secret_access_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4"),
        )

    def put(
        self,
        key: str,
        data: bytes,
        *,
        content_type: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> None:
        extra: dict[str, object] = {}
        if content_type:
            extra["ContentType"] = content_type
        if metadata:
            extra["Metadata"] = metadata
        self._client.put_object(Bucket=self.bucket, Key=key, Body=data, **extra)

    def get(self, key: str) -> bytes:
        response = self._client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    def delete(self, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self.bucket, Key=key)
        except ClientError:
            pass

    def exists(self, key: str) -> bool:
        try:
            self._client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False

    def presigned_get_url(self, key: str, *, expires: int = 300) -> str | None:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires,
        )

    @contextmanager
    def open_temp_file(self, key: str) -> Generator[Path, None, None]:
        data = self.get(key)
        suffix = Path(key).suffix or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
            temp_path = Path(handle.name)
            handle.write(data)
        try:
            yield temp_path
        finally:
            temp_path.unlink(missing_ok=True)

from typing import Any
from app.services.storage.base import MediaStorageProvider, ProviderCapabilities

class S3MediaStorage(S3StorageBackend, MediaStorageProvider):
    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            supports_signed_urls=True,
            supports_streaming=True,
            provider_name="s3",
        )

    def upload(self, key: str, data: bytes, *, content_type: str | None = None, metadata: dict[str, Any] | None = None) -> str:
        self.put(
            key,
            data,
            content_type=content_type,
            metadata={str(name): str(value) for name, value in (metadata or {}).items()},
        )
        return key

    def get_url(self, key: str, *, expires: int = 3600) -> str | None:
        return self.presigned_get_url(key, expires=expires)

    def transform_url(self, key: str, **kwargs: Any) -> str | None:
        # S3 does not support transformations natively in this implementation
        return self.get_url(key)
