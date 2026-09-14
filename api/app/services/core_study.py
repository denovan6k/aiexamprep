from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import (
    Course,
    Flashcard,
    FlashcardDeck,
    FlashcardReview,
    Material,
    MaterialChunk,
    Question,
    Quiz,
    QuizAttempt,
    StudyPlanItem,
    StudyProfile,
)
from app.schemas.core_study import (
    CourseSummaryResponse,
    CourseWorkspaceResponse,
    FeedResourceItemResponse,
    FeedResourceMeta,
    OnboardingChecklist,
    OnboardingCourseCreate,
    OnboardingResponse,
    StudyFeedResponse,
    StudyPlanItemCreate,
    StudyPlanItemResponse,
    StudyProfilePatch,
    StudyProfileResponse,
    TodayStudyPlanResponse,
    WorkspaceResource,
)
from app.schemas.integration import TopicScoreResponse
from app.services.progress import average_quiz_score, flashcard_due_count, topic_scores


def get_or_create_profile(db: Session, user_id: uuid.UUID) -> StudyProfile:
    profile = db.get(StudyProfile, user_id)
    if profile is None:
        profile = StudyProfile(user_id=user_id, daily_minutes=30)
        db.add(profile)
        db.flush()
    return profile


def onboarding_response(db: Session, user_id: uuid.UUID) -> OnboardingResponse:
    profile = db.get(StudyProfile, user_id)
    course_count = _count(db, Course, Course.user_id == user_id)
    material_count = _count(db, Material, Material.user_id == user_id)
    quiz_count = _count(db, Quiz, Quiz.user_id == user_id)
    attempt_count = _count(
        db,
        QuizAttempt,
        QuizAttempt.user_id == user_id,
        QuizAttempt.status == "submitted",
    )
    profile_done = bool(profile and profile.study_goal and profile.study_goal.strip())
    steps = {
        "profile": profile_done,
        "course": bool(course_count),
        "material": bool(material_count),
        "quiz": bool(quiz_count),
        "attempt": bool(attempt_count),
    }
    complete = bool(profile and profile.onboarding_completed_at)
    return OnboardingResponse(
        profile=StudyProfileResponse(
            daily_minutes=profile.daily_minutes if profile else 30,
            study_goal=profile.study_goal if profile else None,
            onboarding_completed_at=profile.onboarding_completed_at if profile else None,
        ),
        checklist=OnboardingChecklist(**steps, complete=complete),
    )


def patch_onboarding(
    db: Session, user_id: uuid.UUID, request: StudyProfilePatch
) -> OnboardingResponse:
    profile = get_or_create_profile(db, user_id)
    if request.daily_minutes is not None:
        profile.daily_minutes = request.daily_minutes
    if "study_goal" in request.model_fields_set:
        profile.study_goal = request.study_goal
    if request.onboarding_completed is True and profile.onboarding_completed_at is None:
        checklist = onboarding_response(db, user_id).checklist
        if not (checklist.profile and checklist.course and checklist.material):
            raise OnboardingStepError(
                "Complete your study target, course, and material upload before finishing setup."
            )
        profile.onboarding_completed_at = datetime.now(UTC)
    elif request.onboarding_completed is False:
        profile.onboarding_completed_at = None
    db.add(profile)
    db.commit()
    return onboarding_response(db, user_id)


class OnboardingStepError(ValueError):
    pass


def create_onboarding_course(
    db: Session, user_id: uuid.UUID, request: OnboardingCourseCreate
) -> Course:
    profile = get_or_create_profile(db, user_id)
    if not profile.study_goal or not profile.study_goal.strip():
        raise OnboardingStepError("Save your study target before creating a course.")
    if db.scalar(select(func.count()).select_from(Course).where(Course.user_id == user_id)):
        raise OnboardingStepError("Your first onboarding course is already created.")
    course = Course(
        user_id=user_id,
        title=request.title,
        description=request.description,
        exam_date=request.exam_date,
        confidence_level=request.confidence_level,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def course_workspace(
    db: Session, user_id: uuid.UUID, course_id: uuid.UUID
) -> CourseWorkspaceResponse | None:
    course = db.scalar(select(Course).where(Course.id == course_id, Course.user_id == user_id))
    if course is None:
        return None
    materials = db.scalars(
        select(Material)
        .where(Material.user_id == user_id, Material.course_id == course_id)
        .order_by(Material.updated_at.desc())
    ).all()
    quizzes = db.scalars(
        select(Quiz)
        .where(Quiz.user_id == user_id, Quiz.course_id == course_id)
        .order_by(Quiz.updated_at.desc())
    ).all()
    decks = db.scalars(
        select(FlashcardDeck)
        .where(FlashcardDeck.user_id == user_id, FlashcardDeck.course_id == course_id)
        .order_by(FlashcardDeck.updated_at.desc())
    ).all()
    attempt_count = int(
        db.scalar(
            select(func.count())
            .select_from(QuizAttempt)
            .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
            .where(
                QuizAttempt.user_id == user_id,
                QuizAttempt.status == "submitted",
                Quiz.course_id == course_id,
            )
        )
        or 0
    )
    return CourseWorkspaceResponse(
        course_id=course.id,
        title=course.title,
        confidence_level=course.confidence_level,
        exam_date=course.exam_date,
        materials=[
            WorkspaceResource(
                id=item.id,
                title=item.title,
                status=item.status,
                updated_at=item.updated_at,
            )
            for item in materials
        ],
        quizzes=[
            WorkspaceResource(
                id=item.id,
                title=item.title,
                status=item.status,
                count=len(item.questions),
                updated_at=item.updated_at,
            )
            for item in quizzes
        ],
        flashcard_decks=[
            WorkspaceResource(
                id=item.id,
                title=item.title,
                count=int(
                    db.scalar(
                        select(func.count())
                        .select_from(Flashcard)
                        .where(Flashcard.deck_id == item.id)
                    )
                    or 0
                ),
                updated_at=item.updated_at,
            )
            for item in decks
        ],
        progress={
            "submitted_attempts": attempt_count,
            "average_score": average_quiz_score(db, user_id, course_id=course_id),
            "cards_due": flashcard_due_count(db, user_id, course_id=course_id),
            "weak_topics": [
                item.topic for item in topic_scores(db, user_id, limit=5, course_id=course_id)
            ],
        },
    )


def today_plan(db: Session, user_id: uuid.UUID, *, refresh: bool = False) -> TodayStudyPlanResponse:
    today = datetime.now(UTC).date()
    if refresh:
        db.execute(
            delete(StudyPlanItem).where(
                StudyPlanItem.user_id == user_id,
                StudyPlanItem.plan_date == today,
                StudyPlanItem.status == "pending",
            )
        )
        db.flush()
    existing = db.scalars(
        select(StudyPlanItem)
        .where(StudyPlanItem.user_id == user_id, StudyPlanItem.plan_date == today)
        .order_by(StudyPlanItem.priority.desc(), StudyPlanItem.created_at.asc())
    ).all()
    generated = False
    if not existing or refresh:
        generated = _generate_today_items(db, user_id, today)
        db.commit()
        existing = db.scalars(
            select(StudyPlanItem)
            .where(StudyPlanItem.user_id == user_id, StudyPlanItem.plan_date == today)
            .order_by(StudyPlanItem.priority.desc(), StudyPlanItem.created_at.asc())
        ).all()
    profile = db.get(StudyProfile, user_id)
    return TodayStudyPlanResponse(
        date=today.isoformat(),
        daily_minutes=profile.daily_minutes if profile else 30,
        generated=generated,
        items=[_plan_item_response(item) for item in existing],
    )


def create_plan_item(
    db: Session, user_id: uuid.UUID, request: StudyPlanItemCreate
) -> StudyPlanItem:
    today = datetime.now(UTC).date()
    course_id = request.course_id
    if course_id is not None:
        course = db.scalar(
            select(Course).where(Course.id == course_id, Course.user_id == user_id)
        )
        if course is None:
            raise OnboardingStepError(f"Course {course_id} was not found.")
    else:
        course = db.scalar(
            select(Course).where(Course.user_id == user_id).order_by(Course.created_at.desc())
        )
        course_id = course.id if course else None

    target_id = request.target_id
    title = request.title.strip()
    item_type = request.item_type

    if item_type == "flashcards" and target_id is None and course_id is not None:
        target_id = db.scalar(
            select(FlashcardDeck.id)
            .where(FlashcardDeck.user_id == user_id, FlashcardDeck.course_id == course_id)
            .order_by(FlashcardDeck.updated_at.desc())
        )
    elif item_type == "weak_topic" and target_id is None and request.topic and course_id is not None:
        target_id = db.scalar(
            select(Quiz.id)
            .join(Question, Question.quiz_id == Quiz.id)
            .where(
                Quiz.user_id == user_id,
                Quiz.course_id == course_id,
                Question.topic == request.topic,
            )
            .order_by(Quiz.updated_at.desc())
        )
    elif item_type == "course_review" and course_id is not None:
        target_id = course_id

    item = StudyPlanItem(
        user_id=user_id,
        course_id=course_id,
        plan_date=today,
        item_type=item_type,
        title=title,
        topic=request.topic,
        target_id=target_id,
        estimated_minutes=request.estimated_minutes,
        priority=40,
        status="pending",
        dedupe_key=f"custom:{uuid.uuid4()}",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_plan_item(
    db: Session, user_id: uuid.UUID, item_id: uuid.UUID, action: str
) -> StudyPlanItem | None:
    item = db.scalar(
        select(StudyPlanItem).where(StudyPlanItem.id == item_id, StudyPlanItem.user_id == user_id)
    )
    if item is None:
        return None
    now = datetime.now(UTC)
    if action == "start":
        item.status = "in_progress"
        item.started_at = item.started_at or now
    elif action == "complete":
        item.status = "completed"
        item.started_at = item.started_at or now
        item.completed_at = now
    else:
        item.status = "dismissed"
        item.dismissed_at = now
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def plan_item_response(item: StudyPlanItem) -> StudyPlanItemResponse:
    return _plan_item_response(item)


def link_remediation_plan_items(
    db: Session,
    user_id: uuid.UUID,
    course_id: uuid.UUID | None,
    topics: list[str],
    target_id: uuid.UUID,
    action: str,
) -> None:
    if not topics:
        return
    items = db.scalars(
        select(StudyPlanItem).where(
            StudyPlanItem.user_id == user_id,
            StudyPlanItem.plan_date >= datetime.now(UTC).date(),
            StudyPlanItem.status.in_(["pending", "in_progress"]),
        )
    ).all()
    normalized = {topic.casefold() for topic in topics}
    for item in items:
        if course_id and item.course_id != course_id:
            continue
        if item.topic and item.topic.casefold() in normalized:
            item.target_id = target_id
            item.item_type = f"remediation_{action}"
            db.add(item)


def _generate_today_items(db: Session, user_id: uuid.UUID, today: date) -> bool:
    profile = db.get(StudyProfile, user_id)
    budget = profile.daily_minutes if profile else 30
    course = db.scalar(
        select(Course)
        .where(
            Course.user_id == user_id,
            Course.exam_date.is_not(None),
            Course.exam_date >= datetime.now(UTC),
        )
        .order_by(Course.exam_date.asc())
    )
    if course is None:
        course = db.scalar(
            select(Course).where(Course.user_id == user_id).order_by(Course.created_at.desc())
        )
    if course is None:
        return False
    candidates: list[dict] = []
    weak = topic_scores(db, user_id, limit=2, course_id=course.id)
    due = flashcard_due_count(db, user_id, course_id=course.id)
    if due:
        deck_id = db.scalar(
            select(FlashcardDeck.id)
            .where(FlashcardDeck.user_id == user_id, FlashcardDeck.course_id == course.id)
            .order_by(FlashcardDeck.updated_at.desc())
        )
        candidates.append(
            {
                "item_type": "flashcards",
                "title": f"Review {min(due, 20)} due cards",
                "topic": weak[0].topic if weak else None,
                "target_id": deck_id,
                "estimated_minutes": min(15, max(5, due)),
                "priority": 100,
                "dedupe_key": f"due:{course.id}",
            }
        )
    for index, score in enumerate(weak):
        quiz_id = db.scalar(
            select(Quiz.id)
            .join(Question, Question.quiz_id == Quiz.id)
            .where(
                Quiz.user_id == user_id,
                Quiz.course_id == course.id,
                Question.topic == score.topic,
            )
            .order_by(Quiz.updated_at.desc())
        )
        candidates.append(
            {
                "item_type": "weak_topic",
                "title": f"Strengthen {score.topic}",
                "topic": score.topic,
                "target_id": quiz_id,
                "estimated_minutes": 15,
                "priority": 90 - index,
                "dedupe_key": f"weak:{course.id}:{score.topic.casefold()}",
            }
        )
    if not candidates:
        candidates.append(
            {
                "item_type": "course_review",
                "title": f"Continue {course.title}",
                "topic": None,
                "target_id": course.id,
                "estimated_minutes": min(20, budget),
                "priority": 50,
                "dedupe_key": f"course:{course.id}",
            }
        )
    existing_keys = set(
        db.scalars(
            select(StudyPlanItem.dedupe_key).where(
                StudyPlanItem.user_id == user_id, StudyPlanItem.plan_date == today
            )
        ).all()
    )
    used = 0
    created = False
    for candidate in candidates:
        if candidate["dedupe_key"] in existing_keys:
            continue
        minutes = min(candidate["estimated_minutes"], max(budget - used, 0))
        if minutes < 5:
            break
        db.add(
            StudyPlanItem(
                user_id=user_id,
                course_id=course.id,
                plan_date=today,
                estimated_minutes=minutes,
                status="pending",
                **{key: value for key, value in candidate.items() if key != "estimated_minutes"},
            )
        )
        used += minutes
        created = True
    return created


def _plan_item_response(item: StudyPlanItem) -> StudyPlanItemResponse:
    return StudyPlanItemResponse(
        id=item.id,
        course_id=item.course_id,
        plan_date=item.plan_date.isoformat(),
        item_type=item.item_type,
        title=item.title,
        topic=item.topic,
        target_id=item.target_id,
        estimated_minutes=item.estimated_minutes,
        priority=item.priority,
        status=item.status,
        started_at=item.started_at,
        completed_at=item.completed_at,
        dismissed_at=item.dismissed_at,
    )


def _count(db: Session, model: type, *conditions: object) -> int:
    return int(db.scalar(select(func.count()).select_from(model).where(*conditions)) or 0)


def build_study_feed(db: Session, user_id: uuid.UUID) -> StudyFeedResponse:
    courses = db.scalars(select(Course).where(Course.user_id == user_id)).all()
    course_titles = {course.id: course.title for course in courses}
    next_exam = db.scalar(
        select(Course)
        .where(
            Course.user_id == user_id,
            Course.exam_date.is_not(None),
            Course.exam_date >= datetime.now(UTC),
        )
        .order_by(Course.exam_date.asc())
    )
    next_exam_summary = (
        CourseSummaryResponse(
            id=next_exam.id,
            title=next_exam.title,
            exam_date=next_exam.exam_date,
        )
        if next_exam
        else None
    )

    quiz_activity = {
        quiz_id: _ensure_utc(last_at)
        for quiz_id, last_at in db.execute(
            select(
                QuizAttempt.quiz_id,
                func.max(func.coalesce(QuizAttempt.submitted_at, QuizAttempt.started_at)),
            )
            .where(QuizAttempt.user_id == user_id)
            .group_by(QuizAttempt.quiz_id)
        ).all()
        if last_at is not None
    }
    deck_activity = {
        deck_id: _ensure_utc(last_at)
        for deck_id, last_at in db.execute(
            select(Flashcard.deck_id, func.max(FlashcardReview.reviewed_at))
            .join(FlashcardReview, FlashcardReview.flashcard_id == Flashcard.id)
            .where(FlashcardReview.user_id == user_id)
            .group_by(Flashcard.deck_id)
        ).all()
        if last_at is not None
    }
    plan_activity: dict[uuid.UUID, datetime] = {}
    for item in db.scalars(
        select(StudyPlanItem).where(
            StudyPlanItem.user_id == user_id, StudyPlanItem.target_id.is_not(None)
        )
    ).all():
        if item.target_id is None:
            continue
        ts = item.completed_at or item.started_at
        if ts is None:
            continue
        ts = _ensure_utc(ts)
        existing = plan_activity.get(item.target_id)
        if existing is None or ts > existing:
            plan_activity[item.target_id] = ts

    feed_items: list[FeedResourceItemResponse] = []

    quizzes = db.scalars(
        select(Quiz).where(Quiz.user_id == user_id).order_by(Quiz.updated_at.desc()).limit(40)
    ).all()
    for quiz in quizzes:
        activity = _ensure_utc(
            quiz_activity.get(quiz.id)
            or plan_activity.get(quiz.id)
            or quiz.updated_at
            or quiz.created_at
        )
        preview = [_truncate_preview(question.prompt) for question in quiz.questions[:4]]
        feed_items.append(
            FeedResourceItemResponse(
                kind="quiz",
                id=quiz.id,
                title=quiz.title,
                course_id=quiz.course_id,
                course_title=course_titles.get(quiz.course_id) if quiz.course_id else None,
                last_activity_at=activity,
                activity_label=_activity_label(activity, "quiz"),
                meta=FeedResourceMeta(
                    question_count=len(quiz.questions),
                    status=quiz.status,
                ),
                preview=[item for item in preview if item],
                href=f"/quizzes/{quiz.id}/play" if quiz.status == "ready" else f"/quizzes/{quiz.id}",
            )
        )

    decks = db.scalars(
        select(FlashcardDeck)
        .where(FlashcardDeck.user_id == user_id)
        .order_by(FlashcardDeck.updated_at.desc())
        .limit(40)
    ).all()
    for deck in decks:
        cards = db.scalars(
            select(Flashcard).where(Flashcard.deck_id == deck.id).order_by(Flashcard.id.asc()).limit(4)
        ).all()
        card_count = int(
            db.scalar(
                select(func.count()).select_from(Flashcard).where(Flashcard.deck_id == deck.id)
            )
            or 0
        )
        activity = _ensure_utc(
            deck_activity.get(deck.id)
            or plan_activity.get(deck.id)
            or deck.updated_at
            or deck.created_at
        )
        due_label = _deck_due_label(db, user_id, deck.id)
        feed_items.append(
            FeedResourceItemResponse(
                kind="deck",
                id=deck.id,
                title=deck.title,
                course_id=deck.course_id,
                course_title=course_titles.get(deck.course_id) if deck.course_id else None,
                last_activity_at=activity,
                activity_label=due_label or _activity_label(activity, "deck"),
                meta=FeedResourceMeta(card_count=card_count),
                preview=[_truncate_preview(card.front) for card in cards if card.front.strip()],
                href=f"/flashcards/{deck.id}/study",
            )
        )

    materials = db.scalars(
        select(Material).where(Material.user_id == user_id).order_by(Material.updated_at.desc()).limit(40)
    ).all()
    for material in materials:
        chunk_count = int(
            db.scalar(
                select(func.count())
                .select_from(MaterialChunk)
                .where(MaterialChunk.material_id == material.id)
            )
            or 0
        )
        activity = _ensure_utc(
            plan_activity.get(material.id) or material.updated_at or material.created_at
        )
        preview_source = material.extracted_text_preview
        if not preview_source:
            first_chunk = db.scalar(
                select(MaterialChunk.text)
                .where(MaterialChunk.material_id == material.id)
                .order_by(MaterialChunk.chunk_index.asc())
            )
            preview_source = first_chunk
        preview = _split_preview_lines(preview_source)
        href = (
            f"/courses/{material.course_id}?tab=materials"
            if material.course_id
            else "/courses"
        )
        feed_items.append(
            FeedResourceItemResponse(
                kind="material",
                id=material.id,
                title=material.title,
                course_id=material.course_id,
                course_title=course_titles.get(material.course_id) if material.course_id else None,
                last_activity_at=activity,
                activity_label=_activity_label(activity, "material"),
                meta=FeedResourceMeta(
                    status=material.status,
                    file_name=material.file_name,
                    chunk_count=chunk_count,
                ),
                preview=preview,
                href=href,
            )
        )

    feed_items.sort(key=lambda item: item.last_activity_at, reverse=True)
    exam_items = (
        [item for item in feed_items if item.course_id == next_exam.id][:3] if next_exam else []
    )
    exam_ids = {(item.kind, item.id) for item in exam_items}
    recent_items = [
        item for item in feed_items if (item.kind, item.id) not in exam_ids
    ][:4]

    scores = topic_scores(db, user_id, limit=20)
    weak_topics = [
        TopicScoreResponse(topic=item.topic, score_pct=item.score_pct)
        for item in scores
        if item.score_pct < 70
    ]
    weak_topic_names = [item.topic for item in scores if item.score_pct < 60]
    recommendations = (
        [f"Review {topic} and generate a focused flashcard deck." for topic in weak_topic_names[:3]]
        if weak_topic_names
        else ["Generate a quiz from your latest material to start building progress insights."]
    )

    return StudyFeedResponse(
        next_exam=next_exam_summary,
        exam_items=exam_items,
        recent_items=recent_items,
        weak_topics=weak_topics,
        recommendations=recommendations,
    )


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _truncate_preview(value: str, limit: int = 100) -> str:
    cleaned = " ".join(value.split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 1].rstrip()}…"


def _split_preview_lines(value: str | None, limit: int = 4) -> list[str]:
    if not value:
        return []
    lines = [_truncate_preview(line) for line in value.splitlines() if line.strip()]
    if lines:
        return lines[:limit]
    return [_truncate_preview(value)]


def _activity_label(activity_at: datetime, kind: str) -> str:
    now = datetime.now(UTC)
    activity_at = _ensure_utc(activity_at)
    delta = now - activity_at
    if delta.days == 0:
        return "Active today" if kind != "quiz" else "Played today"
    if delta.days == 1:
        return "Yesterday"
    if delta.days < 7:
        return f"{delta.days} days ago"
    return activity_at.strftime("%b %d")


def _deck_due_label(db: Session, user_id: uuid.UUID, deck_id: uuid.UUID) -> str | None:
    cards = db.scalars(select(Flashcard).where(Flashcard.deck_id == deck_id)).all()
    if not cards:
        return None
    reviews = {
        review.flashcard_id: review
        for review in db.scalars(
            select(FlashcardReview).where(
                FlashcardReview.user_id == user_id,
                FlashcardReview.flashcard_id.in_([card.id for card in cards]),
            )
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
    if due <= 0:
        return None
    return f"{due} card{'s' if due != 1 else ''} due"
