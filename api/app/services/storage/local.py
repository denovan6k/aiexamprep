from __future__ import annotations

import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from app.core.config import settings
from app.services.storage.base import MediaStorageProvider, ProviderCapabilities


class LocalStorageBackend:
    def __init__(self, *, root: Path | None = None) -> None:
        self.root = (root or Path(settings.upload_dir)).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve_key(self, key: str) -> Path:
        if self._is_legacy_path(key):
            return Path(key)
        normalized = key.replace("\\", "/").lstrip("/")
        return self.root / normalized

    @staticmethod
    def _is_legacy_path(key: str) -> bool:
        if not key:
            return False
        path = Path(key)
        return path.is_absolute() or (len(key) > 1 and key[1] == ":")

    def put(self, key: str, data: bytes, *, content_type: str | None = None) -> None:
        path = self._resolve_key(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get(self, key: str) -> bytes:
        path = self._resolve_key(key)
        return path.read_bytes()

    def delete(self, key: str) -> None:
        path = self._resolve_key(key)
        if not path.exists():
            return
        if path.is_file():
            path.unlink()
        elif path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
        parent = path.parent
        if parent != self.root and parent.exists() and not any(parent.iterdir()):
            try:
                parent.rmdir()
            except OSError:
                pass

    def exists(self, key: str) -> bool:
        return self._resolve_key(key).exists()

    def presigned_get_url(self, key: str, *, expires: int = 300) -> str | None:
        return None

    @contextmanager
    def open_temp_file(self, key: str) -> Generator[Path, None, None]:
        path = self._resolve_key(key)
        if path.is_file():
            yield path
            return

        suffix = path.suffix or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
            temp_path = Path(handle.name)
            handle.write(self.get(key))

        try:
            yield temp_path
        finally:
            temp_path.unlink(missing_ok=True)


class LocalMediaStorage(LocalStorageBackend, MediaStorageProvider):
    """Development fallback that keeps media uploads working without cloud credentials."""

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(provider_name="local")

    def upload(self, key: str, data: bytes, *, content_type: str | None = None, metadata: dict | None = None) -> str:
        self.put(key, data, content_type=content_type)
        return key

    def get_url(self, key: str, *, expires: int = 3600) -> str | None:
        normalized = key.replace("\\", "/").lstrip("/")
        return f"{settings.public_upload_base_url.rstrip('/')}/{normalized}"

    def transform_url(self, key: str, **kwargs: object) -> str | None:
        return self.get_url(key)
