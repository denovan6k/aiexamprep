from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    CommunityGroup,
    CommunityNotification,
    CommunityProfile,
    CommunityReply,
    CommunityThread,
    CommunityVote,
    User,
)

REPUTATION_CREATE_THREAD = 3
REPUTATION_CREATE_REPLY = 2
REPUTATION_UPVOTE_THREAD = 5
REPUTATION_UPVOTE_REPLY = 3
REPUTATION_DOWNVOTE = -2


def reputation_tier(score: int) -> str:
    if score >= 200:
        return "trusted"
    if score >= 50:
        return "contributor"
    return "newcomer"


def get_or_create_profile(db: Session, user_id: uuid.UUID) -> CommunityProfile:
    profile = db.get(CommunityProfile, user_id)
    if profile is None:
        profile = CommunityProfile(user_id=user_id)
        db.add(profile)
        db.flush()
    return profile


def adjust_reputation(db: Session, user_id: uuid.UUID, delta: int) -> CommunityProfile:
    profile = get_or_create_profile(db, user_id)
    profile.reputation_score = max(0, profile.reputation_score + delta)
    return profile


def create_notification(
    db: Session,
    *,
    user_id: uuid.UUID,
    actor_user_id: uuid.UUID | None,
    notification_type: str,
    title: str,
    body: str | None = None,
    group_id: uuid.UUID | None = None,
    thread_id: uuid.UUID | None = None,
    reply_id: uuid.UUID | None = None,
) -> CommunityNotification:
    if actor_user_id is not None and actor_user_id == user_id:
        raise ValueError("Cannot notify user about their own action.")
    notification = CommunityNotification(
        user_id=user_id,
        actor_user_id=actor_user_id,
        notification_type=notification_type,
        title=title,
        body=body,
        group_id=group_id,
        thread_id=thread_id,
        reply_id=reply_id,
    )
    db.add(notification)
    return notification


def _vote_reputation_delta(target_type: str, vote: int) -> int:
    if vote == 1:
        return REPUTATION_UPVOTE_THREAD if target_type == "thread" else REPUTATION_UPVOTE_REPLY
    if vote == -1:
        return REPUTATION_DOWNVOTE
    return 0


def _target_author_id(db: Session, target_type: str, target_id: uuid.UUID) -> uuid.UUID | None:
    if target_type == "thread":
        thread = db.get(CommunityThread, target_id)
        return thread.author_id if thread else None
    if target_type == "reply":
        reply = db.get(CommunityReply, target_id)
        return reply.author_id if reply else None
    return None


def apply_vote_effects(
    db: Session,
    *,
    voter_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
    new_vote: int,
) -> int | None:
    existing_vote = db.scalar(
        select(CommunityVote.vote).where(
            CommunityVote.user_id == voter_id,
            CommunityVote.target_type == target_type,
            CommunityVote.target_id == target_id,
        )
    )
    old_vote = int(existing_vote) if existing_vote is not None else None
    author_id = _target_author_id(db, target_type, target_id)
    if author_id is None or author_id == voter_id:
        return old_vote

    if old_vote is not None:
        adjust_reputation(db, author_id, -_vote_reputation_delta(target_type, old_vote))

    if new_vote != 0:
        adjust_reputation(db, author_id, _vote_reputation_delta(target_type, new_vote))
        if new_vote == 1:
            voter = db.get(User, voter_id)
            actor_name = voter.name if voter else "Someone"
            thread = db.get(CommunityThread, target_id) if target_type == "thread" else None
            reply = db.get(CommunityReply, target_id) if target_type == "reply" else None
            if thread is None and reply is not None:
                thread = db.get(CommunityThread, reply.thread_id)
            group_id = thread.group_id if thread else None
            thread_id = thread.id if thread else None
            create_notification(
                db,
                user_id=author_id,
                actor_user_id=voter_id,
                notification_type="upvote",
                title=f"{actor_name} upvoted your {'thread' if target_type == 'thread' else 'reply'}",
                group_id=group_id,
                thread_id=thread_id,
                reply_id=target_id if target_type == "reply" else None,
            )

    return old_vote


def notify_reply(
    db: Session,
    *,
    reply: CommunityReply,
    actor: User,
    thread: CommunityThread,
) -> None:
    recipient_id = thread.author_id
    if reply.parent_id is not None:
        parent = db.get(CommunityReply, reply.parent_id)
        if parent is not None:
            recipient_id = parent.author_id

    if recipient_id == actor.id:
        return

    create_notification(
        db,
        user_id=recipient_id,
        actor_user_id=actor.id,
        notification_type="reply",
        title=f"{actor.name} replied to your discussion",
        body=reply.body[:240],
        group_id=thread.group_id,
        thread_id=thread.id,
        reply_id=reply.id,
    )
