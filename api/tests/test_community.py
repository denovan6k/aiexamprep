from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models.entities import (
    AuthAccount,
    AuthSession,
    Base,
    CommunityGroup,
    CommunityMembership,
    CommunityNotification,
    CommunityProfile,
    CommunityReply,
    CommunityThread,
    CommunityVote,
    ContentReport,
    EmailVerificationToken,
    PasswordResetToken,
    Quiz,
    SharedResource,
    User,
)

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
COMMUNITY_TABLES = [
    ContentReport.__table__,
    CommunityNotification.__table__,
    CommunityProfile.__table__,
    CommunityVote.__table__,
    SharedResource.__table__,
    CommunityReply.__table__,
    CommunityThread.__table__,
    CommunityMembership.__table__,
    CommunityGroup.__table__,
    Quiz.__table__,
    AuthSession.__table__,
    PasswordResetToken.__table__,
    EmailVerificationToken.__table__,
    AuthAccount.__table__,
    User.__table__,
]


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    Base.metadata.drop_all(bind=engine, tables=COMMUNITY_TABLES)
    Base.metadata.create_all(bind=engine, tables=list(reversed(COMMUNITY_TABLES)))

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _auth_headers(client: TestClient, email: str) -> dict[str, str]:
    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "correct-horse",
            "full_name": "Community User",
        },
    )
    token = register_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _error_text(response) -> str:
    payload = response.json()
    if "detail" in payload:
        return str(payload["detail"])
    error = payload.get("error") or {}
    return str(error.get("message") or error.get("detail") or payload)


def test_create_group_and_share_resource(client: TestClient) -> None:
    headers = _auth_headers(client, "owner@example.com")

    create_group_response = client.post(
        "/community/groups",
        headers=headers,
        json={
            "name": "Biology Finals",
            "description": "Cell biology study group",
            "visibility": "public",
        },
    )
    assert create_group_response.status_code == 201
    group = create_group_response.json()
    group_id = group["id"]
    assert group["member_count"] == 1

    list_groups_response = client.get("/community/groups")
    assert list_groups_response.status_code == 200
    assert any(item["id"] == group_id for item in list_groups_response.json())

    with TestingSessionLocal() as db:
        user = db.query(User).filter(User.email == "owner@example.com").one()
        quiz = Quiz(user_id=user.id, title="Cell signaling quiz", status="draft")
        db.add(quiz)
        db.commit()
        resource_id = str(quiz.id)

    share_response = client.post(
        f"/community/groups/{group_id}/shared-resources",
        headers=headers,
        json={
            "resource_type": "quiz",
            "resource_id": resource_id,
            "title": "Cell signaling quiz",
            "description": "Shared practice set",
        },
    )
    assert share_response.status_code == 201
    shared = share_response.json()
    assert shared["title"] == "Cell signaling quiz"
    assert shared["resource_id"] == resource_id

    list_resources_response = client.get(f"/community/groups/{group_id}/shared-resources")
    assert list_resources_response.status_code == 200
    assert len(list_resources_response.json()) == 1


def test_share_resource_rejects_materials_and_raw_file_references(client: TestClient) -> None:
    headers = _auth_headers(client, "guardrail-owner@example.com")
    group_response = client.post(
        "/community/groups",
        headers=headers,
        json={"name": "Guardrail Group", "visibility": "public"},
    )
    group_id = group_response.json()["id"]

    material_response = client.post(
        f"/community/groups/{group_id}/shared-resources",
        headers=headers,
        json={
            "resource_type": "material",
            "resource_id": str(uuid4()),
            "title": "Raw uploaded notes",
        },
    )
    assert material_response.status_code == 400
    assert "cannot be shared directly" in _error_text(material_response)

    raw_url_response = client.post(
        f"/community/groups/{group_id}/shared-resources",
        headers=headers,
        json={
            "resource_type": "quiz",
            "resource_id": str(uuid4()),
            "title": "C:\\Users\\Denovan\\Documents\\Prepwise\\api\\uploads\\secret.pdf",
        },
    )
    assert raw_url_response.status_code == 400
    assert "file URLs" in _error_text(raw_url_response)


def test_share_resource_requires_owned_resource(client: TestClient) -> None:
    owner_headers = _auth_headers(client, "resource-owner@example.com")
    other_headers = _auth_headers(client, "resource-other@example.com")
    group_response = client.post(
        "/community/groups",
        headers=owner_headers,
        json={"name": "Ownership Group", "visibility": "public"},
    )
    group_id = group_response.json()["id"]
    client.post(f"/community/groups/{group_id}/join", headers=other_headers)

    with TestingSessionLocal() as db:
        owner = db.query(User).filter(User.email == "resource-owner@example.com").one()
        quiz = Quiz(user_id=owner.id, title="Private owner quiz", status="draft")
        db.add(quiz)
        db.commit()
        quiz_id = str(quiz.id)

    share_response = client.post(
        f"/community/groups/{group_id}/shared-resources",
        headers=other_headers,
        json={
            "resource_type": "quiz",
            "resource_id": quiz_id,
            "title": "Someone else's quiz",
        },
    )
    assert share_response.status_code == 403
    assert "own workspace" in _error_text(share_response)


def test_community_feed_lists_public_threads(client: TestClient) -> None:
    headers = _auth_headers(client, "feed-owner@example.com")
    group_response = client.post(
        "/community/groups",
        headers=headers,
        json={"name": "Feed Group", "description": "Public discussions", "visibility": "public"},
    )
    assert group_response.status_code == 201
    group = group_response.json()

    thread_response = client.post(
        f"/community/groups/{group['id']}/threads",
        headers=headers,
        json={"title": "First post", "body": "Hello from the feed"},
    )
    assert thread_response.status_code == 201

    feed_response = client.get("/community/feed")
    assert feed_response.status_code == 200
    feed = feed_response.json()
    assert len(feed) == 1
    assert feed[0]["title"] == "First post"
    assert feed[0]["group_slug"] == group["slug"]
    assert feed[0]["group_name"] == "Feed Group"


def test_school_groups_are_not_publicly_listed(client: TestClient) -> None:
    headers = _auth_headers(client, "school-owner@example.com")
    create_response = client.post(
        "/community/groups",
        headers=headers,
        json={
            "name": "School Only",
            "description": "Campus study room",
            "visibility": "school",
            "school_name": "Knorvex University",
        },
    )
    assert create_response.status_code == 201
    slug = create_response.json()["slug"]

    public_list_response = client.get("/community/groups")
    assert public_list_response.status_code == 200
    assert public_list_response.json() == []

    public_detail_response = client.get(f"/community/groups/by-slug/{slug}")
    assert public_detail_response.status_code == 403

    owner_list_response = client.get("/community/groups", headers=headers)
    assert owner_list_response.status_code == 200
    assert owner_list_response.json()[0]["slug"] == slug


def test_moderation_queue_resolve(client: TestClient) -> None:
    owner_headers = _auth_headers(client, "moderator@example.com")
    reporter_headers = _auth_headers(client, "reporter@example.com")

    group_response = client.post(
        "/community/groups",
        headers=owner_headers,
        json={"name": "Moderation Group", "visibility": "public"},
    )
    group_id = group_response.json()["id"]

    report_response = client.post(
        "/moderation/reports",
        headers=reporter_headers,
        json={
            "target_type": "group",
            "target_id": group_id,
            "reason": "spam",
            "details": "Unwanted promotion",
        },
    )
    assert report_response.status_code == 201
    report_id = report_response.json()["id"]

    queue_response = client.get("/moderation/reports", headers=owner_headers)
    assert queue_response.status_code == 200
    queue = queue_response.json()
    assert len(queue) == 1
    assert queue[0]["id"] == report_id
    assert queue[0]["status"] == "open"

    resolve_response = client.post(
        f"/moderation/reports/{report_id}/resolve",
        headers=owner_headers,
        json={"status": "dismissed", "notes": "No policy violation"},
    )
    assert resolve_response.status_code == 200
    resolved = resolve_response.json()
    assert resolved["status"] == "dismissed"
    assert resolved["reviewed_at"]

    empty_queue_response = client.get("/moderation/reports", headers=owner_headers)
    assert empty_queue_response.status_code == 200
    assert empty_queue_response.json() == []


def test_thread_replies_voting_and_nested_replies(client: TestClient) -> None:
    owner_headers = _auth_headers(client, "thread-owner@example.com")
    member_headers = _auth_headers(client, "thread-member@example.com")

    group_response = client.post(
        "/community/groups",
        headers=owner_headers,
        json={"name": "Thread Lab", "visibility": "public"},
    )
    group_id = group_response.json()["id"]
    client.post(f"/community/groups/{group_id}/join", headers=member_headers)

    thread_response = client.post(
        f"/community/groups/{group_id}/threads",
        headers=owner_headers,
        json={"title": "Exam tips", "body": "Share your best strategies."},
    )
    assert thread_response.status_code == 201
    thread = thread_response.json()
    assert thread["reply_count"] == 0
    assert thread["score"] == 0

    vote_response = client.post(
        f"/community/threads/{thread['id']}/vote",
        headers=member_headers,
        json={"vote": 1},
    )
    assert vote_response.status_code == 200
    assert vote_response.json()["upvote_count"] == 1
    assert vote_response.json()["score"] == 1

    reply_response = client.post(
        f"/community/threads/{thread['id']}/replies",
        headers=member_headers,
        json={"body": "Practice past papers daily."},
    )
    assert reply_response.status_code == 201
    parent_reply = reply_response.json()

    nested_reply_response = client.post(
        f"/community/threads/{thread['id']}/replies",
        headers=owner_headers,
        json={"body": "Great advice.", "parent_id": parent_reply["id"]},
    )
    assert nested_reply_response.status_code == 201
    nested = nested_reply_response.json()
    assert nested["parent_id"] == parent_reply["id"]

    replies_response = client.get(f"/community/threads/{thread['id']}/replies")
    assert replies_response.status_code == 200
    assert len(replies_response.json()) == 2

    reply_vote_response = client.post(
        f"/community/replies/{parent_reply['id']}/vote",
        headers=owner_headers,
        json={"vote": 1},
    )
    assert reply_vote_response.status_code == 200
    assert reply_vote_response.json()["score"] == 1

    top_threads_response = client.get(f"/community/groups/{group_id}/threads?sort=top")
    assert top_threads_response.status_code == 200
    assert top_threads_response.json()[0]["id"] == thread["id"]


REPUTATION_CREATE_THREAD = 3


def test_profile_notifications_and_reputation(client: TestClient) -> None:
    author_headers = _auth_headers(client, "profile-author@example.com")
    replier_headers = _auth_headers(client, "profile-replier@example.com")

    group_response = client.post(
        "/community/groups",
        headers=author_headers,
        json={"name": "Profile Group", "visibility": "public"},
    )
    group_id = group_response.json()["id"]
    client.post(f"/community/groups/{group_id}/join", headers=replier_headers)

    thread_response = client.post(
        f"/community/groups/{group_id}/threads",
        headers=author_headers,
        json={"title": "Need help", "body": "Any tips?"},
    )
    thread_id = thread_response.json()["id"]
    author_id = client.get("/auth/me", headers=author_headers).json()["id"]

    reply_response = client.post(
        f"/community/threads/{thread_id}/replies",
        headers=replier_headers,
        json={"body": "Try spaced repetition."},
    )
    assert reply_response.status_code == 201

    profile_response = client.get(f"/community/profiles/{author_id}")
    assert profile_response.status_code == 200
    profile = profile_response.json()
    assert profile["thread_count"] == 1
    assert profile["reputation_score"] >= REPUTATION_CREATE_THREAD

    notifications_response = client.get("/community/notifications", headers=author_headers)
    assert notifications_response.status_code == 200
    notifications = notifications_response.json()
    assert len(notifications) == 1
    assert notifications[0]["notification_type"] == "reply"

    unread_response = client.get("/community/notifications/unread-count", headers=author_headers)
    assert unread_response.json()["unread_count"] == 1

    vote_response = client.post(
        f"/community/threads/{thread_id}/vote",
        headers=replier_headers,
        json={"vote": 1},
    )
    assert vote_response.status_code == 200

    updated_profile = client.get(f"/community/profiles/{author_id}").json()
    assert updated_profile["reputation_score"] >= REPUTATION_CREATE_THREAD + 5

    read_all_response = client.post("/community/notifications/read-all", headers=author_headers)
    assert read_all_response.json()["unread_count"] == 0
