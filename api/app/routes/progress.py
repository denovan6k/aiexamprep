from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import QuizAttempt, User
from app.schemas.integration import ProgressOverviewResponse, TopicScoreResponse
from app.services.progress import average_quiz_score, topic_scores

router = APIRouter()


@router.get("/overview", response_model=ProgressOverviewResponse)
def progress_overview(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ProgressOverviewResponse:
    submitted = db.scalars(
        select(QuizAttempt).where(QuizAttempt.user_id == user.id, QuizAttempt.status == "submitted")
    ).all()
    average = average_quiz_score(db, user.id)
    scores = topic_scores(db, user.id, limit=20)
    mastered = [item.topic for item in scores if item.score_pct >= 80]
    weak = [item.topic for item in scores if item.score_pct < 60]
    recommendations = (
        [f"Review {topic} and generate a focused flashcard deck." for topic in weak[:3]]
        if weak
        else ["Generate a quiz from your latest material to start building progress insights."]
    )
    return ProgressOverviewResponse(
        quizzes_taken=len(submitted),
        average_score=average,
        mastered_topics=mastered,
        weak_topics=weak,
        recommendations=recommendations,
        topic_scores=[
            TopicScoreResponse(topic=item.topic, score_pct=item.score_pct) for item in scores
        ],
    )
