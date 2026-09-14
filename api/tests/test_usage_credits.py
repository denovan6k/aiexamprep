from __future__ import annotations

from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User
from app.services import credits as credits_service
from app.services.usage import enforce_limit, get_limit_for_event, record_usage, usage_history
from helpers import register_user


def _seed_usage(db: Session, user_id: UUID, event_type: str, quantity: int) -> None:
    for _ in range(quantity):
        record_usage(db, user_id, event_type)
    db.commit()


def test_enforce_limit_blocks_without_credits(db_session: Session, client: TestClient) -> None:
    _headers, user = register_user(client, email="limit-no-credits@example.com")
    user_id = UUID(user["id"])
    _seed_usage(db_session, user_id, "material_upload", 3)

    with pytest.raises(HTTPException) as exc:
        enforce_limit(db_session, user_id, "material_upload")
    assert exc.value.status_code == 402
    assert "Plan limit reached" in str(exc.value.detail)
    assert "Credits required" in str(exc.value.detail)


def test_enforce_limit_uses_credits_when_available(db_session: Session, client: TestClient) -> None:
    _headers, user = register_user(client, email="limit-with-credits@example.com")
    user_id = UUID(user["id"])
    _seed_usage(db_session, user_id, "chat_prompt", 20)
    credits_service.create_grant(db_session, user_id, credits=500, description="test top-up")
    db_session.commit()

    enforce_limit(db_session, user_id, "chat_prompt")
    db_session.commit()
    assert credits_service.balance(db_session, user_id) < 500


def test_super_admin_bypasses_plan_limits(db_session: Session, client: TestClient) -> None:
    _headers, user = register_user(client, email="super-admin-limits@example.com")
    user_id = UUID(user["id"])
    user_row = db_session.get(User, user_id)
    assert user_row is not None
    user_row.role = "super_admin"
    db_session.commit()

    _seed_usage(db_session, user_id, "material_upload", 100)
    enforce_limit(db_session, user_id, "material_upload")
    assert get_limit_for_event(db_session, user_id, "material_upload") is None


def test_usage_history_aggregates_events(db_session: Session, client: TestClient) -> None:
    headers, user = register_user(client, email="usage-history@example.com")
    user_id = UUID(user["id"])
    _seed_usage(db_session, user_id, "chat_prompt", 2)
    _seed_usage(db_session, user_id, "material_upload", 1)

    payload = usage_history(db_session, user_id, days=7)
    assert payload["days"] == 7
    assert payload["total_events"] == 3
    assert len(payload["series"]) == 7
    assert any(point["chat_prompts"] >= 2 for point in payload["series"])
    assert any(point["total"] == 1 for point in payload["by_type"] if point["event_type"] == "material_upload")

    response = client.get("/billing/usage/history?days=7", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_events"] == 3
    assert body["days"] == 7


def test_chat_media_upload_enforces_limit(client: TestClient, db_session: Session) -> None:
    headers, _user = register_user(client, email="media-limit@example.com")
    # Free tier upload limit configured to 3 in usage service.
    for idx in range(3):
        response = client.post(
            "/chat/media/upload",
            headers=headers,
            files={"file": (f"note-{idx}.txt", b"hello world", "text/plain")},
        )
        assert response.status_code == 201, response.text

    blocked = client.post(
        "/chat/media/upload",
        headers=headers,
        files={"file": ("note-4.txt", b"hello world", "text/plain")},
    )
    assert blocked.status_code == 402
    assert "Plan limit reached for material upload" in blocked.text
