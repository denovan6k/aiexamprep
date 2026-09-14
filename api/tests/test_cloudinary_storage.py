from __future__ import annotations

from unittest.mock import patch

from app.services.storage.cloudinary import CloudinaryMediaStorage


def test_cloudinary_get_url_uses_resource_secure_url(monkeypatch) -> None:
    storage = CloudinaryMediaStorage.__new__(CloudinaryMediaStorage)

    with patch(
        "app.services.storage.cloudinary.cloudinary.api.resource",
        return_value={
            "secure_url": (
                "https://res.cloudinary.com/demo/image/upload/v1/media/user/photo.png.png"
            )
        },
    ) as mocked_resource:
        url = storage.get_url("media/user/photo.png")

    mocked_resource.assert_called_once_with("media/user/photo.png", resource_type="image")
    assert url == "https://res.cloudinary.com/demo/image/upload/v1/media/user/photo.png.png"
