import pytest

from app.core.config import settings
from app.services.storage import (
    get_storage,
    material_storage_key,
    public_asset_url,
    reset_storage_backends_for_tests,
)


@pytest.fixture(autouse=True)
def _reset_storage() -> None:
    reset_storage_backends_for_tests()
    yield
    reset_storage_backends_for_tests()


def test_local_storage_round_trip(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "storage_backend", "local")
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))

    storage = get_storage("private")
    key = material_storage_key(
        user_id="user-1",
        material_id="mat-1",
        file_name="notes.txt",
    )
    storage.put(key, b"hello storage", content_type="text/plain")
    assert storage.exists(key)
    assert storage.get(key) == b"hello storage"

    with storage.open_temp_file(key) as path:
        assert path.read_bytes() == b"hello storage"

    storage.delete(key)
    assert not storage.exists(key)


def test_local_storage_legacy_absolute_path(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "storage_backend", "local")
    legacy = tmp_path / "legacy.txt"
    legacy.write_text("legacy content", encoding="utf-8")

    storage = get_storage("private")
    with storage.open_temp_file(str(legacy)) as path:
        assert path.read_text(encoding="utf-8") == "legacy content"


def test_public_asset_url_local(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "storage_backend", "local")
    monkeypatch.setattr(settings, "public_upload_base_url", "/uploads")
    assert public_asset_url("blog/cover.png") == "/uploads/blog/cover.png"


def test_public_asset_url_s3(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "storage_backend", "s3")
    monkeypatch.setattr(settings, "s3_public_base_url", "https://assets.example.com")
    assert public_asset_url("blog/cover.png") == "https://assets.example.com/blog/cover.png"


def test_material_download_local(client, tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    from conftest import register_user

    monkeypatch.setattr(settings, "storage_backend", "local")
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))

    headers, _user = register_user(client, email="download-local@example.com")
    create_response = client.post(
        "/materials",
        headers=headers,
        files={
            "file": (
                "download-me.txt",
                b"Download this study note.",
                "text/plain",
            )
        },
    )
    assert create_response.status_code == 201
    material_id = create_response.json()["id"]

    download_response = client.get(f"/materials/{material_id}/download", headers=headers)
    assert download_response.status_code == 200
    assert download_response.content == b"Download this study note."
    assert "download-me.txt" in download_response.headers.get("content-disposition", "")


def test_material_download_requires_auth(client, tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    from conftest import register_user

    monkeypatch.setattr(settings, "storage_backend", "local")
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))

    headers, _user = register_user(client, email="download-auth@example.com")
    create_response = client.post(
        "/materials",
        headers=headers,
        files={"file": ("secret.txt", b"private", "text/plain")},
    )
    material_id = create_response.json()["id"]

    other_headers, _ = register_user(client, email="download-other@example.com")
    forbidden = client.get(f"/materials/{material_id}/download", headers=other_headers)
    assert forbidden.status_code == 404

    anonymous = client.get(f"/materials/{material_id}/download")
    assert anonymous.status_code == 401
