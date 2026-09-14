from typing import Any
import cloudinary
import cloudinary.uploader
import cloudinary.api
from app.core.config import settings
from app.services.storage.base import MediaStorageProvider, ProviderCapabilities

class CloudinaryMediaStorage(MediaStorageProvider):
    def __init__(self) -> None:
        if not settings.cloudinary_cloud_name or not settings.cloudinary_api_key or not settings.cloudinary_api_secret:
            raise ValueError("Cloudinary credentials are not fully configured.")
        
        cloudinary.config(
            cloud_name=settings.cloudinary_cloud_name,
            api_key=settings.cloudinary_api_key,
            api_secret=settings.cloudinary_api_secret,
            secure=True
        )

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            supports_transformations=True,
            supports_signed_urls=True,
            provider_name="cloudinary",
        )

    def upload(self, key: str, data: bytes, *, content_type: str | None = None, metadata: dict[str, Any] | None = None) -> str:
        # Cloudinary uses public_id and folder concept. We'll use the key as public_id (without extension, or with it).
        # We can pass raw data.
        response = cloudinary.uploader.upload(
            data,
            public_id=key,
            resource_type="auto",
            context=metadata if metadata else {},
        )
        return response.get("public_id", key)

    def get_url(self, key: str, *, expires: int = 3600) -> str | None:
        del expires  # Cloudinary delivery URLs are derived from the stored asset metadata.
        for resource_type in ("image", "raw", "video", "auto"):
            try:
                resource = cloudinary.api.resource(key, resource_type=resource_type)
            except Exception:
                continue
            return resource.get("secure_url") or resource.get("url")
        return None

    def delete(self, key: str) -> None:
        try:
            cloudinary.uploader.destroy(key)
        except Exception:
            pass

    def exists(self, key: str) -> bool:
        try:
            cloudinary.api.resource(key)
            return True
        except Exception:
            return False

    def transform_url(self, key: str, **kwargs: Any) -> str | None:
        options = {}
        if "width" in kwargs:
            options["width"] = kwargs["width"]
        if "height" in kwargs:
            options["height"] = kwargs["height"]
        if "crop" in kwargs:
            options["crop"] = kwargs["crop"]
        if "quality" in kwargs:
            options["quality"] = kwargs["quality"]
        if "format" in kwargs:
            options["fetch_format"] = kwargs["format"]
            
        url, _ = cloudinary.utils.cloudinary_url(key, **options)
        return url
