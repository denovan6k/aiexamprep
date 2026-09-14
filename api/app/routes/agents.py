from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.pagination import paginate
from app.models import AgentMcpConnection, ProfessorAgent, Question, QuestionRating, Quiz, User
from app.schemas.pagination import DEFAULT_PAGE_LIMIT, PaginatedResponse
from app.schemas.agents import (
    AgentAvatarUploadResponse,
    AgentCreateRequest,
    AgentResponse,
    AgentUpdateRequest,
    QuestionRatingRequest,
    QuestionRatingResponse,
)
from app.services.generation import generate_agent_profile
from app.services.usage import enforce_limit, record_usage

router = APIRouter()

ALLOWED_AVATAR_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
MAX_AVATAR_BYTES = 5 * 1024 * 1024


@router.get("", response_model=PaginatedResponse[AgentResponse])
def list_agents(
    q: str | None = None,
    difficulty: str | None = None,
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[AgentResponse]:
    stmt = select(ProfessorAgent).where(ProfessorAgent.user_id == user.id)
    if q and q.strip():
        pattern = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(ProfessorAgent.name).like(pattern),
                func.lower(ProfessorAgent.subject_area).like(pattern),
                func.lower(ProfessorAgent.description).like(pattern),
            )
        )
    if difficulty and difficulty.strip():
        stmt = stmt.where(ProfessorAgent.difficulty == difficulty.strip().lower())
    stmt = stmt.order_by(ProfessorAgent.created_at.desc())
    agents, total = paginate(db, stmt, limit=limit, offset=offset)
    return PaginatedResponse(
        items=[_to_response(db, agent) for agent in agents],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    request: AgentCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentResponse:
    enforce_limit(db, user.id, "agent_create")
    profile = generate_agent_profile(request.description)
    agent = ProfessorAgent(
        user_id=user.id,
        name=request.name or profile.get("name") or "Custom Examiner",
        description=request.description,
        subject_area=request.subject_area or profile.get("subject_area"),
        difficulty=profile.get("difficulty"),
        marking_strictness=profile.get("marking_strictness"),
        question_style=profile.get("question_style") or {},
        favorite_topics=profile.get("favorite_topics") or [],
        common_traps=profile.get("common_traps") or [],
        feedback_tone=profile.get("feedback_tone"),
        rubric_preferences=profile.get("rubric_preferences") or {},
    )
    db.add(agent)
    db.flush()
    record_usage(db, user.id, "agent_create")
    db.commit()
    return _to_response(db, agent)


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentResponse:
    return _to_response(db, _owned_agent(db, user.id, agent_id))


@router.patch("/{agent_id}", response_model=AgentResponse)
def update_agent(
    agent_id: uuid.UUID,
    request: AgentUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentResponse:
    agent = _owned_agent(db, user.id, agent_id)
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return _to_response(db, agent)


@router.post("/{agent_id}/avatar", response_model=AgentAvatarUploadResponse)
async def upload_agent_avatar(
    agent_id: uuid.UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentAvatarUploadResponse:
    agent = _owned_agent(db, user.id, agent_id)
    content_type = (file.content_type or "").lower()
    extension = ALLOWED_AVATAR_TYPES.get(content_type)
    if extension is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a JPG, PNG, GIF, or WebP image.",
        )

    contents = await file.read(MAX_AVATAR_BYTES + 1)
    if len(contents) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Images must be 5 MB or smaller.",
        )

    upload_root = Path(settings.upload_dir).resolve() / "agents"
    upload_root.mkdir(parents=True, exist_ok=True)
    image_name = f"{datetime.now(UTC):%Y%m%d}-{uuid.uuid4().hex}{extension}"
    image_path = upload_root / image_name
    image_path.write_bytes(contents)

    public_base = settings.public_upload_base_url.rstrip("/")
    avatar_url = f"{public_base}/agents/{image_name}"
    agent.avatar_url = avatar_url
    db.add(agent)
    db.commit()
    return AgentAvatarUploadResponse(avatar_url=avatar_url)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    agent = _owned_agent(db, user.id, agent_id)
    db.delete(agent)
    db.commit()


@router.post(
    "/questions/{question_id}/rating",
    response_model=QuestionRatingResponse,
    status_code=status.HTTP_201_CREATED,
)
def rate_question(
    question_id: uuid.UUID,
    request: QuestionRatingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuestionRatingResponse:
    question = db.scalar(
        select(Question)
        .join(Question.quiz)
        .where(Question.id == question_id, Quiz.user_id == user.id)
    )
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Question {question_id} was not found.")

    quiz = question.quiz
    existing = db.scalar(
        select(QuestionRating).where(
            QuestionRating.user_id == user.id, QuestionRating.question_id == question_id
        )
    )
    if existing:
        existing.rating = request.rating
        existing.professor_agent_id = quiz.professor_agent_id
        _apply_rating_to_agent(quiz.professor_agent, question, request.rating)
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return _rating_response(existing)

    rating = QuestionRating(
        user_id=user.id,
        question_id=question_id,
        professor_agent_id=quiz.professor_agent_id,
        rating=request.rating,
    )
    db.add(rating)
    _apply_rating_to_agent(quiz.professor_agent, question, request.rating)
    db.commit()
    db.refresh(rating)
    return _rating_response(rating)


def _owned_agent(db: Session, user_id: uuid.UUID, agent_id: uuid.UUID) -> ProfessorAgent:
    agent = db.scalar(
        select(ProfessorAgent).where(
            ProfessorAgent.id == agent_id, ProfessorAgent.user_id == user_id
        )
    )
    if agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} was not found.")
    return agent


def _to_response(db: Session, agent: ProfessorAgent) -> AgentResponse:
    mcp_count = int(
        db.scalar(
            select(func.count())
            .select_from(AgentMcpConnection)
            .where(AgentMcpConnection.agent_id == agent.id)
        )
        or 0
    )
    return AgentResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        subject_area=agent.subject_area,
        difficulty=agent.difficulty,
        marking_strictness=agent.marking_strictness,
        question_style=agent.question_style,
        favorite_topics=agent.favorite_topics,
        common_traps=agent.common_traps,
        feedback_tone=agent.feedback_tone,
        rubric_preferences=agent.rubric_preferences,
        avatar_url=agent.avatar_url,
        intro_message=agent.intro_message,
        capabilities_summary=agent.capabilities_summary,
        mcp_connection_count=mcp_count,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


def _apply_rating_to_agent(
    agent: ProfessorAgent | None,
    question: Question,
    rating: str,
) -> None:
    if agent is None:
        return
    rubric = dict(agent.rubric_preferences or {})
    feedback = dict(rubric.get("feedback") or {})
    feedback["up"] = int(feedback.get("up") or 0) + (1 if rating == "up" else 0)
    feedback["down"] = int(feedback.get("down") or 0) + (1 if rating == "down" else 0)
    rubric["feedback"] = feedback

    if rating == "down":
        trap = f"Review weak wording around {question.topic or 'generated questions'}"
        traps = list(agent.common_traps or [])
        if trap not in traps:
            traps.append(trap)
        agent.common_traps = traps[-12:]
        rubric["needs_review"] = True
    elif question.topic:
        topics = list(agent.favorite_topics or [])
        if question.topic not in topics:
            topics.append(question.topic)
        agent.favorite_topics = topics[-12:]

    agent.rubric_preferences = rubric


def _rating_response(rating: QuestionRating) -> QuestionRatingResponse:
    return QuestionRatingResponse(
        id=rating.id,
        question_id=rating.question_id,
        professor_agent_id=rating.professor_agent_id,
        rating=rating.rating,  # type: ignore[arg-type]
        created_at=rating.created_at,
        updated_at=rating.updated_at,
    )
