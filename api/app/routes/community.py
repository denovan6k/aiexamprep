from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_current_user
from app.core.roles import user_is_super_admin
from app.models import (
    CommunityGroup,
    CommunityMembership,
    CommunityNotification,
    CommunityProfile,
    CommunityReply,
    CommunityThread,
    CommunityVote,
    FlashcardDeck,
    ProfessorAgent,
    Quiz,
    SharedResource,
    User,
)
from app.models.entities import utc_now
from app.schemas.integration import (
    CommunityGroupCreateRequest,
    CommunityGroupResponse,
    CommunityGroupUpdateRequest,
    CommunityMemberResponse,
    CommunityNotificationResponse,
    CommunityNotificationUnreadResponse,
    CommunityProfileGroupSummary,
    CommunityProfileReplySummary,
    CommunityProfileResponse,
    CommunityProfileThreadSummary,
    CommunityProfileUpdateRequest,
    CommunityReplyCreateRequest,
    CommunityReplyResponse,
    CommunityReplyUpdateRequest,
    CommunitySearchResponse,
    CommunityFeedItemResponse,
    CommunityThreadCreateRequest,
    CommunityThreadResponse,
    CommunityThreadUpdateRequest,
    CommunityVoteRequest,
    SharedResourceCreateRequest,
    SharedResourceDetailResponse,
    SharedResourceResponse,
    SharedAgentPreview,
)
from app.services.agent_intro import generate_agent_intro
from app.services.community_engagement import (
    REPUTATION_CREATE_REPLY,
    REPUTATION_CREATE_THREAD,
    adjust_reputation,
    apply_vote_effects,
    get_or_create_profile,
    notify_reply,
    reputation_tier,
)

router = APIRouter()

MODERATOR_ROLES = frozenset({"owner", "moderator"})
SHAREABLE_RESOURCE_MODELS = {
    "quiz": Quiz,
    "flashcard_deck": FlashcardDeck,
    "agent": ProfessorAgent,
}
BLOCKED_SHARED_RESOURCE_TYPES = frozenset(
    {
        "file",
        "material",
        "material_file",
        "material_upload",
        "upload",
    }
)
RAW_MATERIAL_REFERENCE_PATTERN = re.compile(
    r"(?:^|[/\\])uploads[/\\]|storage_path|file://|(?:https?://\S*/uploads/)",
    re.IGNORECASE,
)


@router.get("/groups", response_model=list[CommunityGroupResponse])
def list_groups(
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> list[CommunityGroupResponse]:
    if user is not None:
        member_group_ids = db.scalars(
            select(CommunityMembership.group_id).where(
                CommunityMembership.user_id == user.id,
                CommunityMembership.status == "active",
            )
        ).all()
        visibility_filter = [CommunityGroup.visibility == "public"]
        if member_group_ids:
            visibility_filter.append(CommunityGroup.id.in_(member_group_ids))
        groups = db.scalars(
            select(CommunityGroup)
            .where(or_(*visibility_filter))
            .order_by(CommunityGroup.created_at.desc())
        ).all()
    else:
        groups = db.scalars(
            select(CommunityGroup)
            .where(CommunityGroup.visibility == "public")
            .order_by(CommunityGroup.created_at.desc())
        ).all()
    return [_group_response(db, group, user) for group in groups]


@router.get("/search", response_model=CommunitySearchResponse)
def search_community(
    q: str = Query(min_length=1),
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> CommunitySearchResponse:
    pattern = f"%{q.strip().lower()}%"
    visible_groups = _visible_groups_query(db, user)
    groups = db.scalars(
        visible_groups.where(
            or_(
                func.lower(CommunityGroup.name).like(pattern),
                func.lower(CommunityGroup.description).like(pattern),
            )
        ).limit(10)
    ).all()
    group_ids = [group.id for group in groups]
    threads: list[CommunityThread] = []
    if group_ids:
        threads = db.scalars(
            select(CommunityThread)
            .where(
                CommunityThread.group_id.in_(group_ids),
                or_(
                    func.lower(CommunityThread.title).like(pattern),
                    func.lower(CommunityThread.body).like(pattern),
                ),
            )
            .order_by(CommunityThread.created_at.desc())
            .limit(20)
        ).all()
    return CommunitySearchResponse(
        groups=[_group_response(db, group, user) for group in groups],
        threads=[_thread_response(db, thread, user) for thread in threads],
    )


@router.get("/feed", response_model=list[CommunityFeedItemResponse])
def community_feed(
    sort: str = Query(default="newest", pattern="^(newest|top|trending)$"),
    limit: int = Query(default=25, ge=1, le=100),
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> list[CommunityFeedItemResponse]:
    visible_groups = db.scalars(_visible_groups_query(db, user)).all()
    if not visible_groups:
        return []

    groups_by_id = {group.id: group for group in visible_groups}
    visible_group_ids = list(groups_by_id.keys())
    threads = db.scalars(
        select(CommunityThread)
        .where(CommunityThread.group_id.in_(visible_group_ids))
        .order_by(CommunityThread.created_at.desc())
        .limit(min(limit * 4, 200))
    ).all()

    items: list[CommunityFeedItemResponse] = []
    for thread in threads:
        group = groups_by_id.get(thread.group_id)
        if group is None:
            continue
        thread_response = _thread_response(db, thread, user)
        items.append(
            CommunityFeedItemResponse(
                **thread_response.model_dump(),
                group_slug=group.slug,
                group_name=group.name,
            )
        )

    if sort == "top":
        items.sort(key=lambda item: (-int(item.pinned), -item.score, -item.created_at.timestamp()))
    elif sort == "trending":
        items.sort(
            key=lambda item: (
                -int(item.pinned),
                -(item.score + item.reply_count),
                -item.created_at.timestamp(),
            )
        )
    else:
        items.sort(key=lambda item: (-int(item.pinned), -item.created_at.timestamp()))

    return items[:limit]


@router.get("/profiles/me", response_model=CommunityProfileResponse)
def get_my_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityProfileResponse:
    return _profile_response(db, user.id, user)


@router.patch("/profiles/me", response_model=CommunityProfileResponse)
def update_my_profile(
    request: CommunityProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityProfileResponse:
    profile = get_or_create_profile(db, user.id)
    if request.bio is not None:
        profile.bio = request.bio
    if request.study_interests is not None:
        profile.study_interests = request.study_interests
    db.commit()
    return _profile_response(db, user.id, user)


@router.get("/profiles/{user_id}", response_model=CommunityProfileResponse)
def get_user_profile(
    user_id: uuid.UUID,
    viewer: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> CommunityProfileResponse:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found.")
    return _profile_response(db, user_id, viewer)


@router.get("/notifications/unread-count", response_model=CommunityNotificationUnreadResponse)
def unread_notification_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityNotificationUnreadResponse:
    count = db.scalar(
        select(func.count())
        .select_from(CommunityNotification)
        .where(CommunityNotification.user_id == user.id, CommunityNotification.read_at.is_(None))
    )
    return CommunityNotificationUnreadResponse(unread_count=int(count or 0))


@router.get("/notifications", response_model=list[CommunityNotificationResponse])
def list_notifications(
    unread_only: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CommunityNotificationResponse]:
    query = select(CommunityNotification).where(CommunityNotification.user_id == user.id)
    if unread_only:
        query = query.where(CommunityNotification.read_at.is_(None))
    notifications = db.scalars(query.order_by(CommunityNotification.created_at.desc()).limit(50)).all()
    return [_notification_response(db, item) for item in notifications]


@router.post("/notifications/{notification_id}/read", response_model=CommunityNotificationResponse)
def mark_notification_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityNotificationResponse:
    notification = db.scalar(
        select(CommunityNotification).where(
            CommunityNotification.id == notification_id,
            CommunityNotification.user_id == user.id,
        )
    )
    if notification is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    if notification.read_at is None:
        notification.read_at = utc_now()
        db.commit()
        db.refresh(notification)
    return _notification_response(db, notification)


@router.post("/notifications/read-all", response_model=CommunityNotificationUnreadResponse)
def mark_all_notifications_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityNotificationUnreadResponse:
    notifications = db.scalars(
        select(CommunityNotification).where(
            CommunityNotification.user_id == user.id,
            CommunityNotification.read_at.is_(None),
        )
    ).all()
    for notification in notifications:
        notification.read_at = utc_now()
    db.commit()
    return CommunityNotificationUnreadResponse(unread_count=0)


@router.post("/groups", response_model=CommunityGroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    request: CommunityGroupCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityGroupResponse:
    group = CommunityGroup(
        owner_id=user.id,
        name=request.name,
        slug=_unique_slug(db, request.name),
        description=request.description,
        visibility=request.visibility,
        course_id=request.course_id,
        school_name=request.school_name,
        member_count=1,
    )
    db.add(group)
    db.flush()
    db.add(CommunityMembership(group_id=group.id, user_id=user.id, role="owner", status="active"))
    db.commit()
    db.refresh(group)
    return _group_response(db, group, user)


@router.get("/groups/by-slug/{slug}", response_model=CommunityGroupResponse)
def get_group_by_slug(
    slug: str,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> CommunityGroupResponse:
    group = db.scalar(select(CommunityGroup).where(CommunityGroup.slug == slug))
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Group {slug!r} was not found.")
    _require_group_access(db, group, user)
    return _group_response(db, group, user)


@router.get("/groups/{group_id}", response_model=CommunityGroupResponse)
def get_group(
    group_id: uuid.UUID,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> CommunityGroupResponse:
    group = _group(db, group_id)
    _require_group_access(db, group, user)
    return _group_response(db, group, user)


@router.patch("/groups/{group_id}", response_model=CommunityGroupResponse)
def update_group(
    group_id: uuid.UUID,
    request: CommunityGroupUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityGroupResponse:
    group = _group(db, group_id)
    _require_group_role(db, group_id, user.id, MODERATOR_ROLES | {"owner"})
    if request.name is not None:
        group.name = request.name
    if request.description is not None:
        group.description = request.description
    if request.visibility is not None:
        group.visibility = request.visibility
    if request.school_name is not None:
        group.school_name = request.school_name
    db.commit()
    db.refresh(group)
    return _group_response(db, group, user)


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    group = _group(db, group_id)
    if group.owner_id != user.id and not user_is_super_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only the group owner can delete this group.")
    db.delete(group)
    db.commit()


@router.post("/groups/{group_id}/join", response_model=CommunityGroupResponse)
def join_group(
    group_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityGroupResponse:
    group = _group(db, group_id)
    if group.visibility == "private":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="This group requires an invitation.")
    membership = db.scalar(
        select(CommunityMembership).where(
            CommunityMembership.group_id == group_id, CommunityMembership.user_id == user.id
        )
    )
    if membership is None:
        db.add(CommunityMembership(group_id=group_id, user_id=user.id, role="member", status="active"))
        group.member_count += 1
    elif membership.status != "active":
        membership.status = "active"
        group.member_count += 1
    db.commit()
    db.refresh(group)
    return _group_response(db, group, user)


@router.post("/groups/{group_id}/leave", response_model=CommunityGroupResponse)
def leave_group(
    group_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityGroupResponse:
    group = _group(db, group_id)
    membership = db.scalar(
        select(CommunityMembership).where(
            CommunityMembership.group_id == group_id, CommunityMembership.user_id == user.id
        )
    )
    if membership and membership.role != "owner" and membership.status == "active":
        membership.status = "left"
        group.member_count = max(0, group.member_count - 1)
        db.add(membership)
    db.commit()
    db.refresh(group)
    return _group_response(db, group, user)


@router.get("/groups/{group_id}/members", response_model=list[CommunityMemberResponse])
def list_members(
    group_id: uuid.UUID,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> list[CommunityMemberResponse]:
    group = _group(db, group_id)
    _require_group_access(db, group, user)
    memberships = db.scalars(
        select(CommunityMembership)
        .where(CommunityMembership.group_id == group_id, CommunityMembership.status == "active")
        .order_by(CommunityMembership.joined_at.asc())
    ).all()
    return [
        CommunityMemberResponse(
            user_id=membership.user_id,
            name=membership.user.name if membership.user else "Member",
            role=membership.role,
            status=membership.status,
            joined_at=membership.joined_at,
        )
        for membership in memberships
    ]


@router.post("/groups/{group_id}/members/{member_id}/role")
def update_member_role(
    group_id: uuid.UUID,
    member_id: uuid.UUID,
    role: str = Query(..., pattern="^(member|moderator)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityMemberResponse:
    group = _group(db, group_id)
    if group.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only the group owner can change roles.")
    membership = db.scalar(
        select(CommunityMembership).where(
            CommunityMembership.group_id == group_id,
            CommunityMembership.user_id == member_id,
            CommunityMembership.status == "active",
        )
    )
    if membership is None or membership.role == "owner":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Member not found.")
    membership.role = role
    db.commit()
    db.refresh(membership)
    return CommunityMemberResponse(
        user_id=membership.user_id,
        name=membership.user.name if membership.user else "Member",
        role=membership.role,
        status=membership.status,
        joined_at=membership.joined_at,
    )


@router.get("/groups/{group_id}/threads", response_model=list[CommunityThreadResponse])
def list_threads(
    group_id: uuid.UUID,
    sort: str = Query(default="newest", pattern="^(newest|top|trending)$"),
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> list[CommunityThreadResponse]:
    group = _group(db, group_id)
    _require_group_access(db, group, user)
    threads = db.scalars(
        select(CommunityThread).where(CommunityThread.group_id == group_id)
    ).all()
    responses = [_thread_response(db, thread, user) for thread in threads]
    if sort == "top":
        responses.sort(key=lambda item: (-int(item.pinned), -item.score, -item.created_at.timestamp()))
    elif sort == "trending":
        responses.sort(
            key=lambda item: (
                -int(item.pinned),
                -(item.score + item.reply_count),
                -item.created_at.timestamp(),
            )
        )
    else:
        responses.sort(key=lambda item: (-int(item.pinned), -item.created_at.timestamp()))
    return responses


@router.post(
    "/groups/{group_id}/threads",
    response_model=CommunityThreadResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_thread(
    group_id: uuid.UUID,
    request: CommunityThreadCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityThreadResponse:
    _require_active_member(db, group_id, user.id)
    thread = CommunityThread(group_id=group_id, author_id=user.id, title=request.title, body=request.body)
    db.add(thread)
    db.flush()
    adjust_reputation(db, user.id, REPUTATION_CREATE_THREAD)
    db.commit()
    db.refresh(thread)
    return _thread_response(db, thread, user)


@router.get("/threads/{thread_id}", response_model=CommunityThreadResponse)
def get_thread(
    thread_id: uuid.UUID,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> CommunityThreadResponse:
    thread = _thread(db, thread_id)
    group = _group(db, thread.group_id)
    _require_group_access(db, group, user)
    return _thread_response(db, thread, user)


@router.patch("/threads/{thread_id}", response_model=CommunityThreadResponse)
def update_thread(
    thread_id: uuid.UUID,
    request: CommunityThreadUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityThreadResponse:
    thread = _thread(db, thread_id)
    if thread.author_id != user.id and not _can_moderate(db, thread.group_id, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You cannot edit this thread.")
    if request.title is not None:
        thread.title = request.title
    if request.body is not None:
        thread.body = request.body
    db.commit()
    db.refresh(thread)
    return _thread_response(db, thread, user)


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_thread(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    thread = _thread(db, thread_id)
    if thread.author_id != user.id and not _can_moderate(db, thread.group_id, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You cannot delete this thread.")
    db.delete(thread)
    db.commit()


@router.post("/threads/{thread_id}/pin", response_model=CommunityThreadResponse)
def pin_thread(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityThreadResponse:
    thread = _thread(db, thread_id)
    if not _can_moderate(db, thread.group_id, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Moderator access required.")
    thread.pinned = True
    db.commit()
    db.refresh(thread)
    return _thread_response(db, thread, user)


@router.post("/threads/{thread_id}/unpin", response_model=CommunityThreadResponse)
def unpin_thread(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityThreadResponse:
    thread = _thread(db, thread_id)
    if not _can_moderate(db, thread.group_id, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Moderator access required.")
    thread.pinned = False
    db.commit()
    db.refresh(thread)
    return _thread_response(db, thread, user)


@router.post("/threads/{thread_id}/lock", response_model=CommunityThreadResponse)
def lock_thread(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityThreadResponse:
    thread = _thread(db, thread_id)
    if not _can_moderate(db, thread.group_id, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Moderator access required.")
    thread.locked = True
    db.commit()
    db.refresh(thread)
    return _thread_response(db, thread, user)


@router.post("/threads/{thread_id}/unlock", response_model=CommunityThreadResponse)
def unlock_thread(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityThreadResponse:
    thread = _thread(db, thread_id)
    if not _can_moderate(db, thread.group_id, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Moderator access required.")
    thread.locked = False
    db.commit()
    db.refresh(thread)
    return _thread_response(db, thread, user)


@router.post("/threads/{thread_id}/vote", response_model=CommunityThreadResponse)
def vote_thread(
    thread_id: uuid.UUID,
    request: CommunityVoteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityThreadResponse:
    thread = _thread(db, thread_id)
    _require_active_member(db, thread.group_id, user.id)
    apply_vote_effects(
        db,
        voter_id=user.id,
        target_type="thread",
        target_id=thread_id,
        new_vote=request.vote,
    )
    _set_vote(db, user.id, "thread", thread_id, request.vote)
    db.commit()
    db.refresh(thread)
    return _thread_response(db, thread, user)


@router.get("/threads/{thread_id}/replies", response_model=list[CommunityReplyResponse])
def list_replies(
    thread_id: uuid.UUID,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> list[CommunityReplyResponse]:
    thread = _thread(db, thread_id)
    group = _group(db, thread.group_id)
    _require_group_access(db, group, user)
    replies = db.scalars(
        select(CommunityReply)
        .where(CommunityReply.thread_id == thread_id)
        .order_by(CommunityReply.created_at.asc())
    ).all()
    return [_reply_response(db, reply, user) for reply in replies]


@router.post(
    "/threads/{thread_id}/replies",
    response_model=CommunityReplyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_reply(
    thread_id: uuid.UUID,
    request: CommunityReplyCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityReplyResponse:
    thread = _thread(db, thread_id)
    if thread.locked:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Thread is locked.")
    _require_active_member(db, thread.group_id, user.id)
    if request.parent_id is not None:
        parent = _reply(db, request.parent_id)
        if parent.thread_id != thread_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Parent reply belongs to another thread.")
    reply = CommunityReply(
        thread_id=thread_id,
        parent_id=request.parent_id,
        author_id=user.id,
        body=request.body,
    )
    db.add(reply)
    db.flush()
    adjust_reputation(db, user.id, REPUTATION_CREATE_REPLY)
    notify_reply(db, reply=reply, actor=user, thread=thread)
    db.commit()
    db.refresh(reply)
    return _reply_response(db, reply, user)


@router.patch("/replies/{reply_id}", response_model=CommunityReplyResponse)
def update_reply(
    reply_id: uuid.UUID,
    request: CommunityReplyUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityReplyResponse:
    reply = _reply(db, reply_id)
    thread = _thread(db, reply.thread_id)
    if reply.author_id != user.id and not _can_moderate(db, thread.group_id, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You cannot edit this reply.")
    reply.body = request.body
    db.commit()
    db.refresh(reply)
    return _reply_response(db, reply, user)


@router.post("/replies/{reply_id}/vote", response_model=CommunityReplyResponse)
def vote_reply(
    reply_id: uuid.UUID,
    request: CommunityVoteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommunityReplyResponse:
    reply = _reply(db, reply_id)
    thread = _thread(db, reply.thread_id)
    _require_active_member(db, thread.group_id, user.id)
    apply_vote_effects(
        db,
        voter_id=user.id,
        target_type="reply",
        target_id=reply_id,
        new_vote=request.vote,
    )
    _set_vote(db, user.id, "reply", reply_id, request.vote)
    db.commit()
    db.refresh(reply)
    return _reply_response(db, reply, user)


@router.delete("/replies/{reply_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reply(
    reply_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    reply = _reply(db, reply_id)
    thread = _thread(db, reply.thread_id)
    if reply.author_id != user.id and not _can_moderate(db, thread.group_id, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You cannot delete this reply.")
    db.delete(reply)
    db.commit()


@router.get(
    "/groups/{group_id}/shared-resources",
    response_model=list[SharedResourceResponse],
)
def list_shared_resources(
    group_id: uuid.UUID,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> list[SharedResourceResponse]:
    group = _group(db, group_id)
    _require_group_access(db, group, user)
    resources = db.scalars(
        select(SharedResource)
        .where(SharedResource.group_id == group_id)
        .order_by(SharedResource.created_at.desc())
    ).all()
    return [_shared_resource_response(db, resource) for resource in resources]


@router.post(
    "/groups/{group_id}/shared-resources",
    response_model=SharedResourceResponse,
    status_code=status.HTTP_201_CREATED,
)
def share_resource(
    group_id: uuid.UUID,
    request: SharedResourceCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SharedResourceResponse:
    _require_active_member(db, group_id, user.id)
    _validate_shared_resource_guardrails(db, request, user)
    resource = SharedResource(
        group_id=group_id,
        shared_by_user_id=user.id,
        resource_type=request.resource_type,
        resource_id=request.resource_id,
        title=request.title,
        description=request.description,
        visibility=request.visibility,
    )
    db.add(resource)
    db.flush()
    intro_thread_id = None
    if request.resource_type.strip().lower() == "agent":
        agent = db.get(ProfessorAgent, request.resource_id)
        if agent is not None:
            intro_body = generate_agent_intro(db, agent, sharer_name=user.name)
            thread = CommunityThread(
                group_id=group_id,
                author_id=user.id,
                title=f"Meet {agent.name}",
                body=intro_body,
            )
            db.add(thread)
            db.flush()
            intro_thread_id = thread.id
            adjust_reputation(db, user.id, REPUTATION_CREATE_THREAD)
    db.commit()
    db.refresh(resource)
    return _shared_resource_response(db, resource, intro_thread_id=intro_thread_id)


@router.get(
    "/groups/{group_id}/shared-resources/{resource_id}",
    response_model=SharedResourceDetailResponse,
)
def get_shared_resource(
    group_id: uuid.UUID,
    resource_id: uuid.UUID,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> SharedResourceDetailResponse:
    group = _group(db, group_id)
    _require_group_access(db, group, user)
    resource = db.scalar(
        select(SharedResource).where(
            SharedResource.id == resource_id,
            SharedResource.group_id == group_id,
        )
    )
    if resource is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Shared resource not found.")
    return _shared_resource_detail_response(db, resource, user)


def _validate_shared_resource_guardrails(
    db: Session, request: SharedResourceCreateRequest, user: User
) -> None:
    resource_type = request.resource_type.strip().lower()
    if resource_type in BLOCKED_SHARED_RESOURCE_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Raw materials and uploaded files cannot be shared directly. Share a generated quiz, deck, or summary instead.",
        )

    if _contains_raw_material_reference(request.title) or _contains_raw_material_reference(
        request.description
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Shared resources cannot expose raw upload paths or file URLs.",
        )

    model = SHAREABLE_RESOURCE_MODELS.get(resource_type)
    if model is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="This resource type is not shareable yet.",
        )

    resource = db.get(model, request.resource_id)
    if resource is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Resource not found.")

    owner_id = getattr(resource, "user_id", None)
    if owner_id != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="You can only share resources from your own workspace.",
        )


def _contains_raw_material_reference(value: str | None) -> bool:
    return bool(value and RAW_MATERIAL_REFERENCE_PATTERN.search(value))


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "group"


def _unique_slug(db: Session, name: str) -> str:
    base = _slug(name)
    slug = base
    index = 2
    while db.scalar(select(CommunityGroup.id).where(CommunityGroup.slug == slug)):
        slug = f"{base}-{index}"
        index += 1
    return slug


def _group(db: Session, group_id: uuid.UUID) -> CommunityGroup:
    group = db.get(CommunityGroup, group_id)
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Group {group_id} was not found.")
    return group


def _thread(db: Session, thread_id: uuid.UUID) -> CommunityThread:
    thread = db.get(CommunityThread, thread_id)
    if thread is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=f"Thread {thread_id} was not found."
        )
    return thread


def _reply(db: Session, reply_id: uuid.UUID) -> CommunityReply:
    reply = db.get(CommunityReply, reply_id)
    if reply is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Reply {reply_id} was not found.")
    return reply


def _membership(db: Session, group_id: uuid.UUID, user_id: uuid.UUID) -> CommunityMembership | None:
    return db.scalar(
        select(CommunityMembership).where(
            CommunityMembership.group_id == group_id,
            CommunityMembership.user_id == user_id,
            CommunityMembership.status == "active",
        )
    )


def _require_active_member(db: Session, group_id: uuid.UUID, user_id: uuid.UUID) -> CommunityMembership:
    membership = _membership(db, group_id, user_id)
    if membership is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Join the group before posting.")
    return membership


def _require_group_access(db: Session, group: CommunityGroup, user: User | None) -> None:
    if group.visibility == "public":
        return
    if user is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sign in to view this group.")
    if user_is_super_admin(user):
        return
    if group.owner_id == user.id:
        return
    if _membership(db, group.id, user.id) is not None:
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You do not have access to this group.")


def _require_group_role(
    db: Session, group_id: uuid.UUID, user_id: uuid.UUID, roles: frozenset[str]
) -> CommunityMembership:
    membership = _membership(db, group_id, user_id)
    if membership is None or membership.role not in roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")
    return membership


def _can_moderate(db: Session, group_id: uuid.UUID, user: User) -> bool:
    if user_is_super_admin(user):
        return True
    group = db.get(CommunityGroup, group_id)
    if group is not None and group.owner_id == user.id:
        return True
    membership = _membership(db, group_id, user.id)
    return membership is not None and membership.role in MODERATOR_ROLES


def _visible_groups_query(db: Session, user: User | None):
    query = select(CommunityGroup)
    if user is None:
        return query.where(CommunityGroup.visibility == "public")
    member_group_ids = db.scalars(
        select(CommunityMembership.group_id).where(
            CommunityMembership.user_id == user.id,
            CommunityMembership.status == "active",
        )
    ).all()
    visibility_filter = [CommunityGroup.visibility == "public"]
    if member_group_ids:
        visibility_filter.append(CommunityGroup.id.in_(member_group_ids))
    return query.where(or_(*visibility_filter))


def _reply_count(db: Session, thread_id: uuid.UUID) -> int:
    count = db.scalar(
        select(func.count()).select_from(CommunityReply).where(CommunityReply.thread_id == thread_id)
    )
    return int(count or 0)


def _group_response(db: Session, group: CommunityGroup, user: User | None) -> CommunityGroupResponse:
    membership = _membership(db, group.id, user.id) if user else None
    owner = group.owner
    return CommunityGroupResponse(
        id=group.id,
        name=group.name,
        slug=group.slug,
        description=group.description,
        visibility=group.visibility,
        school_name=group.school_name,
        owner_id=group.owner_id,
        owner_name=owner.name if owner else None,
        member_count=group.member_count,
        is_member=membership is not None,
        membership_role=membership.role if membership else None,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


def _vote_summary(
    db: Session, target_type: str, target_id: uuid.UUID, user: User | None
) -> tuple[int, int, int, int | None]:
    rows = db.execute(
        select(CommunityVote.vote, func.count())
        .where(CommunityVote.target_type == target_type, CommunityVote.target_id == target_id)
        .group_by(CommunityVote.vote)
    ).all()
    upvotes = 0
    downvotes = 0
    for vote_value, count in rows:
        if vote_value == 1:
            upvotes = int(count)
        elif vote_value == -1:
            downvotes = int(count)
    user_vote = None
    if user is not None:
        existing = db.scalar(
            select(CommunityVote.vote).where(
                CommunityVote.user_id == user.id,
                CommunityVote.target_type == target_type,
                CommunityVote.target_id == target_id,
            )
        )
        user_vote = int(existing) if existing is not None else None
    return upvotes, downvotes, upvotes - downvotes, user_vote


def _set_vote(
    db: Session, user_id: uuid.UUID, target_type: str, target_id: uuid.UUID, vote: int
) -> None:
    existing = db.scalar(
        select(CommunityVote).where(
            CommunityVote.user_id == user_id,
            CommunityVote.target_type == target_type,
            CommunityVote.target_id == target_id,
        )
    )
    if vote == 0:
        if existing is not None:
            db.delete(existing)
        return
    if existing is None:
        db.add(
            CommunityVote(
                user_id=user_id,
                target_type=target_type,
                target_id=target_id,
                vote=vote,
            )
        )
    else:
        existing.vote = vote


def _thread_response(
    db: Session, thread: CommunityThread, user: User | None = None
) -> CommunityThreadResponse:
    author = thread.author if hasattr(thread, "author") else None
    if author is None:
        author = db.get(User, thread.author_id)
    upvotes, downvotes, score, user_vote = _vote_summary(db, "thread", thread.id, user)
    return CommunityThreadResponse(
        id=thread.id,
        group_id=thread.group_id,
        title=thread.title,
        body=thread.body,
        author_id=thread.author_id,
        author_name=author.name if author else None,
        pinned=thread.pinned,
        locked=thread.locked,
        reply_count=_reply_count(db, thread.id),
        upvote_count=upvotes,
        downvote_count=downvotes,
        score=score,
        user_vote=user_vote,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
    )


def _profile_thread_summary(db: Session, thread: CommunityThread) -> CommunityProfileThreadSummary:
    group = db.get(CommunityGroup, thread.group_id)
    _, _, score, _ = _vote_summary(db, "thread", thread.id, None)
    return CommunityProfileThreadSummary(
        id=thread.id,
        group_id=thread.group_id,
        group_slug=group.slug if group else "",
        title=thread.title,
        reply_count=_reply_count(db, thread.id),
        score=score,
        created_at=thread.created_at,
    )


def _profile_reply_summary(db: Session, reply: CommunityReply) -> CommunityProfileReplySummary:
    thread = db.get(CommunityThread, reply.thread_id)
    group = db.get(CommunityGroup, thread.group_id) if thread else None
    _, _, score, _ = _vote_summary(db, "reply", reply.id, None)
    return CommunityProfileReplySummary(
        id=reply.id,
        thread_id=reply.thread_id,
        group_slug=group.slug if group else "",
        body=reply.body,
        score=score,
        created_at=reply.created_at,
    )


def _reply_response(
    db: Session, reply: CommunityReply, user: User | None = None
) -> CommunityReplyResponse:
    author = reply.author if hasattr(reply, "author") else None
    if author is None:
        author = db.get(User, reply.author_id)
    upvotes, downvotes, score, user_vote = _vote_summary(db, "reply", reply.id, user)
    return CommunityReplyResponse(
        id=reply.id,
        thread_id=reply.thread_id,
        parent_id=reply.parent_id,
        body=reply.body,
        author_id=reply.author_id,
        author_name=author.name if author else None,
        upvote_count=upvotes,
        downvote_count=downvotes,
        score=score,
        user_vote=user_vote,
        created_at=reply.created_at,
        updated_at=reply.updated_at,
    )


def _shared_resource_response(
    db: Session, resource: SharedResource, *, intro_thread_id: uuid.UUID | None = None
) -> SharedResourceResponse:
    sharer = resource.shared_by_user if hasattr(resource, "shared_by_user") else None
    if sharer is None:
        sharer = db.get(User, resource.shared_by_user_id)
    return SharedResourceResponse(
        id=resource.id,
        group_id=resource.group_id,
        resource_type=resource.resource_type,
        resource_id=resource.resource_id,
        title=resource.title,
        description=resource.description,
        visibility=resource.visibility,
        shared_by_user_id=resource.shared_by_user_id,
        shared_by_name=sharer.name if sharer else None,
        intro_thread_id=intro_thread_id,
        created_at=resource.created_at,
    )


def _shared_resource_detail_response(
    db: Session, resource: SharedResource, viewer: User | None
) -> SharedResourceDetailResponse:
    base = _shared_resource_response(db, resource)
    agent_preview = None
    is_owner = False
    if resource.resource_type.strip().lower() == "agent":
        agent = db.get(ProfessorAgent, resource.resource_id)
        if agent is not None:
            agent_preview = SharedAgentPreview(
                id=agent.id,
                name=agent.name,
                description=agent.description,
                subject_area=agent.subject_area,
                difficulty=agent.difficulty,
                marking_strictness=agent.marking_strictness,
                feedback_tone=agent.feedback_tone,
                avatar_url=agent.avatar_url,
                intro_message=agent.intro_message,
                capabilities_summary=agent.capabilities_summary,
                favorite_topics=list(agent.favorite_topics or []),
                common_traps=list(agent.common_traps or []),
            )
            is_owner = viewer is not None and agent.user_id == viewer.id
    return SharedResourceDetailResponse(
        **base.model_dump(),
        agent_preview=agent_preview,
        is_owner=is_owner,
    )


def _profile_response(
    db: Session, user_id: uuid.UUID, viewer: User | None
) -> CommunityProfileResponse:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found.")
    profile = db.get(CommunityProfile, user_id)
    reputation_score = profile.reputation_score if profile else 0
    bio = profile.bio if profile else None
    study_interests = profile.study_interests if profile and profile.study_interests else []
    memberships = db.scalars(
        select(CommunityMembership)
        .where(CommunityMembership.user_id == user_id, CommunityMembership.status == "active")
        .order_by(CommunityMembership.joined_at.desc())
    ).all()
    joined_groups: list[CommunityProfileGroupSummary] = []
    for membership in memberships:
        group = membership.group if hasattr(membership, "group") else db.get(CommunityGroup, membership.group_id)
        if group is None:
            continue
        if group.visibility != "public":
            if viewer is None or _membership(db, group.id, viewer.id) is None:
                continue
        joined_groups.append(
            CommunityProfileGroupSummary(id=group.id, name=group.name, slug=group.slug)
        )

    thread_count = int(
        db.scalar(
            select(func.count()).select_from(CommunityThread).where(CommunityThread.author_id == user_id)
        )
        or 0
    )
    reply_count = int(
        db.scalar(
            select(func.count()).select_from(CommunityReply).where(CommunityReply.author_id == user_id)
        )
        or 0
    )
    recent_threads = db.scalars(
        select(CommunityThread)
        .where(CommunityThread.author_id == user_id)
        .order_by(CommunityThread.created_at.desc())
        .limit(5)
    ).all()
    recent_replies = db.scalars(
        select(CommunityReply)
        .where(CommunityReply.author_id == user_id)
        .order_by(CommunityReply.created_at.desc())
        .limit(5)
    ).all()

    return CommunityProfileResponse(
        user_id=user.id,
        name=user.name,
        reputation_score=reputation_score,
        reputation_tier=reputation_tier(reputation_score),
        bio=bio,
        study_interests=study_interests,
        joined_groups=joined_groups,
        thread_count=thread_count,
        reply_count=reply_count,
        recent_threads=[_profile_thread_summary(db, thread) for thread in recent_threads],
        recent_replies=[_profile_reply_summary(db, reply) for reply in recent_replies],
    )


def _notification_response(db: Session, notification: CommunityNotification) -> CommunityNotificationResponse:
    actor = notification.actor if hasattr(notification, "actor") else None
    if actor is None and notification.actor_user_id is not None:
        actor = db.get(User, notification.actor_user_id)
    group = notification.group if hasattr(notification, "group") else None
    if group is None and notification.group_id is not None:
        group = db.get(CommunityGroup, notification.group_id)
    return CommunityNotificationResponse(
        id=notification.id,
        notification_type=notification.notification_type,
        title=notification.title,
        body=notification.body,
        actor_user_id=notification.actor_user_id,
        actor_name=actor.name if actor else None,
        group_id=notification.group_id,
        group_slug=group.slug if group else None,
        thread_id=notification.thread_id,
        reply_id=notification.reply_id,
        read_at=notification.read_at,
        created_at=notification.created_at,
    )
