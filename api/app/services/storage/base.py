from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Protocol


class StorageBackend(Protocol):
    def put(self, key: str, data: bytes, *, content_type: str | None = None) -> None:
        ...

    def get(self, key: str) -> bytes:
        ...

    def delete(self, key: str) -> None:
        ...

    def exists(self, key: str) -> bool:
        ...

    def presigned_get_url(self, key: str, *, expires: int = 300) -> str | None:
        ...

    @contextmanager
    def open_temp_file(self, key: str) -> Generator[Path, None, None]:
        ...

from dataclasses import dataclass
from typing import Any

@dataclass(frozen=True)
class ProviderCapabilities:
    supports_transformations: bool = False
    supports_signed_urls: bool = False
    supports_streaming: bool = False
    provider_name: str = "unknown"

class MediaStorageProvider(Protocol):
    def get_capabilities(self) -> ProviderCapabilities:
        ...

    def upload(self, key: str, data: bytes, *, content_type: str | None = None, metadata: dict[str, Any] | None = None) -> str:
        """Returns unique resource key or identifier"""
        ...

    def get_url(self, key: str, *, expires: int = 3600) -> str | None:
        ...

    def delete(self, key: str) -> None:
        ...

    def exists(self, key: str) -> bool:
        ...

    def transform_url(self, key: str, **kwargs: Any) -> str | None:
        ...
