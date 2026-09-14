from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Flashcard,
    FlashcardDeck,
    FlashcardReview,
    ProfessorAgent,
    Question,
    Quiz,
    QuizAnswer,
    QuizAttempt,
)


@dataclass(frozen=True)
class TopicScore:
    topic: str
    score_pct: float


@dataclass(frozen=True)
class NextUpFlashcard:
    deck_id: uuid.UUID
    card_id: uuid.UUID
    topic: str | None
    label: str


def average_quiz_score(
    db: Session, user_id: uuid.UUID, course_id: uuid.UUID | None = None
) -> float:
    query = select(QuizAttempt).where(
        QuizAttempt.user_id == user_id, QuizAttempt.status == "submitted"
    )
    if course_id is not None:
        query = query.join(Quiz, Quiz.id == QuizAttempt.quiz_id).where(Quiz.course_id == course_id)
    submitted = db.scalars(query).all()
    ratios = [
        float(attempt.score or 0) / float(attempt.max_score or 1)
        for attempt in submitted
        if attempt.max_score
    ]
    return round((sum(ratios) / len(ratios)) * 100, 1) if ratios else 0.0


def topic_scores(
    db: Session,
    user_id: uuid.UUID,
    limit: int = 5,
    course_id: uuid.UUID | None = None,
) -> list[TopicScore]:
    query = (
        select(Question.topic, func.avg(func.coalesce(QuizAnswer.score, 0)).label("avg_score"))
        .join(QuizAnswer, QuizAnswer.question_id == Question.id)
        .join(QuizAttempt, QuizAttempt.id == QuizAnswer.attempt_id)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .where(
            QuizAttempt.user_id == user_id,
            QuizAttempt.status == "submitted",
            Question.topic.is_not(None),
        )
        .group_by(Question.topic)
        .order_by(func.avg(func.coalesce(QuizAnswer.score, 0)).asc())
    )
    if course_id is not None:
        query = query.where(Quiz.course_id == course_id)
    rows = db.execute(query).all()
    scores = [
        TopicScore(topic=topic, score_pct=round(float(avg_score or 0) * 100, 1))
        for topic, avg_score in rows
        if topic
    ]
    weak_first = sorted(scores, key=lambda item: item.score_pct)
    return weak_first[:limit]


def build_agent_insight(
    agent: ProfessorAgent | None,
    topic_scores_list: list[TopicScore],
    current_topic: str | None,
) -> str | None:
    if agent and agent.common_traps:
        trap = agent.common_traps[0]
        if current_topic:
            return (
                f"You often miss {current_topic} questions when distractors mention {trap.lower()}."
            )
        return f"Watch for distractors that mention {trap.lower()}."

    if current_topic:
        match = next((item for item in topic_scores_list if item.topic == current_topic), None)
        if match and match.score_pct < 60:
            return f"{current_topic} is below target at {match.score_pct}% — slow down on application-style distractors."

    weak = [item for item in topic_scores_list if item.score_pct < 60]
    if weak:
        return f"Focus next on {weak[0].topic} ({weak[0].score_pct}% accuracy) before moving to new material."

    if agent and agent.question_style:
        style = agent.question_style
        if isinstance(style, dict):
            summary = style.get("summary") or style.get("tone")
            if isinstance(summary, str) and summary.strip():
                return summary.strip()

    return None


def agent_style_summary(agent: ProfessorAgent | None) -> str | None:
    if agent is None:
        return None
    if agent.question_style and isinstance(agent.question_style, dict):
        summary = agent.question_style.get("summary")
        if isinstance(summary, str) and summary.strip():
            return summary.strip()
    if agent.difficulty and agent.marking_strictness:
        return (
            f"{agent.difficulty.title()} difficulty · {agent.marking_strictness.replace('_', ' ')}"
        )
    return agent.subject_area


def flashcard_due_count(db: Session, user_id: uuid.UUID, course_id: uuid.UUID | None = None) -> int:
    query = (
        select(Flashcard)
        .join(FlashcardDeck, FlashcardDeck.id == Flashcard.deck_id)
        .where(FlashcardDeck.user_id == user_id)
    )
    if course_id is not None:
        query = query.where(FlashcardDeck.course_id == course_id)
    cards = db.scalars(query).all()
    if not cards:
        return 0

    reviews = {
        review.flashcard_id: review
        for review in db.scalars(
            select(FlashcardReview).where(FlashcardReview.user_id == user_id)
        ).all()
    }
    due_cutoff = datetime.now(UTC) - timedelta(days=1)
    due = 0
    for card in cards:
        review = reviews.get(card.id)
        if review is None:
            due += 1
            continue
        if review.confidence == "again" and review.reviewed_at <= due_cutoff:
            due += 1
    return due


def next_up_flashcard(
    db: Session,
    user_id: uuid.UUID,
    topic_hint: str | None = None,
    course_id: uuid.UUID | None = None,
) -> NextUpFlashcard | None:
    query = (
        select(FlashcardDeck)
        .where(FlashcardDeck.user_id == user_id)
        .order_by(FlashcardDeck.updated_at.desc())
    )
    if course_id is not None:
        query = query.where(FlashcardDeck.course_id == course_id)
    decks = db.scalars(query).all()
    if not decks:
        return None

    reviews = {
        review.flashcard_id: review
        for review in db.scalars(
            select(FlashcardReview).where(FlashcardReview.user_id == user_id)
        ).all()
    }
    due_cutoff = datetime.now(UTC) - timedelta(days=1)

    def is_due(card_id: uuid.UUID) -> bool:
        review = reviews.get(card_id)
        if review is None:
            return True
        return review.confidence == "again" and review.reviewed_at <= due_cutoff

    prioritized: list[tuple[FlashcardDeck, Flashcard]] = []
    fallback: list[tuple[FlashcardDeck, Flashcard]] = []
    for deck in decks:
        cards = db.scalars(select(Flashcard).where(Flashcard.deck_id == deck.id)).all()
        for card in cards:
            if not is_due(card.id):
                continue
            entry = (deck, card)
            if topic_hint and card.topic and topic_hint.lower() in card.topic.lower():
                prioritized.append(entry)
            else:
                fallback.append(entry)

    pick = prioritized[0] if prioritized else (fallback[0] if fallback else None)
    if pick is None:
        return None

    deck, card = pick
    return NextUpFlashcard(
        deck_id=deck.id,
        card_id=card.id,
        topic=card.topic,
        label=card.front,
    )


def pace_estimate_minutes(
    *,
    answered_count: int,
    total_questions: int,
    elapsed_seconds: int,
) -> int | None:
    if answered_count <= 0 or total_questions <= 0 or elapsed_seconds <= 0:
        return None
    remaining = max(total_questions - answered_count, 0)
    seconds_per_question = elapsed_seconds / answered_count
    return max(1, round((remaining * seconds_per_question) / 60))
