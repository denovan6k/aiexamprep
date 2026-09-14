from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AdminAuditLog, ContentReport, User
from helpers import register_user


def _super_admin_headers(client: TestClient, db_session: Session, email: str = "admin@example.com") -> dict[str, str]:
    headers, _user = register_user(client, email=email, full_name="Super Admin")
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    user.role = "super_admin"
    db_session.add(user)
    db_session.commit()
    return headers


def test_admin_requires_super_admin(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/admin/users", headers=auth_headers)
    assert response.status_code == 403


def test_admin_list_and_get_users(client: TestClient, db_session: Session) -> None:
    admin_headers = _super_admin_headers(client, db_session)
    register_user(client, email="student2@example.com", full_name="Student Two")

    list_response = client.get("/admin/users", headers=admin_headers)
    assert list_response.status_code == 200
    body = list_response.json()
    assert body["total"] >= 2
    assert len(body["items"]) >= 2

    user_id = body["items"][0]["id"]
    detail_response = client.get(f"/admin/users/{user_id}", headers=admin_headers)
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["id"] == user_id
    assert "subscription" in detail
    assert "activity" in detail


def test_admin_suspend_user_blocks_login(client: TestClient, db_session: Session) -> None:
    admin_headers = _super_admin_headers(client, db_session, email="admin2@example.com")
    student_headers, student = register_user(client, email="suspended@example.com")

    patch_response = client.patch(
        f"/admin/users/{student['id']}",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["is_active"] is False

    login_response = client.post(
        "/auth/login",
        json={"email": "suspended@example.com", "password": "correct-horse"},
    )
    assert login_response.status_code in {401, 403}

    me_response = client.get("/auth/me", headers=student_headers)
    assert me_response.status_code == 401


def test_admin_change_role(client: TestClient, db_session: Session) -> None:
    admin_headers = _super_admin_headers(client, db_session, email="admin3@example.com")
    _, student = register_user(client, email="promoted@example.com")

    patch_response = client.patch(
        f"/admin/users/{student['id']}",
        headers=admin_headers,
        json={"role": "super_admin"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["role"] == "super_admin"


def test_admin_cannot_suspend_self(client: TestClient, db_session: Session) -> None:
    admin_headers = _super_admin_headers(client, db_session, email="admin4@example.com")
    admin_user = db_session.scalar(select(User).where(User.email == "admin4@example.com"))
    assert admin_user is not None

    response = client.patch(
        f"/admin/users/{admin_user.id}",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert response.status_code == 400


def test_admin_analytics_overview(client: TestClient, db_session: Session) -> None:
    admin_headers = _super_admin_headers(client, db_session, email="admin5@example.com")
    response = client.get("/admin/analytics/overview", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert "total_users" in body
    assert "estimated_mrr_cents" in body
    assert "open_support_tickets" in body


def test_support_ticket_and_admin_queue(client: TestClient, db_session: Session) -> None:
    admin_headers = _super_admin_headers(client, db_session, email="admin6@example.com")
    student_headers, _student = register_user(client, email="ticket-user@example.com")

    create_response = client.post(
        "/support/tickets",
        headers=student_headers,
        json={
            "category": "billing",
            "subject": "Need help with billing",
            "body": "My subscription did not activate.",
        },
    )
    assert create_response.status_code == 201
    ticket_id = create_response.json()["id"]

    list_response = client.get("/admin/support/tickets?status=open", headers=admin_headers)
    assert list_response.status_code == 200
    assert any(item["id"] == ticket_id for item in list_response.json()["items"])

    update_response = client.patch(
        f"/admin/support/tickets/{ticket_id}",
        headers=admin_headers,
        json={"status": "resolved", "admin_notes": "Synced subscription manually."},
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "resolved"


def test_moderation_appeal_lifecycle(client: TestClient, db_session: Session) -> None:
    admin_headers = _super_admin_headers(client, db_session, email="admin7@example.com")
    student_headers, student = register_user(client, email="appealer@example.com")

    user = db_session.get(User, uuid.UUID(student["id"]))
    assert user is not None
    user.is_active = False
    db_session.add(user)
    db_session.commit()

    appeal_response = client.post(
        "/moderation/appeals",
        headers=student_headers,
        json={
            "appeal_type": "account_suspension",
            "reason": "I believe this suspension was a mistake.",
        },
    )
    assert appeal_response.status_code == 201
    appeal_id = appeal_response.json()["id"]

    list_response = client.get("/admin/moderation/appeals?status=pending", headers=admin_headers)
    assert list_response.status_code == 200
    assert any(item["id"] == appeal_id for item in list_response.json()["items"])

    resolve_response = client.post(
        f"/admin/moderation/appeals/{appeal_id}/resolve",
        headers=admin_headers,
        json={"status": "approved", "admin_response": "Account restored."},
    )
    assert resolve_response.status_code == 200
    assert resolve_response.json()["status"] == "approved"

    db_session.refresh(user)
    assert user.is_active is True


def test_admin_platform_reports(client: TestClient, db_session: Session) -> None:
    admin_headers = _super_admin_headers(client, db_session, email="admin8@example.com")
    register_user(client, email="reporter@example.com")

    reporter = db_session.scalar(select(User).where(User.email == "reporter@example.com"))
    assert reporter is not None

    report = ContentReport(
        reporter_id=reporter.id,
        target_type="group",
        target_id=uuid.uuid4(),
        reason="spam",
        status="open",
    )
    db_session.add(report)
    db_session.commit()
    db_session.refresh(report)

    list_response = client.get("/admin/moderation/reports?status=open", headers=admin_headers)
    assert list_response.status_code == 200
    assert any(item["id"] == str(report.id) for item in list_response.json()["items"])

    resolve_response = client.post(
        f"/admin/moderation/reports/{report.id}/resolve",
        headers=admin_headers,
        json={"status": "resolved", "notes": "Reviewed and handled."},
    )
    assert resolve_response.status_code == 200
    assert resolve_response.json()["status"] == "resolved"


def test_admin_actions_write_audit_log(client: TestClient, db_session: Session) -> None:
    admin_headers = _super_admin_headers(client, db_session, email="admin9@example.com")
    _, student = register_user(client, email="audited@example.com")

    client.patch(
        f"/admin/users/{student['id']}",
        headers=admin_headers,
        json={"role": "super_admin"},
    )

    logs = db_session.scalars(
        select(AdminAuditLog).where(
            AdminAuditLog.target_type == "user",
            AdminAuditLog.action == "user.update",
        )
    ).all()
    assert len(logs) >= 1
