"""Shared vote tally and persistence helpers."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CommunityVote, User


def vote_summary(
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


def set_vote(
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
