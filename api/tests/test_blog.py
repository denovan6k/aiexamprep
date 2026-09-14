from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models.entities import (
    AuthAccount,
    AuthSession,
    Base,
    BlogAuthor,
    BlogCategory,
    BlogComment,
    BlogPost,
    CommunityVote,
    EmailVerificationToken,
    PasswordResetToken,
    User,
)

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
BLOG_TABLES = [
    CommunityVote.__table__,
    BlogComment.__table__,
    BlogPost.__table__,
    BlogCategory.__table__,
    BlogAuthor.__table__,
    AuthSession.__table__,
    PasswordResetToken.__table__,
    EmailVerificationToken.__table__,
    AuthAccount.__table__,
    User.__table__,
]


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    Base.metadata.drop_all(bind=engine, tables=BLOG_TABLES)
    Base.metadata.create_all(bind=engine, tables=list(reversed(BLOG_TABLES)))

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


def _auth_headers(client: TestClient, *, email: str = "admin@example.com") -> dict[str, str]:
    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "correct-horse",
            "full_name": "Blog Admin",
        },
    )
    token = register_response.json()["access_token"]
    with TestingSessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is not None:
            user.role = "super_admin"
            db.add(user)
            db.commit()
    return {"Authorization": f"Bearer {token}"}


def test_list_and_get_seed_posts(client: TestClient) -> None:
    list_response = client.get("/blog/posts")
    assert list_response.status_code == 200
    posts = list_response.json()
    assert len(posts) == 2
    assert posts[0]["slug"] == "professor-style-study-loop"

    get_response = client.get("/blog/posts/professor-style-study-loop")
    assert get_response.status_code == 200
    body = get_response.json()
    assert body["title"] == "How to build a professor-style study loop"
    assert "Upload material" in body["content"]


def test_blog_cms_publish_flow(client: TestClient) -> None:
    headers = _auth_headers(client)

    create_response = client.post(
        "/blog/posts",
        headers=headers,
        json={
            "title": "New study guide",
            "content": "Start with active recall every day.",
            "excerpt": "A short guide.",
            "tags": ["study"],
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    post_id = created["id"]
    assert created["slug"] == "new-study-guide"
    assert created["content"] == "Start with active recall every day."
    assert created["status"] == "draft"

    publish_response = client.post(f"/blog/posts/{post_id}/publish", headers=headers)
    assert publish_response.status_code == 200
    assert publish_response.json()["published_at"]

    public_response = client.get("/blog/posts/new-study-guide")
    assert public_response.status_code == 200
    assert public_response.json()["title"] == "New study guide"

    category_response = client.post(
        "/blog/categories",
        headers=headers,
        json={"name": "Study strategy", "description": "Exam prep tips"},
    )
    assert category_response.status_code == 201
    assert category_response.json()["slug"] == "study-strategy"


def test_blog_requires_super_admin(client: TestClient) -> None:
    register_response = client.post(
        "/auth/register",
        json={
            "email": "user@example.com",
            "password": "correct-horse",
            "full_name": "Regular User",
        },
    )
    headers = {"Authorization": f"Bearer {register_response.json()['access_token']}"}
    create_response = client.post(
        "/blog/posts",
        headers=headers,
        json={"title": "Blocked", "content": "Should fail."},
    )
    assert create_response.status_code == 403


def test_blog_comments(client: TestClient) -> None:
    headers = _auth_headers(client)
    create_response = client.post(
        "/blog/posts",
        headers=headers,
        json={"title": "Commentable post", "content": "Body text here.", "excerpt": "Excerpt"},
    )
    post_id = create_response.json()["id"]
    client.post(f"/blog/posts/{post_id}/publish", headers=headers)

    comment_response = client.post(
        "/blog/posts/commentable-post/comments",
        headers=headers,
        json={"body": "Great article!"},
    )
    assert comment_response.status_code == 201
    assert comment_response.json()["author_name"] == "Blog Admin"

    list_response = client.get("/blog/posts/commentable-post/comments")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def _user_headers(client: TestClient, *, email: str, full_name: str) -> dict[str, str]:
    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "correct-horse",
            "full_name": full_name,
        },
    )
    token = register_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_blog_comment_delete_author_or_super_admin_only(client: TestClient) -> None:
    admin_headers = _auth_headers(client, email="delete-admin@example.com")
    author_headers = _user_headers(
        client, email="comment-author@example.com", full_name="Comment Author"
    )
    other_headers = _user_headers(
        client, email="other-user@example.com", full_name="Other User"
    )

    create_response = client.post(
        "/blog/posts",
        headers=admin_headers,
        json={"title": "Delete policy post", "content": "Body text here.", "excerpt": "Excerpt"},
    )
    post_id = create_response.json()["id"]
    client.post(f"/blog/posts/{post_id}/publish", headers=admin_headers)

    comment_response = client.post(
        "/blog/posts/delete-policy-post/comments",
        headers=author_headers,
        json={"body": "Author comment"},
    )
    assert comment_response.status_code == 201
    comment_id = comment_response.json()["id"]

    forbidden_response = client.delete(f"/blog/comments/{comment_id}", headers=other_headers)
    assert forbidden_response.status_code == 403

    author_delete_response = client.delete(f"/blog/comments/{comment_id}", headers=author_headers)
    assert author_delete_response.status_code == 204

    recreate_response = client.post(
        "/blog/posts/delete-policy-post/comments",
        headers=author_headers,
        json={"body": "Comment for admin delete"},
    )
    assert recreate_response.status_code == 201
    admin_delete_response = client.delete(
        f"/blog/comments/{recreate_response.json()['id']}",
        headers=admin_headers,
    )
    assert admin_delete_response.status_code == 204


def test_blog_comment_nested_reply_and_vote(client: TestClient) -> None:
    headers = _auth_headers(client)
    create_response = client.post(
        "/blog/posts",
        headers=headers,
        json={"title": "Threaded post", "content": "Body text here.", "excerpt": "Excerpt"},
    )
    post_id = create_response.json()["id"]
    client.post(f"/blog/posts/{post_id}/publish", headers=headers)

    parent_response = client.post(
        "/blog/posts/threaded-post/comments",
        headers=headers,
        json={"body": "Top-level comment"},
    )
    assert parent_response.status_code == 201
    parent = parent_response.json()
    assert parent["parent_id"] is None
    assert parent["score"] == 0

    reply_response = client.post(
        "/blog/posts/threaded-post/comments",
        headers=headers,
        json={"body": "Nested reply", "parent_id": parent["id"]},
    )
    assert reply_response.status_code == 201
    reply = reply_response.json()
    assert reply["parent_id"] == parent["id"]

    invalid_parent = client.post(
        "/blog/posts/threaded-post/comments",
        headers=headers,
        json={"body": "Bad parent", "parent_id": "00000000-0000-0000-0000-000000000099"},
    )
    assert invalid_parent.status_code == 400

    upvote_response = client.post(
        f"/blog/comments/{parent['id']}/vote",
        headers=headers,
        json={"vote": 1},
    )
    assert upvote_response.status_code == 200
    assert upvote_response.json()["score"] == 1
    assert upvote_response.json()["user_vote"] == 1

    downvote_response = client.post(
        f"/blog/comments/{parent['id']}/vote",
        headers=headers,
        json={"vote": -1},
    )
    assert downvote_response.status_code == 200
    assert downvote_response.json()["score"] == -1
    assert downvote_response.json()["user_vote"] == -1

    clear_vote_response = client.post(
        f"/blog/comments/{parent['id']}/vote",
        headers=headers,
        json={"vote": 0},
    )
    assert clear_vote_response.status_code == 200
    assert clear_vote_response.json()["score"] == 0
    assert clear_vote_response.json()["user_vote"] is None

    list_response = client.get("/blog/posts/threaded-post/comments", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 2


def test_super_admin_can_upload_blog_image(client: TestClient, tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routes.blog.settings.upload_dir", str(tmp_path))
    headers = _auth_headers(client)

    upload_response = client.post(
        "/blog/uploads/images",
        headers=headers,
        files={"file": ("cover.png", b"\x89PNG\r\n\x1a\nimage-bytes", "image/png")},
    )

    assert upload_response.status_code == 200
    body = upload_response.json()
    assert body["url"].startswith("/uploads/blog/")
    assert body["filename"] == "cover.png"
    assert any((tmp_path / "blog").iterdir())


def test_blog_image_upload_rejects_regular_users_and_invalid_types(client: TestClient) -> None:
    register_response = client.post(
        "/auth/register",
        json={
            "email": "regular-upload@example.com",
            "password": "correct-horse",
            "full_name": "Regular User",
        },
    )
    headers = {"Authorization": f"Bearer {register_response.json()['access_token']}"}

    forbidden_response = client.post(
        "/blog/uploads/images",
        headers=headers,
        files={"file": ("cover.png", b"image-bytes", "image/png")},
    )
    assert forbidden_response.status_code == 403

    admin_headers = _auth_headers(client, email="upload-admin@example.com")
    invalid_response = client.post(
        "/blog/uploads/images",
        headers=admin_headers,
        files={"file": ("notes.txt", b"not an image", "text/plain")},
    )
    assert invalid_response.status_code == 415
