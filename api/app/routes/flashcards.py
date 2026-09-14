from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.pagination import paginate
from app.models import Flashcard, FlashcardDeck, FlashcardReview, MaterialChunk, User
from app.schemas.integration import (
    FlashcardDeckListItemResponse,
    FlashcardDeckResponse,
    FlashcardGenerateRequest,
    FlashcardDeckCreateRequest,
    FlashcardDeckUpdateRequest,
    FlashcardDeckPopulateRequest,
    FlashcardResponse,
    FlashcardReviewRequest,
    FlashcardReviewResponse,
    FlashcardStudyStatsResponse,
    NextUpFlashcardResponse,
)
from app.schemas.pagination import DEFAULT_PAGE_LIMIT, PaginatedResponse
from app.services.generation import generate_flashcards
from app.services.progress import flashcard_due_count, next_up_flashcard
from app.services.usage import enforce_limit, record_usage

router = APIRouter()

@router.post("", response_model=FlashcardDeckResponse, status_code=status.HTTP_201_CREATED)
def create_manual_flashcard_deck(
    request: FlashcardDeckCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FlashcardDeckResponse:
    if not request.cards:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Deck must contain cards.")

    deck = FlashcardDeck(user_id=user.id, course_id=request.course_id, title=request.title)
    db.add(deck)
    db.flush()

    for card in request.cards:
        db.add(
            Flashcard(
                deck_id=deck.id,
                front=card.front,
                back=card.back,
                topic=card.topic,
                difficulty=card.difficulty,
                source_refs=[],
            )
        )

    db.commit()
    return _deck_response(_owned_deck(db, user.id, deck.id))


@router.put("/{deck_id}", response_model=FlashcardDeckResponse)
def update_manual_flashcard_deck(
    deck_id: uuid.UUID,
    request: FlashcardDeckUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FlashcardDeckResponse:
    deck = _owned_deck(db, user.id, deck_id)

    if not request.cards:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Deck must contain cards.")

    deck.title = request.title if request.title is not None else deck.title
    deck.flashcards.clear()
    db.flush()

    for card in request.cards:
        deck.flashcards.append(
            Flashcard(
                deck_id=deck.id,
                front=card.front,
                back=card.back,
                topic=card.topic,
                difficulty=card.difficulty,
                source_refs=[],
            )
        )

    db.commit()
    return _deck_response(_owned_deck(db, user.id, deck.id))


@router.post("/{deck_id}/populate", response_model=FlashcardDeckResponse, status_code=status.HTTP_201_CREATED)
def populate_manual_flashcard_deck(
    deck_id: uuid.UUID,
    request: FlashcardDeckPopulateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FlashcardDeckResponse:
    enforce_limit(db, user.id, "flashcard_generation")
    deck = _owned_deck(db, user.id, deck_id)

    if not request.material_ids:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="material_ids is required.")

    count = request.count or len(deck.flashcards or [])
    if count <= 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Deck must specify a card count to populate.")

    chunks = _retrieval_chunks(
        db,
        user.id,
        deck.course_id,
        request.material_ids,
        count,
    )
    if not chunks:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Upload and process at least one material before generating flashcards.",
        )

    generated = generate_flashcards(
        chunks,
        count=count,
        topic_label=request.title or deck.title,
    )
    if not generated:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No flashcards generated.")

    deck.flashcards.clear()
    db.flush()
    for card in generated:
        deck.flashcards.append(
            Flashcard(
                deck_id=deck.id,
                front=card["front"],
                back=card["back"],
                topic=card.get("topic"),
                difficulty=card.get("difficulty"),
                source_refs=card.get("source_refs") or [],
            )
        )

    record_usage(db, user.id, "flashcard_generation")
    db.commit()
    return _deck_response(_owned_deck(db, user.id, deck.id))


@router.get("/study-stats", response_model=FlashcardStudyStatsResponse)
def flashcard_study_stats(
    topic: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FlashcardStudyStatsResponse:
    total_cards = len(
        db.scalars(
            select(Flashcard)
            .join(FlashcardDeck, FlashcardDeck.id == Flashcard.deck_id)
            .where(FlashcardDeck.user_id == user.id)
        ).all()
    )
    next_card = next_up_flashcard(db, user.id, topic_hint=topic)
    return FlashcardStudyStatsResponse(
        cards_due=flashcard_due_count(db, user.id),
        total_cards=total_cards,
        next_up=(
            NextUpFlashcardResponse(
                deck_id=next_card.deck_id,
                card_id=next_card.card_id,
                topic=next_card.topic,
                label=next_card.label,
            )
            if next_card
            else None
        ),
    )


@router.get("", response_model=PaginatedResponse[FlashcardDeckListItemResponse])
def list_flashcard_decks(
    q: str | None = None,
    course_id: uuid.UUID | None = None,
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[FlashcardDeckListItemResponse]:
    card_count = func.count(Flashcard.id).label("card_count")
    stmt = (
        select(FlashcardDeck, card_count)
        .outerjoin(Flashcard, Flashcard.deck_id == FlashcardDeck.id)
        .where(FlashcardDeck.user_id == user.id)
        .group_by(FlashcardDeck.id)
    )
    if q and q.strip():
        pattern = f"%{q.strip().lower()}%"
        stmt = stmt.where(func.lower(FlashcardDeck.title).like(pattern))
    if course_id:
        stmt = stmt.where(FlashcardDeck.course_id == course_id)
    stmt = stmt.order_by(FlashcardDeck.created_at.desc())
    rows, total = paginate(db, stmt, limit=limit, offset=offset)
    total_cards = int(
        db.scalar(
            select(func.count())
            .select_from(Flashcard)
            .join(FlashcardDeck, FlashcardDeck.id == Flashcard.deck_id)
            .where(
                FlashcardDeck.user_id == user.id,
                *([FlashcardDeck.course_id == course_id] if course_id else []),
            )
        )
        or 0
    )
    return PaginatedResponse(
        items=[_deck_list_item_response(deck, int(count or 0)) for deck, count in rows],
        total=total,
        limit=limit,
        offset=offset,
        meta={"total_cards": total_cards},
    )


@router.post("/generate", response_model=FlashcardDeckResponse, status_code=status.HTTP_201_CREATED)
def generate_deck(
    request: FlashcardGenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FlashcardDeckResponse:
    enforce_limit(db, user.id, "chat_prompt")
    chunks = _retrieval_chunks(db, user.id, request.course_id, request.material_ids, request.count)
    if not chunks:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Upload and process at least one material before generating flashcards.",
        )
    generated = generate_flashcards(chunks, count=request.count, topic_label=request.title)
    if not generated:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No flashcards generated.")

    deck = FlashcardDeck(user_id=user.id, course_id=request.course_id, title=request.title)
    db.add(deck)
    db.flush()
    for card in generated:
        db.add(
            Flashcard(
                deck_id=deck.id,
                front=card["front"],
                back=card["back"],
                topic=card.get("topic"),
                difficulty=card.get("difficulty"),
                source_refs=card.get("source_refs") or [],
            )
        )
    record_usage(db, user.id, "chat_prompt")
    db.commit()
    return _deck_response(_owned_deck(db, user.id, deck.id))


@router.post(
    "/{deck_id}/cards/{card_id}/review",
    response_model=FlashcardReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def review_flashcard(
    deck_id: uuid.UUID,
    card_id: uuid.UUID,
    request: FlashcardReviewRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FlashcardReviewResponse:
    deck = _owned_deck(db, user.id, deck_id)
    card = db.scalar(select(Flashcard).where(Flashcard.id == card_id, Flashcard.deck_id == deck.id))
    if card is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Flashcard {card_id} was not found.")

    review = db.scalar(
        select(FlashcardReview).where(
            FlashcardReview.user_id == user.id, FlashcardReview.flashcard_id == card.id
        )
    )
    if review is None:
        review = FlashcardReview(
            user_id=user.id,
            flashcard_id=card.id,
            confidence=request.confidence,
        )
    else:
        review.confidence = request.confidence
        review.reviewed_at = datetime.now(UTC)
    db.add(review)
    db.commit()
    db.refresh(review)
    return FlashcardReviewResponse(
        flashcard_id=review.flashcard_id,
        confidence=review.confidence,
        reviewed_at=review.reviewed_at,
    )


@router.get("/{deck_id}/cards", response_model=list[FlashcardResponse])
def list_deck_cards(
    deck_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FlashcardResponse]:
    deck = _owned_deck(db, user.id, deck_id)
    return [_card_response(card) for card in deck.flashcards]


@router.get("/{deck_id}", response_model=FlashcardDeckResponse)
def get_flashcard_deck(
    deck_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FlashcardDeckResponse:
    return _deck_response(_owned_deck(db, user.id, deck_id))


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flashcard_deck(
    deck_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    deck = _owned_deck(db, user.id, deck_id)
    db.delete(deck)
    db.commit()


def _retrieval_chunks(
    db: Session,
    user_id: uuid.UUID,
    course_id: uuid.UUID | None,
    material_ids: list[uuid.UUID],
    count: int,
) -> list[dict[str, Any]]:
    query = (
        select(MaterialChunk)
        .join(MaterialChunk.material)
        .where(MaterialChunk.material.has(user_id=user_id))
        .order_by(MaterialChunk.chunk_index.asc())
        .limit(max(8, count * 2))
    )
    if course_id:
        query = query.where(MaterialChunk.material.has(course_id=course_id))
    if material_ids:
        query = query.where(MaterialChunk.material_id.in_(material_ids))
    chunks = db.scalars(query).all()
    return [
        {"id": chunk.id, "text": chunk.text, "material_title": chunk.material.title}
        for chunk in chunks
    ]


def _owned_deck(db: Session, user_id: uuid.UUID, deck_id: uuid.UUID) -> FlashcardDeck:
    deck = db.scalar(
        select(FlashcardDeck)
        .options(selectinload(FlashcardDeck.flashcards))
        .where(FlashcardDeck.id == deck_id, FlashcardDeck.user_id == user_id)
    )
    if deck is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Deck {deck_id} was not found.")
    return deck


def _deck_list_item_response(deck: FlashcardDeck, card_count: int) -> FlashcardDeckListItemResponse:
    return FlashcardDeckListItemResponse(
        id=deck.id,
        course_id=deck.course_id,
        title=deck.title,
        card_count=card_count,
        source_attempt_id=deck.source_attempt_id,
        source_action=deck.source_action,
        source_topics=deck.source_topics or [],
        created_at=deck.created_at,
        updated_at=deck.updated_at,
    )


def _deck_response(deck: FlashcardDeck) -> FlashcardDeckResponse:
    return FlashcardDeckResponse(
        id=deck.id,
        course_id=deck.course_id,
        title=deck.title,
        source_attempt_id=deck.source_attempt_id,
        source_action=deck.source_action,
        source_topics=deck.source_topics or [],
        flashcards=[_card_response(card) for card in deck.flashcards],
        created_at=deck.created_at,
        updated_at=deck.updated_at,
    )


def _card_response(card: Flashcard) -> FlashcardResponse:
    return FlashcardResponse(
        id=card.id,
        front=card.front,
        back=card.back,
        topic=card.topic,
        difficulty=card.difficulty,
        source_refs=card.source_refs,
    )
