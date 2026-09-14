from __future__ import annotations

import math
import re
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_current_user, require_super_admin
from app.core.roles import user_is_super_admin
from app.models import BlogAuthor, BlogCategory, BlogComment, BlogPost, User
from app.schemas.integration import (
    BlogAuthorResponse,
    BlogCategoryCreateRequest,
    BlogCategoryResponse,
    BlogCommentCreateRequest,
    BlogCommentResponse,
    BlogPostCreateRequest,
    BlogPostResponse,
    BlogPostUpdateRequest,
    CommunityVoteRequest,
)
from app.services.votes import set_vote, vote_summary

router = APIRouter()

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024

SEED_POSTS = [
    BlogPostResponse(
        id="seed-study-loop",
        title="How to build a professor-style study loop",
        slug="professor-style-study-loop",
        excerpt="A practical flow for turning notes into targeted practice.",
        content=(
            "# How to build a professor-style study loop\n\n"
            "Upload material, generate exam-style questions, review weak topics, "
            "then convert misses into flashcards.\n\n"
            "## Step 1: Upload your notes\n\n"
            "Start with lecture slides, textbook chapters, or past exams.\n\n"
            "```python\n"
            "# Example: active recall prompt\n"
            "question = generate_question(topic='cell biology', difficulty='medium')\n"
            "```\n\n"
            "![Study workflow](https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800)\n"
        ),
        category="Study strategy",
        author="Knorvex Team",
        tags=["quizzes", "flashcards", "study-planning"],
        status="published",
        reading_time_minutes=3,
        published_at=datetime(2026, 1, 15, tzinfo=UTC),
    ),
    BlogPostResponse(
        id="seed-active-recall",
        title="Active recall beats rereading",
        slug="active-recall-beats-rereading",
        excerpt="Why retrieval practice should be the center of exam prep.",
        content=(
            "# Active recall beats rereading\n\n"
            "Practice questions and flashcards force memory retrieval and expose gaps "
            "before the exam does.\n\n"
            "> The best time to find out what you don't know is during practice, not on exam day.\n"
        ),
        category="Learning science",
        author="Knorvex Team",
        tags=["active-recall", "memory"],
        status="published",
        reading_time_minutes=2,
        published_at=datetime(2026, 1, 22, tzinfo=UTC),
    ),
]


@router.get("/posts", response_model=list[BlogPostResponse])
def list_posts(db: Session = Depends(get_db)) -> list[BlogPostResponse]:
    posts = db.scalars(
        select(BlogPost).where(BlogPost.status == "published").order_by(BlogPost.published_at.desc())
    ).all()
    if not posts:
        return SEED_POSTS
    return [_post_response(db, post, include_content=False) for post in posts]


@router.get("/admin/posts", response_model=list[BlogPostResponse])
def list_admin_posts(
    status_filter: str | None = Query(default=None, alias="status"),
    user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[BlogPostResponse]:
    query = select(BlogPost).order_by(BlogPost.updated_at.desc())
    if status_filter:
        query = query.where(BlogPost.status == status_filter)
    posts = db.scalars(query).all()
    return [_post_response(db, post, include_content=True) for post in posts]


@router.get("/search", response_model=list[BlogPostResponse])
def search_posts(q: str = Query(min_length=1), db: Session = Depends(get_db)) -> list[BlogPostResponse]:
    pattern = f"%{q.strip().lower()}%"
    posts = db.scalars(
        select(BlogPost)
        .where(
            BlogPost.status == "published",
            or_(
                func.lower(BlogPost.title).like(pattern),
                func.lower(BlogPost.excerpt).like(pattern),
                func.lower(BlogPost.content).like(pattern),
            ),
        )
        .order_by(BlogPost.published_at.desc())
        .limit(20)
    ).all()
    return [_post_response(db, post, include_content=False) for post in posts]


@router.post("/posts", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    request: BlogPostCreateRequest,
    user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> BlogPostResponse:
    author = _author_for_user(db, user)
    slug = request.slug or _unique_post_slug(db, request.title)
    post = BlogPost(
        author_id=author.id,
        category_id=request.category_id,
        title=request.title,
        slug=slug,
        excerpt=request.excerpt,
        content=request.content,
        cover_image_url=request.cover_image_url,
        status="draft",
        tags=request.tags,
        seo_title=request.seo_title,
        seo_description=request.seo_description,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_response(db, post, include_content=True)


@router.post("/uploads/images")
async def upload_blog_image(
    file: UploadFile = File(...),
    _user: User = Depends(require_super_admin),
) -> dict[str, str]:
    content_type = (file.content_type or "").lower()
    extension = ALLOWED_IMAGE_TYPES.get(content_type)
    if extension is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a JPG, PNG, GIF, or WebP image.")

    contents = await file.read(MAX_IMAGE_BYTES + 1)
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Images must be 5 MB or smaller.")

    upload_root = Path(settings.upload_dir).resolve() / "blog"
    upload_root.mkdir(parents=True, exist_ok=True)
    image_name = f"{datetime.now(UTC):%Y%m%d}-{uuid.uuid4().hex}{extension}"
    image_path = upload_root / image_name
    image_path.write_bytes(contents)

    public_base = settings.public_upload_base_url.rstrip("/")
    return {
        "url": f"{public_base}/blog/{image_name}",
        "filename": file.filename or image_name,
    }


@router.get("/posts/{slug}", response_model=BlogPostResponse)
def get_post(slug: str, db: Session = Depends(get_db)) -> BlogPostResponse:
    post = db.scalar(select(BlogPost).where(BlogPost.slug == slug, BlogPost.status == "published"))
    if post is not None:
        return _post_response(db, post, include_content=True)
    for seed in SEED_POSTS:
        if seed.slug == slug:
            return seed
    raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Post {slug!r} was not found.")


@router.get("/posts/{slug}/related", response_model=list[BlogPostResponse])
def related_posts(slug: str, db: Session = Depends(get_db)) -> list[BlogPostResponse]:
    post = db.scalar(select(BlogPost).where(BlogPost.slug == slug, BlogPost.status == "published"))
    if post is None:
        return []
    query = select(BlogPost).where(BlogPost.status == "published", BlogPost.id != post.id)
    if post.category_id:
        query = query.where(BlogPost.category_id == post.category_id)
    related = db.scalars(query.order_by(BlogPost.published_at.desc()).limit(3)).all()
    return [_post_response(db, item, include_content=False) for item in related]


@router.patch("/posts/{post_id}", response_model=BlogPostResponse)
def update_post(
    post_id: uuid.UUID,
    request: BlogPostUpdateRequest,
    user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> BlogPostResponse:
    post = _post_for_admin(db, post_id)
    if request.title is not None:
        post.title = request.title
    if request.slug is not None:
        post.slug = _unique_post_slug(db, request.slug, exclude_id=post.id)
    if request.excerpt is not None:
        post.excerpt = request.excerpt
    if request.content is not None:
        post.content = request.content
    if request.category_id is not None:
        post.category_id = request.category_id
    if request.tags is not None:
        post.tags = request.tags
    if request.cover_image_url is not None:
        post.cover_image_url = request.cover_image_url
    if request.seo_title is not None:
        post.seo_title = request.seo_title
    if request.seo_description is not None:
        post.seo_description = request.seo_description
    db.commit()
    db.refresh(post)
    return _post_response(db, post, include_content=True)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: uuid.UUID,
    user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> None:
    post = _post_for_admin(db, post_id)
    db.delete(post)
    db.commit()


@router.post("/posts/{post_id}/publish", response_model=BlogPostResponse)
def publish_post(
    post_id: uuid.UUID,
    user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> BlogPostResponse:
    post = _post_for_admin(db, post_id)
    post.status = "published"
    if post.published_at is None:
        post.published_at = datetime.now(UTC)
    db.commit()
    db.refresh(post)
    return _post_response(db, post, include_content=True)


@router.post("/posts/{post_id}/archive", response_model=BlogPostResponse)
def archive_post(
    post_id: uuid.UUID,
    user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> BlogPostResponse:
    post = _post_for_admin(db, post_id)
    post.status = "archived"
    db.commit()
    db.refresh(post)
    return _post_response(db, post, include_content=True)


@router.post("/posts/{post_id}/unpublish", response_model=BlogPostResponse)
def unpublish_post(
    post_id: uuid.UUID,
    user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> BlogPostResponse:
    post = _post_for_admin(db, post_id)
    post.status = "draft"
    db.commit()
    db.refresh(post)
    return _post_response(db, post, include_content=True)


@router.get("/posts/{slug}/comments", response_model=list[BlogCommentResponse])
def list_comments(
    slug: str,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> list[BlogCommentResponse]:
    post = db.scalar(select(BlogPost).where(BlogPost.slug == slug, BlogPost.status == "published"))
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Post {slug!r} was not found.")
    comments = db.scalars(
        select(BlogComment)
        .where(BlogComment.post_id == post.id, BlogComment.is_hidden.is_(False))
        .order_by(BlogComment.created_at.asc())
    ).all()
    return [_comment_response(db, comment, user) for comment in comments]


@router.post(
    "/posts/{slug}/comments",
    response_model=BlogCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    slug: str,
    request: BlogCommentCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BlogCommentResponse:
    post = db.scalar(select(BlogPost).where(BlogPost.slug == slug, BlogPost.status == "published"))
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Post {slug!r} was not found.")
    parent_id = request.parent_id
    if parent_id is not None:
        parent = db.get(BlogComment, parent_id)
        if parent is None or parent.post_id != post.id or parent.is_hidden:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid parent comment.")
    comment = BlogComment(
        post_id=post.id,
        user_id=user.id,
        parent_id=parent_id,
        body=request.body.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_response(db, comment, user)


@router.post("/comments/{comment_id}/vote", response_model=BlogCommentResponse)
def vote_comment(
    comment_id: uuid.UUID,
    request: CommunityVoteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BlogCommentResponse:
    comment = db.get(BlogComment, comment_id)
    if comment is None or comment.is_hidden:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Comment {comment_id} was not found.")
    set_vote(db, user.id, "blog_comment", comment_id, request.vote)
    db.commit()
    db.refresh(comment)
    return _comment_response(db, comment, user)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    comment = db.get(BlogComment, comment_id)
    if comment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Comment {comment_id} was not found.")
    if comment.user_id != user.id and not user_is_super_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You can only delete your own comments.")
    db.delete(comment)
    db.commit()


@router.get("/categories", response_model=list[BlogCategoryResponse])
def list_categories(db: Session = Depends(get_db)) -> list[BlogCategoryResponse]:
    categories = db.scalars(select(BlogCategory).order_by(BlogCategory.name.asc())).all()
    return [
        BlogCategoryResponse(
            id=category.id,
            name=category.name,
            slug=category.slug,
            description=category.description,
        )
        for category in categories
    ]


@router.post("/categories", response_model=BlogCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    request: BlogCategoryCreateRequest,
    user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> BlogCategoryResponse:
    slug = _unique_category_slug(db, request.name)
    category = BlogCategory(name=request.name, slug=slug, description=request.description)
    db.add(category)
    db.commit()
    db.refresh(category)
    return BlogCategoryResponse(
        id=category.id,
        name=category.name,
        slug=category.slug,
        description=category.description,
    )


@router.get("/authors/{author_slug}", response_model=BlogAuthorResponse)
def get_author(author_slug: str, db: Session = Depends(get_db)) -> BlogAuthorResponse:
    author = db.scalar(select(BlogAuthor).where(BlogAuthor.slug == author_slug))
    if author is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Author {author_slug!r} was not found.")
    post_count = db.scalar(
        select(func.count())
        .select_from(BlogPost)
        .where(BlogPost.author_id == author.id, BlogPost.status == "published")
    )
    return BlogAuthorResponse(
        id=author.id,
        display_name=author.display_name,
        slug=author.slug,
        bio=author.bio,
        avatar_url=author.avatar_url,
        post_count=int(post_count or 0),
    )


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "post"


def _unique_post_slug(db: Session, value: str, exclude_id: uuid.UUID | None = None) -> str:
    base = _slug(value)
    slug = base
    index = 2
    while True:
        existing = db.scalar(select(BlogPost.id).where(BlogPost.slug == slug))
        if existing is None or existing == exclude_id:
            return slug
        slug = f"{base}-{index}"
        index += 1


def _unique_category_slug(db: Session, name: str) -> str:
    base = _slug(name)
    slug = base
    index = 2
    while db.scalar(select(BlogCategory.id).where(BlogCategory.slug == slug)):
        slug = f"{base}-{index}"
        index += 1
    return slug


def _author_for_user(db: Session, user: User) -> BlogAuthor:
    author = db.scalar(select(BlogAuthor).where(BlogAuthor.user_id == user.id))
    if author is not None:
        return author
    display_name = user.name or user.email.split("@")[0]
    author = BlogAuthor(
        user_id=user.id,
        display_name=display_name,
        slug=_unique_author_slug(db, display_name),
    )
    db.add(author)
    db.flush()
    return author


def _unique_author_slug(db: Session, display_name: str) -> str:
    base = _slug(display_name)
    slug = base
    index = 2
    while db.scalar(select(BlogAuthor.id).where(BlogAuthor.slug == slug)):
        slug = f"{base}-{index}"
        index += 1
    return slug


def _post_for_admin(db: Session, post_id: uuid.UUID) -> BlogPost:
    post = db.get(BlogPost, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Post {post_id} was not found.")
    return post


def _reading_time_minutes(content: str | None) -> int | None:
    if not content:
        return None
    words = len(re.findall(r"\w+", content))
    return max(1, math.ceil(words / 200))


def _comment_count(db: Session, post_id: uuid.UUID) -> int:
    count = db.scalar(
        select(func.count())
        .select_from(BlogComment)
        .where(BlogComment.post_id == post_id, BlogComment.is_hidden.is_(False))
    )
    return int(count or 0)


def _post_response(db: Session, post: BlogPost, *, include_content: bool) -> BlogPostResponse:
    return BlogPostResponse(
        id=str(post.id),
        title=post.title,
        slug=post.slug,
        excerpt=post.excerpt,
        content=post.content if include_content else None,
        category=post.category.name if post.category else None,
        category_id=post.category_id,
        author=post.author.display_name if post.author else None,
        author_id=post.author_id,
        tags=post.tags or [],
        status=post.status,
        cover_image_url=post.cover_image_url,
        seo_title=post.seo_title,
        seo_description=post.seo_description,
        reading_time_minutes=_reading_time_minutes(post.content),
        comment_count=_comment_count(db, post.id),
        published_at=post.published_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def _comment_response(db: Session, comment: BlogComment, user: User | None = None) -> BlogCommentResponse:
    author = comment.user
    avatar_url = None
    if author and author.blog_author:
        avatar_url = author.blog_author.avatar_url
    _, _, score, user_vote = vote_summary(db, "blog_comment", comment.id, user)
    return BlogCommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        parent_id=comment.parent_id,
        body=comment.body,
        author_name=author.name if author else "Anonymous",
        author_id=comment.user_id,
        author_avatar_url=avatar_url,
        score=score,
        user_vote=user_vote,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )
