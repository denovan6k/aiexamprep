from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Course,
    Flashcard,
    FlashcardDeck,
    Material,
    ProductEvent,
    Question,
    Quiz,
    QuizAnswer,
    QuizAttempt,
)
from helpers import register_user


def test_analytics_batch_is_allowlisted_and_idempotent(
    client: TestClient, db_session: Session
) -> None:
    headers, user = register_user(client, email="analytics@example.com")
    payload = {
        "events": [
            {
                "event_id": "evt-1",
                "name": "quiz_started",
                "properties": {"quiz_id": "abc"},
                "occurred_at": datetime.now(UTC).isoformat(),
            },
            {
                "event_id": "evt-1",
                "name": "quiz_started",
                "properties": {},
                "occurred_at": datetime.now(UTC).isoformat(),
            },
        ]
    }
    response = client.post("/analytics/events/batch", headers=headers, json=payload)
    assert response.status_code == 200
    assert response.json() == {"accepted": 1, "duplicates": 1}
    repeated = client.post("/analytics/events/batch", headers=headers, json=payload)
    assert repeated.json() == {"accepted": 0, "duplicates": 2}
    assert (
        db_session.scalar(
            select(func.count())
            .select_from(ProductEvent)
            .where(ProductEvent.user_id == UUID(user["id"]))
        )
        == 1
    )

    invalid = payload | {
        "events": [payload["events"][0] | {"event_id": "evt-2", "name": "billing_charged"}]
    }
    assert client.post("/analytics/events/batch", headers=headers, json=invalid).status_code == 422


def test_onboarding_does_not_complete_without_a_course(
    client: TestClient, db_session: Session
) -> None:
    headers, user = register_user(client, email="orphan-artifact@example.com")
    db_session.add(
        Material(
            user_id=UUID(user["id"]),
            title="Unscoped notes",
            file_name="notes.txt",
            storage_path="/tmp/notes.txt",
            status="processed",
        )
    )
    db_session.commit()

    response = client.get("/onboarding", headers=headers)

    assert response.status_code == 200
    assert response.json()["checklist"]["material"] is True
    assert response.json()["checklist"]["course"] is False
    assert response.json()["checklist"]["complete"] is False


def test_onboarding_requires_profile_before_course(client: TestClient) -> None:
    headers, _ = register_user(client, email="course-first@example.com")
    response = client.post(
        "/onboarding/course",
        headers=headers,
        json={
            "title": "Algorithms",
            "confidence_level": "low",
            "exam_date": (datetime.now(UTC) + timedelta(days=5)).isoformat(),
        },
    )
    assert response.status_code == 409
    assert client.get("/onboarding", headers=headers).json()["checklist"]["complete"] is False


def test_onboarding_only_completes_when_finished(
    client: TestClient, db_session: Session
) -> None:
    headers, user = register_user(client, email="explicit-finish@example.com")
    client.patch(
        "/onboarding",
        headers=headers,
        json={"daily_minutes": 45, "study_goal": "Pass the final"},
    )
    course = client.post(
        "/onboarding/course",
        headers=headers,
        json={
            "title": "Algorithms",
            "confidence_level": "low",
            "exam_date": (datetime.now(UTC) + timedelta(days=5)).isoformat(),
        },
    ).json()
    db_session.add(
        Material(
            user_id=UUID(user["id"]),
            course_id=UUID(course["id"]),
            title="Algorithms notes",
            file_name="algorithms.txt",
            storage_path="/tmp/algorithms.txt",
            status="processed",
        )
    )
    db_session.commit()

    before_finish = client.get("/onboarding", headers=headers)
    assert before_finish.status_code == 200
    assert before_finish.json()["checklist"]["profile"] is True
    assert before_finish.json()["checklist"]["course"] is True
    assert before_finish.json()["checklist"]["material"] is True
    assert before_finish.json()["checklist"]["complete"] is False

    finished = client.patch("/onboarding", headers=headers, json={"onboarding_completed": True})
    assert finished.status_code == 200
    assert finished.json()["checklist"]["complete"] is True


def test_onboarding_course_workspace_and_scoped_lists(
    client: TestClient, db_session: Session
) -> None:
    headers, user = register_user(client, email="onboarding@example.com")
    initial = client.get("/onboarding", headers=headers)
    assert initial.status_code == 200
    assert initial.json()["profile"]["daily_minutes"] == 30
    assert initial.json()["checklist"]["complete"] is False

    patched = client.patch(
        "/onboarding",
        headers=headers,
        json={"daily_minutes": 45, "study_goal": "Pass the final"},
    )
    assert patched.status_code == 200
    assert patched.json()["checklist"]["profile"] is True
    course_response = client.post(
        "/onboarding/course",
        headers=headers,
        json={
            "title": "Algorithms",
            "confidence_level": "low",
            "exam_date": (datetime.now(UTC) + timedelta(days=5)).isoformat(),
        },
    )
    assert course_response.status_code == 201
    course = course_response.json()
    other_course = client.post("/courses", headers=headers, json={"title": "Databases"}).json()

    material = Material(
        user_id=UUID(user["id"]),
        course_id=UUID(course["id"]),
        title="Algorithms notes",
        file_name="algorithms.txt",
        storage_path="/tmp/algorithms.txt",
        status="ready",
    )
    quiz = Quiz(
        user_id=UUID(user["id"]),
        course_id=UUID(course["id"]),
        title="Algorithms quiz",
        status="ready",
    )
    deck = FlashcardDeck(
        user_id=UUID(user["id"]),
        course_id=UUID(course["id"]),
        title="Algorithms cards",
    )
    db_session.add_all([material, quiz, deck])
    db_session.commit()

    workspace = client.get(f"/courses/{course['id']}/workspace", headers=headers)
    assert workspace.status_code == 200
    assert workspace.json()["confidence_level"] == "low"
    assert len(workspace.json()["materials"]) == 1
    assert (
        len(client.get(f"/quizzes?course_id={course['id']}", headers=headers).json()["items"]) == 1
    )
    assert (
        client.get(f"/quizzes?course_id={other_course['id']}", headers=headers).json()["items"]
        == []
    )
    assert (
        len(
            client.get(f"/flashcard-decks?course_id={course['id']}", headers=headers).json()[
                "items"
            ]
        )
        == 1
    )


def test_today_plan_is_idempotent_and_actionable(client: TestClient, db_session: Session) -> None:
    headers, user = register_user(client, email="plan@example.com")
    course = Course(
        user_id=UUID(user["id"]),
        title="Operating Systems",
        exam_date=datetime.now(UTC) + timedelta(days=2),
    )
    db_session.add(course)
    db_session.commit()

    first = client.get("/study/today", headers=headers)
    second = client.get("/study/today", headers=headers)
    assert first.status_code == 200
    assert len(first.json()["items"]) == 1
    assert first.json()["items"][0]["id"] == second.json()["items"][0]["id"]
    item_id = first.json()["items"][0]["id"]
    completed = client.patch(
        f"/study/plan-items/{item_id}",
        headers=headers,
        json={"action": "complete"},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    refreshed = client.post("/study/today/refresh", headers=headers)
    assert refreshed.status_code == 200
    assert any(item["id"] == item_id for item in refreshed.json()["items"])


def test_user_can_add_custom_plan_item_for_today(client: TestClient, db_session: Session) -> None:
    headers, user = register_user(client, email="custom-plan@example.com")
    db_session.add(
        Course(
            user_id=UUID(user["id"]),
            title="Biology",
            exam_date=datetime.now(UTC) + timedelta(days=5),
        )
    )
    db_session.commit()
    course_id = db_session.scalar(select(Course.id).where(Course.user_id == UUID(user["id"])))

    baseline = client.get("/study/today", headers=headers)
    assert baseline.status_code == 200
    initial_count = len(baseline.json()["items"])

    created = client.post(
        "/study/plan-items",
        headers=headers,
        json={
            "title": "Review lab notes",
            "estimated_minutes": 20,
            "item_type": "custom",
            "course_id": str(course_id),
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "Review lab notes"
    assert body["estimated_minutes"] == 20
    assert body["status"] == "pending"
    assert body["item_type"] == "custom"

    updated = client.get("/study/today", headers=headers)
    assert updated.status_code == 200
    assert len(updated.json()["items"]) == initial_count + 1
    assert any(item["title"] == "Review lab notes" for item in updated.json()["items"])


def test_remediation_is_owned_idempotent_and_creates_provenance(
    client: TestClient, db_session: Session
) -> None:
    headers, user = register_user(client, email="remediation@example.com")
    user_id = UUID(user["id"])
    course = Course(user_id=user_id, title="Data Structures")
    quiz = Quiz(user_id=user_id, course=course, title="Stacks quiz", status="ready")
    db_session.add(quiz)
    db_session.flush()
    question = Question(
        quiz_id=quiz.id,
        type="mcq",
        prompt="Which structure is FIFO?",
        options=[{"id": "a", "text": "Stack"}, {"id": "b", "text": "Queue"}],
        correct_answers=["b"],
        explanation="A queue is FIFO.",
        topic="Queues",
    )
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user_id,
        status="submitted",
        submitted_at=datetime.now(UTC),
        score=Decimal("0"),
        max_score=Decimal("1"),
    )
    db_session.add_all([question, attempt])
    db_session.flush()
    db_session.add(
        QuizAnswer(
            attempt_id=attempt.id,
            question_id=question.id,
            answer="a",
            is_correct=False,
            score=Decimal("0"),
            feedback="Review queues.",
        )
    )
    db_session.commit()

    options = client.get(f"/quizzes/attempts/{attempt.id}/remediation", headers=headers)
    assert options.status_code == 200
    assert options.json()["weak_topics"] == ["Queues"]

    request = {"action": "deck", "topics": ["Queues"]}
    created = client.post(
        f"/quizzes/attempts/{attempt.id}/remediation",
        headers=headers,
        json=request,
    )
    repeated = client.post(
        f"/quizzes/attempts/{attempt.id}/remediation",
        headers=headers,
        json=request,
    )
    assert created.status_code == 201
    assert repeated.json()["resource_id"] == created.json()["resource_id"]
    deck = db_session.get(FlashcardDeck, UUID(created.json()["resource_id"]))
    assert deck is not None
    assert deck.source_attempt_id == attempt.id
    assert (
        db_session.scalar(
            select(func.count()).select_from(Flashcard).where(Flashcard.deck_id == deck.id)
        )
        == 1
    )

    retry = client.post(
        f"/quizzes/attempts/{attempt.id}/remediation",
        headers=headers,
        json={"action": "retry"},
    )
    assert retry.status_code == 201
    retry_quiz = db_session.get(Quiz, UUID(retry.json()["resource_id"]))
    assert retry_quiz is not None
    assert retry_quiz.source_attempt_id == attempt.id

    explain = client.post(
        f"/quizzes/attempts/{attempt.id}/remediation",
        headers=headers,
        json={"action": "explain"},
    )
    assert explain.status_code == 201
    assert explain.json()["resource_id"] is None
    assert "context_type=quiz_remediation" in explain.json()["url"]

    other_headers, _ = register_user(client, email="remediation-other@example.com")
    assert (
        client.get(f"/quizzes/attempts/{attempt.id}/remediation", headers=other_headers).status_code
        == 404
    )


def test_study_feed_orders_by_activity_and_filters_exam_items(
    client: TestClient, db_session: Session
) -> None:
    headers, user = register_user(client, email="feed@example.com")
    user_id = UUID(user["id"])
    exam_course = Course(
        user_id=user_id,
        title="Operating Systems",
        exam_date=datetime.now(UTC) + timedelta(days=3),
    )
    other_course = Course(user_id=user_id, title="Biology")
    db_session.add_all([exam_course, other_course])
    db_session.flush()

    exam_quiz = Quiz(
        user_id=user_id,
        course_id=exam_course.id,
        title="OS Midterm",
        status="ready",
        updated_at=datetime.now(UTC) - timedelta(days=5),
    )
    recent_quiz = Quiz(
        user_id=user_id,
        course_id=other_course.id,
        title="Cell Biology",
        status="ready",
        updated_at=datetime.now(UTC) - timedelta(days=1),
    )
    db_session.add_all([exam_quiz, recent_quiz])
    db_session.flush()
    db_session.add(
        Question(
            quiz_id=exam_quiz.id,
            type="mcq",
            prompt="What is a process?",
            options=[{"id": "a", "text": "A program in execution"}],
            correct_answers=["a"],
        )
    )
    db_session.add(
        QuizAttempt(
            quiz_id=recent_quiz.id,
            user_id=user_id,
            status="submitted",
            started_at=datetime.now(UTC) - timedelta(hours=2),
            submitted_at=datetime.now(UTC) - timedelta(hours=1),
            score=Decimal("1"),
            max_score=Decimal("1"),
        )
    )
    deck = FlashcardDeck(
        user_id=user_id,
        course_id=exam_course.id,
        title="OS Terms",
        updated_at=datetime.now(UTC) - timedelta(days=2),
    )
    db_session.add(deck)
    db_session.flush()
    card = Flashcard(deck_id=deck.id, front="Mutex", back="Mutual exclusion")
    db_session.add(card)
    db_session.commit()

    response = client.get("/study/feed", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["next_exam"]["title"] == "Operating Systems"
    assert any(item["title"] == "OS Midterm" for item in body["exam_items"])
    assert body["recent_items"][0]["title"] == "Cell Biology"
    assert body["recent_items"][0]["kind"] == "quiz"
    deck_item = next(item for item in body["exam_items"] if item["kind"] == "deck")
    assert deck_item["preview"] == ["Mutex"]
