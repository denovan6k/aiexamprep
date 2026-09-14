from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.pagination import paginate
from app.core.rate_limit import rate_limit_quiz_generation
from app.models import (
    Flashcard,
    FlashcardDeck,
    MaterialChunk,
    ProfessorAgent,
    Question,
    Quiz,
    QuizAnswer,
    QuizAttempt,
    User,
)
from app.schemas.core_study import (
    RemediationOptionsResponse,
    RemediationRequest,
    RemediationResponse,
)
from app.schemas.integration import (
    AgentSummaryResponse,
    FlagAnswerRequest,
    NextUpFlashcardResponse,
    QuestionPlayResponse,
    QuestionResponse,
    QuizAnswerProgressResponse,
    QuizAnswerResponse,
    QuizAttemptDetailResponse,
    QuizAttemptResponse,
    QuizEditorResponse,
    QuizGenerateRequest,
    QuizListItemResponse,
    QuizRegenerateRequest,
    QuizResponse,
    QuizReviewResponse,
    QuizSessionContextResponse,
    QuizUpdateRequest,
    QuizManualCreateRequest,
    QuizManualContentUpdateRequest,
    QuizPopulateRequest,
    SaveAnswerRequest,
    TopicScoreResponse,
)
from app.schemas.pagination import DEFAULT_PAGE_LIMIT, PaginatedResponse
from app.services.generation import (
    persist_generated_quiz,
    generate_questions,
    generation_failure_payload,
    has_usable_correct_answers,
    normalize_true_false_answer,
    rank_chunks_by_query,
    resolve_stored_correct_answers,
    sanitize_question_options,
    score_subjective_answer,
)
from app.services.progress import (
    agent_style_summary,
    average_quiz_score,
    build_agent_insight,
    flashcard_due_count,
    next_up_flashcard,
    pace_estimate_minutes,
    topic_scores,
)
from app.services.usage import enforce_limit, record_usage
from app.services.core_study import link_remediation_plan_items
from app.services.chat import (
    build_quiz_regeneration_context,
    resolve_quiz_source_thread_id,
)

router = APIRouter()


@router.get("", response_model=PaginatedResponse[QuizListItemResponse])
def list_quizzes(
    q: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    course_id: uuid.UUID | None = None,
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[QuizListItemResponse]:
    question_count = func.count(Question.id).label("question_count")
    stmt = (
        select(Quiz, question_count)
        .outerjoin(Question, Question.quiz_id == Quiz.id)
        .where(Quiz.user_id == user.id)
        .group_by(Quiz.id)
    )
    if q and q.strip():
        pattern = f"%{q.strip().lower()}%"
        stmt = stmt.where(func.lower(Quiz.title).like(pattern))
    if status_filter:
        stmt = stmt.where(Quiz.status == status_filter)
    if course_id:
        stmt = stmt.where(Quiz.course_id == course_id)
    stmt = stmt.order_by(Quiz.created_at.desc())
    rows, total = paginate(db, stmt, limit=limit, offset=offset)
    ready_count = int(
        db.scalar(
            select(func.count())
            .select_from(Quiz)
            .where(
                Quiz.user_id == user.id,
                Quiz.status == "ready",
                *([Quiz.course_id == course_id] if course_id else []),
            )
        )
        or 0
    )
    return PaginatedResponse(
        items=[_quiz_list_item_response(quiz, int(count or 0)) for quiz, count in rows],
        total=total,
        limit=limit,
        offset=offset,
        meta={"ready_count": ready_count},
    )


@router.post("", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
def create_manual_quiz(
    request: QuizManualCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizResponse:
    if not request.questions:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Quiz must contain questions.")

    question_types = {q.type for q in request.questions}
    if len(question_types) != 1:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Manual quizzes must use exactly one question type per quiz (v1).",
        )
    question_type = next(iter(question_types))
    if question_type not in {"mcq", "short_answer"}:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Manual quizzes only support mcq and short_answer in v1.",
        )

    options_count = request.options_count
    if question_type == "mcq":
        first_options = getattr(request.questions[0], "options", None) or []
        if options_count is None:
            options_count = len(first_options)
        if not options_count or options_count < 2:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="options_count is required (or must be inferrable from question options).",
            )

    config: dict[str, Any] = {
        "source": "manual",
        "count": len(request.questions),
        "question_types": [question_type],
        "timer_minutes": request.timer_minutes,
        "shuffle_questions": request.shuffle_questions,
        "shuffle_options": request.shuffle_options,
    }
    if question_type == "mcq":
        config["options_count"] = options_count
    if question_type == "short_answer":
        config["short_answer_grading"] = request.short_answer_grading

    quiz = Quiz(
        user_id=user.id,
        course_id=request.course_id,
        professor_agent_id=request.professor_agent_id,
        title=request.title,
        config=config,
        status="draft",
    )
    db.add(quiz)
    db.flush()

    for q in request.questions:
        if question_type == "mcq":
            options = getattr(q, "options", []) or []
            correct_id = getattr(q, "correct_option_id", "") or ""
            correct_answers = [correct_id] if correct_id else []
            db.add(
                Question(
                    quiz_id=quiz.id,
                    type="mcq",
                    prompt=getattr(q, "prompt", "") or "",
                    options=[{"id": opt.id, "text": opt.text} for opt in options],
                    correct_answers=correct_answers,
                    explanation=getattr(q, "explanation", None),
                    topic=getattr(q, "topic", None),
                    difficulty=getattr(q, "difficulty", None),
                    source_refs=[],
                    rubric={"expected_keywords": correct_answers},
                )
            )
        elif question_type == "short_answer":
            model_answers = getattr(q, "model_answers", []) or []
            db.add(
                Question(
                    quiz_id=quiz.id,
                    type="short_answer",
                    prompt=getattr(q, "prompt", "") or "",
                    options=None,
                    correct_answers=model_answers,
                    explanation=getattr(q, "explanation", None),
                    topic=getattr(q, "topic", None),
                    difficulty=getattr(q, "difficulty", None),
                    source_refs=[],
                    rubric={"expected_keywords": model_answers},
                )
            )

    db.commit()
    quiz = _owned_quiz(db, user.id, quiz.id)
    return _quiz_response(quiz)


@router.get("/{quiz_id}/editor", response_model=QuizEditorResponse)
def get_quiz_editor(
    quiz_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizEditorResponse:
    quiz = _owned_quiz(db, user.id, quiz_id)
    return QuizEditorResponse(
        id=quiz.id,
        course_id=quiz.course_id,
        professor_agent_id=quiz.professor_agent_id,
        title=quiz.title,
        config=quiz.config,
        status=quiz.status,
        questions=[_question_response(question) for question in quiz.questions],
        created_at=quiz.created_at,
        updated_at=quiz.updated_at,
    )


def _quiz_has_submitted_attempt(db: Session, quiz_id: uuid.UUID, *, user_id: uuid.UUID) -> bool:
    return bool(
        db.scalar(
            select(func.count())
            .select_from(QuizAttempt)
            .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user_id, QuizAttempt.status == "submitted")
        )
        or 0
    )


@router.put("/{quiz_id}/content", response_model=QuizResponse)
def update_manual_quiz_content(
    quiz_id: uuid.UUID,
    request: QuizManualContentUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizResponse:
    quiz = _owned_quiz(db, user.id, quiz_id)

    if _quiz_has_submitted_attempt(db, quiz_id, user_id=user.id):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Submitted attempts cannot be edited.")

    if not request.questions:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Quiz must contain questions.")

    question_types = {q.type for q in request.questions}
    if len(question_types) != 1:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="All questions must share one type.")
    question_type = next(iter(question_types))
    if question_type not in {"mcq", "short_answer"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported question type.")

    q_count = len(request.questions)
    options_count = request.options_count
    if question_type == "mcq":
        first_options = getattr(request.questions[0], "options", None) or []
        if options_count is None:
            options_count = len(first_options)
        if not options_count or options_count < 2:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="options_count is required for mcq quizzes.",
            )

    if request.status == "ready":
        if question_type == "mcq":
            for idx, q in enumerate(request.questions):
                options = getattr(q, "options", []) or []
                correct_id = getattr(q, "correct_option_id", "") or ""
                if len(options) != options_count:
                    raise HTTPException(
                        status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Question {idx + 1} must have exactly {options_count} options.",
                    )
                if not correct_id or correct_id not in {opt.id for opt in options}:
                    raise HTTPException(
                        status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Question {idx + 1} must specify a valid correct option.",
                    )
        if question_type == "short_answer":
            for idx, q in enumerate(request.questions):
                model_answers = getattr(q, "model_answers", []) or []
                if not model_answers:
                    raise HTTPException(
                        status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Question {idx + 1} must include at least one model answer keyword.",
                    )

    quiz.title = request.title if request.title is not None else quiz.title
    quiz.status = request.status

    existing_config: dict[str, Any] = dict(quiz.config or {})
    if request.short_answer_grading is not None:
        existing_config["short_answer_grading"] = request.short_answer_grading
    if request.options_count is not None:
        existing_config["options_count"] = request.options_count
    if request.shuffle_questions is not None:
        existing_config["shuffle_questions"] = request.shuffle_questions
    if request.shuffle_options is not None:
        existing_config["shuffle_options"] = request.shuffle_options
    if request.timer_minutes is not None:
        existing_config["timer_minutes"] = request.timer_minutes

    existing_config["count"] = q_count
    existing_config["question_types"] = [question_type]
    existing_config["source"] = existing_config.get("source") or "manual"
    quiz.config = existing_config

    # Replace questions wholesale. This keeps validation simple and consistent.
    quiz.questions.clear()
    db.flush()

    for q in request.questions:
        if question_type == "mcq":
            options = getattr(q, "options", []) or []
            correct_id = getattr(q, "correct_option_id", "") or ""
            correct_answers = [correct_id] if correct_id else []
            quiz.questions.append(
                Question(
                    type="mcq",
                    prompt=getattr(q, "prompt", "") or "",
                    options=[{"id": opt.id, "text": opt.text} for opt in options],
                    correct_answers=correct_answers,
                    explanation=getattr(q, "explanation", None),
                    topic=getattr(q, "topic", None),
                    difficulty=getattr(q, "difficulty", None),
                    source_refs=[],
                    rubric={"expected_keywords": correct_answers},
                )
            )
        elif question_type == "short_answer":
            model_answers = getattr(q, "model_answers", []) or []
            quiz.questions.append(
                Question(
                    type="short_answer",
                    prompt=getattr(q, "prompt", "") or "",
                    options=None,
                    correct_answers=model_answers,
                    explanation=getattr(q, "explanation", None),
                    topic=getattr(q, "topic", None),
                    difficulty=getattr(q, "difficulty", None),
                    source_refs=[],
                    rubric={"expected_keywords": model_answers},
                )
            )

    db.add(quiz)
    db.commit()
    quiz = _owned_quiz(db, user.id, quiz.id)
    return _quiz_response(quiz)


@router.post(
    "/{quiz_id}/populate",
    response_model=QuizResponse,
    status_code=status.HTTP_201_CREATED,
)
def populate_manual_quiz(
    quiz_id: uuid.UUID,
    request: QuizPopulateRequest,
    _rate_limit: None = Depends(rate_limit_quiz_generation),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizResponse:
    enforce_limit(db, user.id, "quiz_generation")

    quiz = _owned_quiz(db, user.id, quiz_id)
    if _quiz_has_submitted_attempt(db, quiz_id, user_id=user.id):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Submitted attempts cannot be edited.")
    if quiz.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Only draft quizzes can be populated.")

    if not request.material_ids:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="material_ids is required.")

    existing_config = dict(quiz.config or {})
    question_type = None
    if isinstance(existing_config.get("question_types"), list) and existing_config.get("question_types"):
        question_type = existing_config["question_types"][0]
    if question_type is None and quiz.questions:
        question_type = quiz.questions[0].type
    if question_type not in {"mcq", "short_answer"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported quiz type for populate.")

    q_count = request.count or int(existing_config.get("count") or len(quiz.questions) or 0)
    if q_count <= 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid question count.")

    difficulty = request.difficulty or existing_config.get("difficulty") or "medium"
    topic_label = request.topic_focus or quiz.title
    options_count = request.options_count
    if question_type == "mcq":
        if options_count is None:
            options_count = int(existing_config.get("options_count") or 4)
        options_count = max(2, min(6, int(options_count)))

    chunks = _retrieval_chunks(
        db,
        user.id,
        quiz.course_id,
        request.material_ids,
        q_count,
        query=request.topic_focus or quiz.title,
    )
    if not chunks:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Upload and process at least one material before generating a quiz.",
        )

    agent = _owned_agent(db, user.id, quiz.professor_agent_id) if quiz.professor_agent_id else None
    generated = generate_questions(
        chunks,
        count=q_count,
        question_types=[question_type],
        difficulty=difficulty,
        topic_label=topic_label,
        agent=_agent_payload_with_insights(db, agent, user.id, request.material_ids) if agent else None,
        variation_seed=uuid.uuid4().int % (2**31),
        options_count=options_count if question_type == "mcq" else 4,
        model=request.model,
    )
    if not generated:
        message, _metadata = generation_failure_payload(default_message="No questions generated.")
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)

    # Replace questions but keep status=draft.
    quiz.questions.clear()
    quiz.questions.extend(
        [
            Question(
                type=item["type"],
                prompt=item["prompt"],
                options=item.get("options"),
                correct_answers=item.get("correct_answers") or [],
                explanation=item.get("explanation"),
                topic=item.get("topic"),
                difficulty=item.get("difficulty"),
                source_refs=item.get("source_refs") or [],
                rubric={"expected_keywords": item.get("correct_answers") or []},
            )
            for item in generated[:q_count]
        ]
    )

    existing_config["source"] = "ai_assisted"
    existing_config["count"] = q_count
    existing_config["question_types"] = [question_type]
    existing_config["difficulty"] = difficulty
    if question_type == "mcq":
        existing_config["options_count"] = options_count
    existing_config["material_ids"] = [str(material_id) for material_id in request.material_ids]
    if request.topic_focus is not None:
        existing_config["topic_focus"] = request.topic_focus

    quiz.config = existing_config
    quiz.status = "draft"

    record_usage(db, user.id, "quiz_generation")
    db.commit()
    quiz = _owned_quiz(db, user.id, quiz.id)
    return _quiz_response(quiz)


@router.post("/generate", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
def generate_quiz(
    request: QuizGenerateRequest,
    _rate_limit: None = Depends(rate_limit_quiz_generation),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizResponse:
    enforce_limit(db, user.id, "chat_prompt")
    chunks = _retrieval_chunks(
        db, user.id, request.course_id, request.material_ids, request.count, query=request.title
    )
    if not chunks:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Upload and process at least one material before generating a quiz.",
        )

    agent = _owned_agent(db, user.id, request.professor_agent_id)
    generated = generate_questions(
        chunks,
        count=request.count,
        question_types=request.question_types,
        difficulty=request.difficulty,
        topic_label=request.title,
        agent=_agent_payload_with_insights(db, agent, user.id, request.material_ids)
        if agent
        else None,
        variation_seed=uuid.uuid4().int % (2**31),
        options_count=request.options_count,
    )
    if not generated:
        message, _metadata = generation_failure_payload(default_message="No questions generated.")
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)

    quiz = persist_generated_quiz(
        db,
        user_id=user.id,
        course_id=request.course_id,
        professor_agent_id=request.professor_agent_id,
        title=request.title,
        config={
            "count": request.count,
            "question_types": request.question_types,
            "difficulty": request.difficulty,
            "timer_minutes": request.timer_minutes,
            "shuffle_questions": request.shuffle_questions,
            "shuffle_options": request.shuffle_options,
            "options_count": request.options_count,
            "material_ids": [str(material_id) for material_id in request.material_ids],
        },
        generated_questions=generated,
    )
    record_usage(db, user.id, "chat_prompt")
    db.commit()
    quiz = _owned_quiz(db, user.id, quiz.id)
    return _quiz_response(quiz)


@router.get("/{quiz_id}/attempts/active", response_model=QuizAttemptResponse)
def get_active_attempt(
    quiz_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizAttemptResponse:
    quiz = _owned_quiz(db, user.id, quiz_id)
    attempt = _latest_in_progress_attempt(db, user.id, quiz_id)
    if attempt is not None:
        attempt = _auto_submit_if_expired(db, attempt, quiz)
        return _attempt_response(attempt, quiz)

    grace_attempt = _recent_auto_submitted_attempt(db, user.id, quiz_id)
    if grace_attempt is not None:
        return _attempt_response(grace_attempt, quiz)

    raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No active attempt for this quiz.")


@router.post(
    "/{quiz_id}/attempts", response_model=QuizAttemptResponse, status_code=status.HTTP_201_CREATED
)
def start_attempt(
    quiz_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizAttemptResponse:
    quiz = _owned_quiz(db, user.id, quiz_id)
    if quiz.status != "ready":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="This quiz is not ready yet. Publish it to start an attempt.")
    valid_questions = []
    for q in quiz.questions:
        if not (q.prompt or "").strip():
            continue
        if q.type in {"mcq", "multi_select", "true_false", "matching"}:
            if not has_usable_correct_answers(q.type, q.options, q.correct_answers, q.explanation):
                continue
        elif q.type in {"short_answer", "theory"}:
            if not has_usable_correct_answers(q.type, q.options, q.correct_answers, q.explanation):
                continue
        else:
            continue
        valid_questions.append(q)
    if not valid_questions:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="This quiz has no valid questions.")
    existing = _latest_in_progress_attempt(db, user.id, quiz_id)
    if existing is not None:
        existing = _auto_submit_if_expired(db, existing, quiz)
        if existing.status == "in_progress":
            return _attempt_response(existing, quiz)

    timing_metadata = _initial_timing_metadata(quiz)
    attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_id=user.id,
        status="in_progress",
        timing_metadata=timing_metadata,
        source_attempt_id=quiz.source_attempt_id,
        source_action="retry" if quiz.source_attempt_id else None,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return _attempt_response(attempt, quiz)


@router.put(
    "/attempts/{attempt_id}/answers/{question_id}",
    response_model=QuizAnswerProgressResponse,
)
def save_answer(
    attempt_id: uuid.UUID,
    question_id: uuid.UUID,
    request: SaveAnswerRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizAnswerProgressResponse:
    attempt = _owned_attempt(db, user.id, attempt_id)
    attempt = _auto_submit_if_expired(db, attempt, _owned_quiz(db, user.id, attempt.quiz_id))
    if attempt.status != "in_progress":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Submitted attempts cannot be edited.")
    question = _question_for_attempt(db, attempt, question_id)
    answer = db.scalar(
        select(QuizAnswer).where(
            QuizAnswer.attempt_id == attempt_id, QuizAnswer.question_id == question_id
        )
    )
    if answer is None:
        answer = QuizAnswer(attempt_id=attempt_id, question_id=question_id)
    answer.answer = request.answer
    if question.type in {"mcq", "multi_select", "true_false", "matching"}:
        score, is_correct, feedback = _score_answer(question, request.answer)
        answer.score = Decimal(str(score))
        answer.is_correct = is_correct
        answer.feedback = feedback
    else:
        answer.is_correct = None
        answer.score = None
        answer.feedback = None
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return _answer_progress_response(answer)


@router.get("/attempts/{attempt_id}", response_model=QuizAttemptDetailResponse)
def get_attempt(
    attempt_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizAttemptDetailResponse:
    attempt = _owned_attempt(db, user.id, attempt_id)
    quiz = _owned_quiz(db, user.id, attempt.quiz_id)
    answers = db.scalars(select(QuizAnswer).where(QuizAnswer.attempt_id == attempt.id)).all()
    return QuizAttemptDetailResponse(
        attempt=_attempt_response(attempt, quiz),
        answers=[_answer_progress_response(answer) for answer in answers],
    )


@router.get("/attempts/{attempt_id}/context", response_model=QuizSessionContextResponse)
def attempt_context(
    attempt_id: uuid.UUID,
    current_topic: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizSessionContextResponse:
    attempt = _owned_attempt(db, user.id, attempt_id)
    quiz = _owned_quiz(db, user.id, attempt.quiz_id)
    attempt = _auto_submit_if_expired(db, attempt, quiz)
    answers = db.scalars(select(QuizAnswer).where(QuizAnswer.attempt_id == attempt.id)).all()
    total_questions = len(quiz.questions)
    answered_count = sum(
        1
        for answer in answers
        if answer.answer is not None and answer.answer != "" and answer.answer != []
    )
    flagged_count = sum(1 for answer in answers if answer.flagged)
    graded = [answer for answer in answers if answer.is_correct is not None]
    correct_count = sum(1 for answer in graded if answer.is_correct)
    started_at = attempt.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=UTC)
    elapsed_seconds = max(0, int((datetime.now(UTC) - started_at).total_seconds()))
    timer_state = _attempt_timer_state(attempt, quiz)
    scores = topic_scores(db, user.id, limit=3)
    next_card = next_up_flashcard(db, user.id, topic_hint=current_topic)
    agent = _owned_agent(db, user.id, quiz.professor_agent_id)

    return QuizSessionContextResponse(
        agent=(
            AgentSummaryResponse(
                id=agent.id,
                name=agent.name,
                subject_area=agent.subject_area,
                style_summary=agent_style_summary(agent),
            )
            if agent
            else None
        ),
        average_score=average_quiz_score(db, user.id),
        cards_due=flashcard_due_count(db, user.id),
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
        topic_focus=[
            TopicScoreResponse(topic=item.topic, score_pct=item.score_pct) for item in scores
        ],
        agent_insight=build_agent_insight(agent, scores, current_topic),
        answered_count=answered_count,
        flagged_count=flagged_count,
        correct_count=correct_count if attempt.status == "submitted" else 0,
        graded_count=len(graded),
        elapsed_seconds=elapsed_seconds,
        pace_estimate_minutes=pace_estimate_minutes(
            answered_count=answered_count,
            total_questions=total_questions,
            elapsed_seconds=elapsed_seconds,
        ),
        timer_seconds=timer_state["timer_seconds"],
        seconds_remaining=timer_state["seconds_remaining"],
        timer_expired=timer_state["timer_expired"],
        deadline_at=timer_state["deadline_at"],
    )


@router.patch(
    "/attempts/{attempt_id}/answers/{question_id}/flag",
    response_model=QuizAnswerProgressResponse,
)
def flag_answer(
    attempt_id: uuid.UUID,
    question_id: uuid.UUID,
    request: FlagAnswerRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizAnswerProgressResponse:
    attempt = _owned_attempt(db, user.id, attempt_id)
    quiz = _owned_quiz(db, user.id, attempt.quiz_id)
    attempt = _auto_submit_if_expired(db, attempt, quiz)
    if attempt.status != "in_progress":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Submitted attempts cannot be edited.")
    _question_for_attempt(db, attempt, question_id)
    answer = db.scalar(
        select(QuizAnswer).where(
            QuizAnswer.attempt_id == attempt_id, QuizAnswer.question_id == question_id
        )
    )
    if answer is None:
        answer = QuizAnswer(attempt_id=attempt_id, question_id=question_id, answer=None)
    answer.flagged = request.flagged
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return _answer_progress_response(answer)


@router.post("/attempts/{attempt_id}/submit", response_model=QuizReviewResponse)
def submit_attempt(
    attempt_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizReviewResponse:
    attempt = _owned_attempt(db, user.id, attempt_id)
    quiz = _owned_quiz(db, user.id, attempt.quiz_id)
    attempt = _auto_submit_if_expired(db, attempt, quiz)
    if attempt.status == "submitted":
        return _review_response(db, attempt)

    grading_mode = (quiz.config or {}).get("short_answer_grading")
    # Default behavior preserves existing scoring: use LLM grading unless the quiz explicitly
    # opts into keyword/heuristic-only scoring.
    allow_llm = grading_mode != "provided_answers"
    return _submit_attempt_record(db, attempt, allow_llm=allow_llm)


@router.get("/attempts/{attempt_id}/review", response_model=QuizReviewResponse)
def review_attempt(
    attempt_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizReviewResponse:
    return _review_response(db, _owned_attempt(db, user.id, attempt_id))


@router.get(
    "/attempts/{attempt_id}/remediation",
    response_model=RemediationOptionsResponse,
)
def get_remediation(
    attempt_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RemediationOptionsResponse:
    attempt = _owned_attempt(db, user.id, attempt_id)
    if attempt.status != "submitted":
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Submit the attempt before creating remediation."
        )
    topics = _weak_topics(db, attempt.id)
    existing: list[RemediationResponse] = []
    for deck in db.scalars(
        select(FlashcardDeck).where(
            FlashcardDeck.user_id == user.id,
            FlashcardDeck.source_attempt_id == attempt.id,
            FlashcardDeck.source_action == "deck",
        )
    ).all():
        existing.append(_remediation_response(attempt, "deck", deck.source_topics or [], deck.id))
    for quiz in db.scalars(
        select(Quiz).where(
            Quiz.user_id == user.id,
            Quiz.source_attempt_id == attempt.id,
            Quiz.source_action == "retry",
        )
    ).all():
        existing.append(_remediation_response(attempt, "retry", quiz.source_topics or [], quiz.id))
    return RemediationOptionsResponse(
        attempt_id=attempt.id,
        weak_topics=topics,
        available_actions=["deck", "retry", "explain"],
        existing=existing,
    )


@router.post(
    "/attempts/{attempt_id}/remediation",
    response_model=RemediationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_remediation(
    attempt_id: uuid.UUID,
    request: RemediationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RemediationResponse:
    attempt = _owned_attempt(db, user.id, attempt_id)
    if attempt.status != "submitted":
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Submit the attempt before creating remediation."
        )
    source_quiz = _owned_quiz(db, user.id, attempt.quiz_id)
    available_topics = _weak_topics(db, attempt.id)
    topics = request.topics or available_topics
    if request.topics:
        allowed = {topic.casefold() for topic in available_topics}
        if any(topic.casefold() not in allowed for topic in topics):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Remediation topics must come from the attempt's weak topics.",
            )
    if not topics:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="This attempt has no weak topics to remediate."
        )

    if request.action == "explain":
        return _remediation_response(attempt, "explain", topics, None)

    model = FlashcardDeck if request.action == "deck" else Quiz
    existing = db.scalars(
        select(model).where(
            model.user_id == user.id,
            model.source_attempt_id == attempt.id,
            model.source_action == request.action,
        )
    ).all()
    match = next(
        (item for item in existing if sorted(item.source_topics or []) == topics),
        None,
    )
    if match is not None:
        return _remediation_response(attempt, request.action, topics, match.id)

    weak_questions = _weak_questions(db, attempt.id, topics)
    if request.action == "deck":
        resource = FlashcardDeck(
            user_id=user.id,
            course_id=source_quiz.course_id,
            material_id=source_quiz.material_id,
            title=f"Review: {', '.join(topics)}",
            source_attempt_id=attempt.id,
            source_action="deck",
            source_topics=topics,
        )
        db.add(resource)
        db.flush()
        for question in weak_questions:
            answer = question.explanation or ", ".join(
                str(value) for value in (question.correct_answers or [])
            )
            db.add(
                Flashcard(
                    deck_id=resource.id,
                    front=question.prompt,
                    back=answer or "Review the source material.",
                    topic=question.topic,
                    difficulty=question.difficulty,
                    source_refs=question.source_refs or [],
                )
            )
    else:
        resource = Quiz(
            user_id=user.id,
            course_id=source_quiz.course_id,
            professor_agent_id=source_quiz.professor_agent_id,
            material_id=source_quiz.material_id,
            title=f"Retry: {', '.join(topics)}",
            config={
                **(source_quiz.config or {}),
                "count": len(weak_questions),
                "topic_focus": topics,
            },
            status="ready",
            source_attempt_id=attempt.id,
            source_action="retry",
            source_topics=topics,
        )
        db.add(resource)
        db.flush()
        for question in weak_questions:
            db.add(
                Question(
                    quiz_id=resource.id,
                    type=question.type,
                    prompt=question.prompt,
                    options=question.options,
                    correct_answers=question.correct_answers,
                    explanation=question.explanation,
                    topic=question.topic,
                    difficulty=question.difficulty,
                    source_refs=question.source_refs,
                    rubric=question.rubric,
                )
            )
    link_remediation_plan_items(
        db, user.id, source_quiz.course_id, topics, resource.id, request.action
    )
    db.commit()
    return _remediation_response(attempt, request.action, topics, resource.id)


@router.get("/{quiz_id}", response_model=QuizResponse)
def get_quiz(
    quiz_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizResponse:
    return _quiz_response(_owned_quiz(db, user.id, quiz_id))


@router.patch("/{quiz_id}", response_model=QuizResponse)
def update_quiz(
    quiz_id: uuid.UUID,
    request: QuizUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizResponse:
    quiz = _owned_quiz(db, user.id, quiz_id)
    if request.title is not None:
        quiz.title = request.title
    if "professor_agent_id" in request.model_fields_set:
        if request.professor_agent_id is not None:
            _owned_agent(db, user.id, request.professor_agent_id)
        quiz.professor_agent_id = request.professor_agent_id
    config = dict(quiz.config or {})
    if "timer_minutes" in request.model_fields_set:
        config["timer_minutes"] = request.timer_minutes
    if request.shuffle_questions is not None:
        config["shuffle_questions"] = request.shuffle_questions
    if request.shuffle_options is not None:
        config["shuffle_options"] = request.shuffle_options
    if request.options_count is not None:
        config["options_count"] = request.options_count
    quiz.config = config
    db.add(quiz)
    db.commit()
    quiz = _owned_quiz(db, user.id, quiz_id)
    return _quiz_response(quiz)


@router.post("/{quiz_id}/regenerate", response_model=QuizResponse)
def regenerate_quiz(
    quiz_id: uuid.UUID,
    request: QuizRegenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizResponse:
    enforce_limit(db, user.id, "chat_prompt")
    quiz = _owned_quiz(db, user.id, quiz_id)
    if quiz.attempts:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Cannot regenerate a quiz that already has attempts. Create a new quiz instead.",
        )
    config = dict(quiz.config or {})
    material_ids = [uuid.UUID(item) for item in config.get("material_ids") or []]
    count = request.count or int(config.get("count") or len(quiz.questions) or 8)
    question_types = request.question_types or config.get("question_types") or ["mcq"]
    difficulty = request.difficulty or config.get("difficulty") or "medium"
    topic_focus = request.topic_focus or config.get("topic_focus")
    options_count = request.options_count or int(config.get("options_count") or 4)

    if "professor_agent_id" in request.model_fields_set:
        if request.professor_agent_id is not None:
            _owned_agent(db, user.id, request.professor_agent_id)
        quiz.professor_agent_id = request.professor_agent_id
    if "timer_minutes" in request.model_fields_set:
        config["timer_minutes"] = request.timer_minutes
    if request.shuffle_questions is not None:
        config["shuffle_questions"] = request.shuffle_questions
    if request.shuffle_options is not None:
        config["shuffle_options"] = request.shuffle_options

    source_thread_id = resolve_quiz_source_thread_id(db, quiz.id, config)
    chunks: list[dict[str, Any]]
    if source_thread_id is not None:
        chunks, topic_focus = build_quiz_regeneration_context(
            db,
            user,
            source_thread_id,
            material_ids,
            quiz.course_id,
            count,
            topic_focus,
        )
    else:
        chunks = _retrieval_chunks(db, user.id, quiz.course_id, material_ids, count)
        if topic_focus:
            chunks = rank_chunks_by_query(chunks, topic_focus)
    if not chunks:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="No source materials found for this quiz. Generate a new quiz from chat with attached files.",
        )

    agent = _owned_agent(db, user.id, quiz.professor_agent_id)
    generated = generate_questions(
        chunks,
        count=count,
        question_types=question_types,
        difficulty=difficulty,
        topic_label=topic_focus or quiz.title,
        agent=_agent_payload_with_insights(db, agent, user.id, material_ids) if agent else None,
        variation_seed=uuid.uuid4().int % (2**31),
        model=request.model,
        options_count=options_count,
    )
    if not generated:
        message, _metadata = generation_failure_payload(default_message="No questions generated.")
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)

    for question in list(quiz.questions):
        db.delete(question)
    db.flush()

    for item in generated:
        db.add(
            Question(
                quiz_id=quiz.id,
                type=item["type"],
                prompt=item["prompt"],
                options=item.get("options"),
                correct_answers=item.get("correct_answers") or [],
                explanation=item.get("explanation"),
                topic=item.get("topic"),
                difficulty=item.get("difficulty"),
                source_refs=item.get("source_refs") or [],
                rubric={"expected_keywords": item.get("correct_answers") or []},
            )
        )

    config["count"] = count
    config["question_types"] = question_types
    config["difficulty"] = difficulty
    config["options_count"] = options_count
    if topic_focus:
        config["topic_focus"] = topic_focus
    if source_thread_id is not None:
        config["thread_id"] = str(source_thread_id)
    quiz.config = config
    quiz.status = "ready"
    record_usage(db, user.id, "chat_prompt")
    db.commit()
    quiz = _owned_quiz(db, user.id, quiz_id)
    return _quiz_response(quiz)


def _retrieval_chunks(
    db: Session,
    user_id: uuid.UUID,
    course_id: uuid.UUID | None,
    material_ids: list[uuid.UUID],
    count: int,
    query: str | None = None,
) -> list[dict[str, Any]]:
    from app.services.materials import materials_service

    # Use topic as query if available for semantic retrieval
    search_query = query or "Quiz generation important facts concepts"
    
    return materials_service.retrieve_blended_chunks(
        db,
        user_id=user_id,
        institution_id=None,
        course_id=course_id,
        material_ids=material_ids,
        count=count,
        query=search_query,
    )


def _owned_agent(
    db: Session, user_id: uuid.UUID, agent_id: uuid.UUID | None
) -> ProfessorAgent | None:
    if agent_id is None:
        return None
    agent = db.scalar(
        select(ProfessorAgent).where(
            ProfessorAgent.id == agent_id, ProfessorAgent.user_id == user_id
        )
    )
    if agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} was not found.")
    return agent


def _owned_quiz(db: Session, user_id: uuid.UUID, quiz_id: uuid.UUID) -> Quiz:
    quiz = db.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id, Quiz.user_id == user_id)
    )
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Quiz {quiz_id} was not found.")
    return quiz


def _owned_attempt(db: Session, user_id: uuid.UUID, attempt_id: uuid.UUID) -> QuizAttempt:
    attempt = db.scalar(
        select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user_id)
    )
    if attempt is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=f"Attempt {attempt_id} was not found."
        )
    return attempt


def _question_for_attempt(db: Session, attempt: QuizAttempt, question_id: uuid.UUID) -> Question:
    question = db.scalar(
        select(Question).where(Question.id == question_id, Question.quiz_id == attempt.quiz_id)
    )
    if question is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=f"Question {question_id} was not found."
        )
    return question


def _normalize_choice_value(options: Any, value: Any) -> str:
    normalized_value = str(value).strip().casefold()
    if not isinstance(options, list):
        return normalized_value

    aliases: dict[str, str] = {}
    normalized_options: list[tuple[str, str]] = []
    for index, option in enumerate(options):
        if not isinstance(option, dict):
            continue
        option_id = str(option.get("id") or chr(ord("a") + index)).strip().casefold()
        option_text = str(option.get("text") or option.get("label") or "").strip().casefold()
        normalized_options.append((option_id, option_text))
        aliases[option_id] = option_id

    for option_id, option_text in normalized_options:
        if option_text:
            aliases.setdefault(option_text, option_id)

    for index, (option_id, _option_text) in enumerate(normalized_options):
        letter = chr(ord("a") + index)
        aliases.setdefault(letter, option_id)
        aliases.setdefault(str(index), option_id)
        aliases.setdefault(str(index + 1), option_id)
        aliases.setdefault(f"option {letter}", option_id)

    return aliases.get(normalized_value, normalized_value)


def _matching_option_lookup(options: Any) -> dict[str, str]:
    if not isinstance(options, dict):
        return {}

    lookup: dict[str, str] = {}
    for side in ("left", "right"):
        items = options.get(side)
        if not isinstance(items, list):
            continue
        for index, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            option_id = str(item.get("id") or f"{side[0]}{index}").strip().casefold()
            option_text = str(item.get("text") or item.get("label") or "").strip().casefold()
            lookup[option_id] = option_id
            if option_text:
                lookup.setdefault(option_text, option_id)
            lookup.setdefault(str(index), option_id)
            lookup.setdefault(str(index + 1), option_id)
    return lookup


def _normalize_matching_value(options: Any, value: Any) -> str:
    normalized_value = str(value).strip().casefold()
    return _matching_option_lookup(options).get(normalized_value, normalized_value)


def _score_answer(
    question: Question, answer: Any, *, allow_llm: bool = True
) -> tuple[float, bool | None, str]:
    if question.type == "true_false":
        selected = answer if isinstance(answer, list) else [answer] if answer else []
        normalized = sorted(
            str(normalize_true_false_answer(question.options, item)).lower() for item in selected
        )
        expected = sorted(
            str(normalize_true_false_answer(question.options, item)).lower()
            for item in (question.correct_answers or [])
        )
        is_correct = expected == normalized
        return (
            (1.0 if is_correct else 0.0),
            is_correct,
            ("Correct." if is_correct else "Review the explanation and source material."),
        )

    if question.type in {"mcq", "multi_select"}:
        selected = answer if isinstance(answer, list) else [answer] if answer else []
        normalized = sorted(_normalize_choice_value(question.options, item) for item in selected)
        expected_answers = resolve_stored_correct_answers(
            question.type,
            question.options,
            question.correct_answers,
            question.explanation,
        )
        expected = sorted(
            _normalize_choice_value(question.options, item)
            for item in expected_answers
        )
        is_correct = expected == normalized
        return (
            (1.0 if is_correct else 0.0),
            is_correct,
            ("Correct." if is_correct else "Review the explanation and source material."),
        )
    if question.type == "matching":
        expected_pairs = {
            (
                _normalize_matching_value(question.options, pair.get("left", "")),
                _normalize_matching_value(question.options, pair.get("right", "")),
            )
            for pair in (question.correct_answers or [])
            if isinstance(pair, dict)
        }
        submitted_pairs = {
            (
                _normalize_matching_value(question.options, pair.get("left", "")),
                _normalize_matching_value(question.options, pair.get("right", "")),
            )
            for pair in (answer if isinstance(answer, list) else [])
            if isinstance(pair, dict)
        }
        if not expected_pairs:
            return 0.0, False, "No matching rubric was available."
        correct_count = len(expected_pairs & submitted_pairs)
        fraction = correct_count / len(expected_pairs)
        is_correct = fraction == 1.0
        return (
            fraction,
            is_correct,
            (
                "All pairs matched correctly."
                if is_correct
                else f"Matched {correct_count}/{len(expected_pairs)} pairs correctly."
            ),
        )
    expected = [
        str(item).lower()
        for item in resolve_stored_correct_answers(
            question.type,
            question.options,
            question.correct_answers,
            question.explanation,
        )
    ]
    text = answer if isinstance(answer, str) else ""
    if not allow_llm:
        fraction, feedback = _score_subjective_answer_heuristic(text, expected)
    else:
        fraction, feedback = score_subjective_answer(text, expected, question.prompt)
    return fraction, None, feedback


def _quiz_list_item_response(quiz: Quiz, question_count: int) -> QuizListItemResponse:
    return QuizListItemResponse(
        id=quiz.id,
        course_id=quiz.course_id,
        professor_agent_id=quiz.professor_agent_id,
        title=quiz.title,
        config=quiz.config,
        status=quiz.status,
        question_count=question_count,
        source_attempt_id=quiz.source_attempt_id,
        source_action=quiz.source_action,
        source_topics=quiz.source_topics or [],
        created_at=quiz.created_at,
        updated_at=quiz.updated_at,
    )


def _quiz_response(quiz: Quiz) -> QuizResponse:
    return QuizResponse(
        id=quiz.id,
        course_id=quiz.course_id,
        professor_agent_id=quiz.professor_agent_id,
        title=quiz.title,
        config=quiz.config,
        status=quiz.status,
        source_attempt_id=quiz.source_attempt_id,
        source_action=quiz.source_action,
        source_topics=quiz.source_topics or [],
        questions=[_question_play_response(question) for question in quiz.questions],
        created_at=quiz.created_at,
        updated_at=quiz.updated_at,
    )


def _question_play_response(question: Question) -> QuestionPlayResponse:
    return QuestionPlayResponse(
        id=question.id,
        type=question.type,
        prompt=question.prompt,
        options=sanitize_question_options(question.type, question.options),
        topic=question.topic,
        difficulty=question.difficulty,
    )


def _question_response(question: Question) -> QuestionResponse:
    correct_answers = question.correct_answers
    if question.type in {"mcq", "multi_select", "short_answer", "theory"}:
        resolved = resolve_stored_correct_answers(
            question.type,
            question.options,
            question.correct_answers,
            question.explanation,
        )
        if resolved:
            correct_answers = resolved
    return QuestionResponse(
        id=question.id,
        type=question.type,
        prompt=question.prompt,
        options=sanitize_question_options(question.type, question.options),
        correct_answers=correct_answers,
        explanation=question.explanation,
        topic=question.topic,
        difficulty=question.difficulty,
        source_refs=question.source_refs,
        rubric=question.rubric,
    )


def _parse_timer_minutes(raw: object) -> int | None:
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int) and raw > 0:
        return raw
    if isinstance(raw, float) and raw > 0:
        return int(raw)
    if isinstance(raw, str):
        try:
            parsed = float(raw.strip())
        except ValueError:
            return None
        if parsed > 0:
            return int(parsed)
    return None


def _quiz_timer_seconds(quiz: Quiz) -> int | None:
    timer_minutes = _parse_timer_minutes((quiz.config or {}).get("timer_minutes"))
    if timer_minutes is None:
        return None
    return timer_minutes * 60


def _aware_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def _initial_timing_metadata(quiz: Quiz) -> dict[str, Any] | None:
    timer_seconds = _quiz_timer_seconds(quiz)
    if timer_seconds is None:
        return None
    started_at = datetime.now(UTC)
    return {
        "timer_seconds": timer_seconds,
        "deadline_at": (started_at + timedelta(seconds=timer_seconds)).isoformat(),
    }


def _attempt_deadline(attempt: QuizAttempt, quiz: Quiz) -> datetime | None:
    timer_seconds = _quiz_timer_seconds(quiz)
    if timer_seconds is None:
        return None

    metadata = dict(attempt.timing_metadata or {})
    deadline_raw = metadata.get("deadline_at")
    if isinstance(deadline_raw, str) and deadline_raw.strip():
        return _aware_datetime(datetime.fromisoformat(deadline_raw.replace("Z", "+00:00")))

    started_at = _aware_datetime(attempt.started_at)
    return started_at + timedelta(seconds=timer_seconds)


def _attempt_timer_state(attempt: QuizAttempt, quiz: Quiz) -> dict[str, Any]:
    timer_seconds = _quiz_timer_seconds(quiz)
    if timer_seconds is None:
        return {
            "timer_seconds": None,
            "seconds_remaining": None,
            "timer_expired": False,
            "deadline_at": None,
        }

    deadline = _attempt_deadline(attempt, quiz)
    if deadline is None:
        return {
            "timer_seconds": timer_seconds,
            "seconds_remaining": timer_seconds,
            "timer_expired": False,
            "deadline_at": None,
        }

    remaining = max(0, int((deadline - datetime.now(UTC)).total_seconds()))
    return {
        "timer_seconds": timer_seconds,
        "seconds_remaining": remaining,
        "timer_expired": remaining <= 0,
        "deadline_at": deadline,
    }


def _latest_in_progress_attempt(
    db: Session, user_id: uuid.UUID, quiz_id: uuid.UUID
) -> QuizAttempt | None:
    return db.scalar(
        select(QuizAttempt)
        .where(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.user_id == user_id,
            QuizAttempt.status == "in_progress",
        )
        .order_by(QuizAttempt.started_at.desc())
    )


def _submit_attempt_record(
    db: Session, attempt: QuizAttempt, *, allow_llm: bool = True
) -> QuizReviewResponse:
    questions = db.scalars(select(Question).where(Question.quiz_id == attempt.quiz_id)).all()
    answers_by_question = {
        answer.question_id: answer
        for answer in db.scalars(
            select(QuizAnswer).where(QuizAnswer.attempt_id == attempt.id)
        ).all()
    }
    total = Decimal("0")
    max_score = Decimal(str(len(questions)))
    for question in questions:
        answer = answers_by_question.get(question.id)
        if answer is None:
            answer = QuizAnswer(attempt_id=attempt.id, question_id=question.id, answer=None)
        score, is_correct, feedback = _score_answer(
            question,
            answer.answer,
            allow_llm=allow_llm,
        )
        answer.score = Decimal(str(score))
        answer.is_correct = is_correct
        answer.feedback = feedback
        total += answer.score
        db.add(answer)

    attempt.status = "submitted"
    attempt.submitted_at = datetime.now(UTC)
    attempt.score = total
    attempt.max_score = max_score
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return _review_response(db, attempt)


def _auto_submit_if_expired(db: Session, attempt: QuizAttempt, quiz: Quiz) -> QuizAttempt:
    if attempt.status != "in_progress":
        return attempt
    if _attempt_timer_state(attempt, quiz)["timer_expired"]:
        metadata = dict(attempt.timing_metadata or {})
        metadata["auto_submitted"] = True
        attempt.timing_metadata = metadata
        db.add(attempt)
        db.flush()
        _submit_attempt_record(db, attempt, allow_llm=False)
        db.refresh(attempt)
    return attempt


def _score_subjective_answer_heuristic(
    answer_text: str, expected_keywords: list[str]
) -> tuple[float, str]:
    if not answer_text.strip():
        return 0.0, "No answer provided."
    if not expected_keywords:
        return 0.5, "Answer recorded."
    answer_lower = answer_text.lower()
    hits = [kw for kw in expected_keywords if kw.lower() in answer_lower]
    fraction = len(hits) / len(expected_keywords)
    feedback = f"Covered {len(hits)}/{len(expected_keywords)} expected points."
    return fraction, feedback


def _recent_auto_submitted_attempt(
    db: Session,
    user_id: uuid.UUID,
    quiz_id: uuid.UUID,
    *,
    within_minutes: int = 30,
) -> QuizAttempt | None:
    attempt = db.scalar(
        select(QuizAttempt)
        .where(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.user_id == user_id,
            QuizAttempt.status == "submitted",
        )
        .order_by(QuizAttempt.submitted_at.desc())
    )
    if attempt is None or attempt.submitted_at is None:
        return None
    metadata = attempt.timing_metadata or {}
    if not metadata.get("auto_submitted"):
        return None
    submitted_at = _aware_datetime(attempt.submitted_at)
    if datetime.now(UTC) - submitted_at > timedelta(minutes=within_minutes):
        return None
    return attempt


def _attempt_response(attempt: QuizAttempt, quiz: Quiz | None = None) -> QuizAttemptResponse:
    timer_state = (
        _attempt_timer_state(attempt, quiz)
        if quiz is not None
        else {
            "timer_seconds": None,
            "seconds_remaining": None,
            "timer_expired": False,
            "deadline_at": None,
        }
    )
    return QuizAttemptResponse(
        id=attempt.id,
        quiz_id=attempt.quiz_id,
        status=attempt.status,
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        score=attempt.score,
        max_score=attempt.max_score,
        timer_seconds=timer_state["timer_seconds"],
        seconds_remaining=timer_state["seconds_remaining"],
        timer_expired=timer_state["timer_expired"],
        deadline_at=timer_state["deadline_at"],
    )


def _answer_response(answer: QuizAnswer) -> QuizAnswerResponse:
    return QuizAnswerResponse(
        id=answer.id,
        attempt_id=answer.attempt_id,
        question_id=answer.question_id,
        answer=answer.answer,
        is_correct=answer.is_correct,
        score=answer.score,
        feedback=answer.feedback,
        flagged=bool(answer.flagged),
    )


def _answer_progress_response(answer: QuizAnswer) -> QuizAnswerProgressResponse:
    return QuizAnswerProgressResponse(
        id=answer.id,
        attempt_id=answer.attempt_id,
        question_id=answer.question_id,
        answer=answer.answer,
        flagged=bool(answer.flagged),
    )


def _review_response(db: Session, attempt: QuizAttempt) -> QuizReviewResponse:
    questions = db.scalars(
        select(Question).where(Question.quiz_id == attempt.quiz_id).order_by(Question.id)
    ).all()
    answers = db.scalars(select(QuizAnswer).where(QuizAnswer.attempt_id == attempt.id)).all()
    weak_topics = db.scalars(
        select(Question.topic)
        .join(QuizAnswer, QuizAnswer.question_id == Question.id)
        .where(QuizAnswer.attempt_id == attempt.id, func.coalesce(QuizAnswer.score, 0) < 1)
        .distinct()
    ).all()
    return QuizReviewResponse(
        attempt=_attempt_response(attempt),
        answers=[_answer_response(answer) for answer in answers],
        questions=[_question_response(question) for question in questions],
        weak_topics=[topic for topic in weak_topics if topic],
        incorrect_question_ids=[
            answer.question_id
            for answer in answers
            if answer.score is None or float(answer.score) < 1
        ],
    )


def _weak_topics(db: Session, attempt_id: uuid.UUID) -> list[str]:
    topics = db.scalars(
        select(Question.topic)
        .join(QuizAnswer, QuizAnswer.question_id == Question.id)
        .where(
            QuizAnswer.attempt_id == attempt_id,
            func.coalesce(QuizAnswer.score, 0) < 1,
            Question.topic.is_not(None),
        )
        .distinct()
        .order_by(Question.topic.asc())
    ).all()
    return [topic for topic in topics if topic]


def _weak_questions(db: Session, attempt_id: uuid.UUID, topics: list[str]) -> list[Question]:
    return list(
        db.scalars(
            select(Question)
            .join(QuizAnswer, QuizAnswer.question_id == Question.id)
            .where(
                QuizAnswer.attempt_id == attempt_id,
                func.coalesce(QuizAnswer.score, 0) < 1,
                Question.topic.in_(topics),
            )
            .order_by(Question.id)
        ).all()
    )


def _remediation_response(
    attempt: QuizAttempt,
    action: str,
    topics: list[str],
    resource_id: uuid.UUID | None,
) -> RemediationResponse:
    if action == "deck":
        url = f"/flashcard-decks/{resource_id}"
    elif action == "retry":
        url = f"/quizzes/{resource_id}"
    else:
        query = urlencode(
            {
                "context_type": "quiz_remediation",
                "attempt_id": str(attempt.id),
                "topics": ",".join(topics),
            }
        )
        url = f"/chat?{query}"
    return RemediationResponse(
        attempt_id=attempt.id,
        action=action,
        topics=topics,
        status="ready",
        resource_id=resource_id,
        url=url,
        context={
            "type": "quiz_remediation",
            "attempt_id": str(attempt.id),
            "quiz_id": str(attempt.quiz_id),
            "topics": topics,
        },
    )


def _agent_payload(agent: ProfessorAgent) -> dict[str, Any]:
    return {
        "name": agent.name,
        "difficulty": agent.difficulty,
        "marking_strictness": agent.marking_strictness,
        "question_style": agent.question_style,
        "favorite_topics": agent.favorite_topics,
        "common_traps": agent.common_traps,
        "feedback_tone": agent.feedback_tone,
        "rubric_preferences": agent.rubric_preferences,
    }


def _agent_payload_with_insights(
    db: Session,
    agent: ProfessorAgent,
    user_id: uuid.UUID,
    material_ids: list[uuid.UUID],
) -> dict[str, Any]:
    payload = _agent_payload(agent)
    try:
        from app.services.material_insights import insight_prompt_context

        insights = insight_prompt_context(db, user_id, material_ids)
    except Exception:
        insights = []
    if insights:
        payload["material_insights"] = insights
    return payload
