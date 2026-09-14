from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.rate_limit import reset_rate_limits_for_tests
from app.models.entities import Quiz, QuizAttempt
from helpers import register_user, seed_material_with_chunks

SAMPLE_QUESTIONS = [
    {
        "type": "mcq",
        "prompt": "Which structure uses LIFO ordering?",
        "options": [
            {"id": "a", "text": "Stack"},
            {"id": "b", "text": "Queue"},
        ],
        "correct_answers": ["a"],
        "explanation": "Stacks are last-in, first-out.",
        "topic": "Stacks",
        "difficulty": "easy",
        "source_refs": [],
    },
    {
        "type": "true_false",
        "prompt": "Queues are FIFO structures.",
        "options": None,
        "correct_answers": ["true"],
        "explanation": "Queues process items in arrival order.",
        "topic": "Queues",
        "difficulty": "easy",
        "source_refs": [],
    },
]


def test_quizzes_require_authentication(client: TestClient) -> None:
    response = client.get("/quizzes")
    assert response.status_code == 401


def test_generate_quiz_without_material_returns_400(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/quizzes/generate",
        headers=auth_headers,
        json={"title": "Empty quiz", "count": 5},
    )
    assert response.status_code == 400
    assert "Upload and process at least one material" in response.json()["error"]["message"]


def test_generate_and_list_quiz(client: TestClient, db_session, monkeypatch) -> None:
    import app.routes.quizzes as quizzes_routes

    monkeypatch.setattr(quizzes_routes, "generate_questions", lambda *_args, **_kwargs: SAMPLE_QUESTIONS)

    headers, user = register_user(client, email="quiz@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))

    generate_response = client.post(
        "/quizzes/generate",
        headers=headers,
        json={
            "title": "Data structures quiz",
            "count": 2,
            "material_ids": [str(material.id)],
            "question_types": ["mcq", "true_false"],
        },
    )
    assert generate_response.status_code == 201
    quiz = generate_response.json()
    assert quiz["title"] == "Data structures quiz"
    assert len(quiz["questions"]) == 2

    list_response = client.get("/quizzes", headers=headers)
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()["items"]] == [quiz["id"]]

    get_response = client.get(f"/quizzes/{quiz['id']}", headers=headers)
    assert get_response.status_code == 200
    question = get_response.json()["questions"][0]
    assert question["prompt"].startswith("Which structure")
    assert "correct_answers" not in question
    assert "explanation" not in question


def test_quiz_attempt_submit_and_review(client: TestClient, db_session, monkeypatch) -> None:
    import app.routes.quizzes as quizzes_routes

    monkeypatch.setattr(quizzes_routes, "generate_questions", lambda *_args, **_kwargs: SAMPLE_QUESTIONS[:1])

    headers, user = register_user(client, email="attempt@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))

    quiz_id = client.post(
        "/quizzes/generate",
        headers=headers,
        json={"title": "Attempt quiz", "count": 1, "material_ids": [str(material.id)]},
    ).json()["id"]
    question_id = client.get(f"/quizzes/{quiz_id}", headers=headers).json()["questions"][0]["id"]

    attempt_response = client.post(f"/quizzes/{quiz_id}/attempts", headers=headers)
    assert attempt_response.status_code == 201
    attempt_id = attempt_response.json()["id"]
    assert attempt_response.json()["status"] == "in_progress"

    save_response = client.put(
        f"/quizzes/attempts/{attempt_id}/answers/{question_id}",
        headers=headers,
        json={"answer": "a"},
    )
    assert save_response.status_code == 200
    assert save_response.json()["answer"] == "a"
    assert "is_correct" not in save_response.json()

    context_response = client.get(f"/quizzes/attempts/{attempt_id}/context", headers=headers)
    assert context_response.status_code == 200
    context = context_response.json()
    assert context["answered_count"] == 1
    assert context["correct_count"] == 0
    assert "elapsed_seconds" in context

    flag_response = client.patch(
        f"/quizzes/attempts/{attempt_id}/answers/{question_id}/flag",
        headers=headers,
        json={"flagged": True},
    )
    assert flag_response.status_code == 200
    assert flag_response.json()["flagged"] is True

    context_after_flag = client.get(f"/quizzes/attempts/{attempt_id}/context", headers=headers).json()
    assert context_after_flag["flagged_count"] == 1

    submit_response = client.post(f"/quizzes/attempts/{attempt_id}/submit", headers=headers)
    assert submit_response.status_code == 200
    review = submit_response.json()
    assert review["attempt"]["status"] == "submitted"
    assert review["attempt"]["score"] == "1.00"
    assert review["answers"][0]["is_correct"] is True

    review_response = client.get(f"/quizzes/attempts/{attempt_id}/review", headers=headers)
    assert review_response.status_code == 200
    assert review_response.json()["attempt"]["id"] == attempt_id


def test_mcq_scores_generated_answer_text_as_option_id(
    client: TestClient, db_session, monkeypatch
) -> None:
    import app.routes.quizzes as quizzes_routes

    generated_question = {
        **SAMPLE_QUESTIONS[0],
        "correct_answers": ["Stack"],
    }
    monkeypatch.setattr(
        quizzes_routes,
        "generate_questions",
        lambda *_args, **_kwargs: [generated_question],
    )
    monkeypatch.setattr(
        quizzes_routes,
        "_retrieval_chunks",
        lambda *_args, **_kwargs: [{"id": "choice-source", "text": "Stacks use LIFO ordering."}],
    )

    headers, user = register_user(client, email="choice-normalization@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))
    quiz = client.post(
        "/quizzes/generate",
        headers=headers,
        json={"title": "Normalized choices", "count": 1, "material_ids": [str(material.id)]},
    ).json()
    question_id = quiz["questions"][0]["id"]
    attempt_id = client.post(f"/quizzes/{quiz['id']}/attempts", headers=headers).json()["id"]

    client.put(
        f"/quizzes/attempts/{attempt_id}/answers/{question_id}",
        headers=headers,
        json={"answer": "a"},
    )
    review = client.post(f"/quizzes/attempts/{attempt_id}/submit", headers=headers).json()

    assert review["attempt"]["score"] == "1.00"
    assert review["answers"][0]["is_correct"] is True


def test_mcq_scores_zero_based_correct_answer_index(
    client: TestClient, db_session, monkeypatch
) -> None:
    import app.routes.quizzes as quizzes_routes

    generated_question = {
        **SAMPLE_QUESTIONS[0],
        "correct_answers": [0],
    }
    monkeypatch.setattr(
        quizzes_routes,
        "generate_questions",
        lambda *_args, **_kwargs: [generated_question],
    )
    monkeypatch.setattr(
        quizzes_routes,
        "_retrieval_chunks",
        lambda *_args, **_kwargs: [{"id": "zero-based-source", "text": "Stacks use LIFO ordering."}],
    )

    headers, user = register_user(client, email="zero-based-index@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))
    quiz = client.post(
        "/quizzes/generate",
        headers=headers,
        json={"title": "Zero-based index", "count": 1, "material_ids": [str(material.id)]},
    ).json()
    question_id = quiz["questions"][0]["id"]
    attempt_id = client.post(f"/quizzes/{quiz['id']}/attempts", headers=headers).json()["id"]

    client.put(
        f"/quizzes/attempts/{attempt_id}/answers/{question_id}",
        headers=headers,
        json={"answer": "a"},
    )
    review = client.post(f"/quizzes/attempts/{attempt_id}/submit", headers=headers).json()

    assert review["attempt"]["score"] == "1.00"
    assert review["answers"][0]["is_correct"] is True


def test_matching_scores_when_correct_answers_use_display_text(
    client: TestClient, db_session, monkeypatch
) -> None:
    import app.routes.quizzes as quizzes_routes

    matching_question = {
        "type": "matching",
        "prompt": "Match each term to its definition.",
        "options": {
            "left": [
                {"id": "l0", "text": "Stack"},
                {"id": "l1", "text": "Queue"},
            ],
            "right": [
                {"id": "r0", "text": "LIFO structure"},
                {"id": "r1", "text": "FIFO structure"},
            ],
        },
        "correct_answers": [
            {"left": "Stack", "right": "LIFO structure"},
            {"left": "Queue", "right": "FIFO structure"},
        ],
        "explanation": "Stacks and queues differ in ordering.",
        "topic": "Data structures",
        "difficulty": "easy",
        "source_refs": [],
    }
    monkeypatch.setattr(
        quizzes_routes,
        "generate_questions",
        lambda *_args, **_kwargs: [matching_question],
    )
    monkeypatch.setattr(
        quizzes_routes,
        "_retrieval_chunks",
        lambda *_args, **_kwargs: [{"id": "matching-source", "text": "Stacks and queues differ in ordering."}],
    )

    headers, user = register_user(client, email="matching-alias@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))
    quiz = client.post(
        "/quizzes/generate",
        headers=headers,
        json={
            "title": "Matching quiz",
            "count": 1,
            "material_ids": [str(material.id)],
            "question_types": ["matching"],
        },
    ).json()
    question_id = quiz["questions"][0]["id"]
    attempt_id = client.post(f"/quizzes/{quiz['id']}/attempts", headers=headers).json()["id"]

    client.put(
        f"/quizzes/attempts/{attempt_id}/answers/{question_id}",
        headers=headers,
        json={
            "answer": [
                {"left": "l0", "right": "r0"},
                {"left": "l1", "right": "r1"},
            ]
        },
    )
    review = client.post(f"/quizzes/attempts/{attempt_id}/submit", headers=headers).json()

    assert review["attempt"]["score"] == "1.00"
    assert review["answers"][0]["is_correct"] is True


def test_mcq_scores_when_stored_correct_answers_are_blank(
    client: TestClient, db_session, monkeypatch
) -> None:
    import app.routes.quizzes as quizzes_routes

    generated_question = {
        **SAMPLE_QUESTIONS[0],
        "correct_answers": [""],
        "explanation": "Stacks are last-in, first-out structures.",
    }
    monkeypatch.setattr(
        quizzes_routes,
        "generate_questions",
        lambda *_args, **_kwargs: [generated_question],
    )
    monkeypatch.setattr(
        quizzes_routes,
        "_retrieval_chunks",
        lambda *_args, **_kwargs: [{"id": "blank-key-source", "text": "Stacks use LIFO ordering."}],
    )

    headers, user = register_user(client, email="blank-key@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))
    quiz = client.post(
        "/quizzes/generate",
        headers=headers,
        json={"title": "Blank key quiz", "count": 1, "material_ids": [str(material.id)]},
    ).json()
    question_id = quiz["questions"][0]["id"]
    attempt_id = client.post(f"/quizzes/{quiz['id']}/attempts", headers=headers).json()["id"]

    client.put(
        f"/quizzes/attempts/{attempt_id}/answers/{question_id}",
        headers=headers,
        json={"answer": "a"},
    )
    review = client.post(f"/quizzes/attempts/{attempt_id}/submit", headers=headers).json()

    assert review["attempt"]["score"] == "1.00"
    assert review["answers"][0]["is_correct"] is True
    assert review["questions"][0]["correct_answers"] == ["a"]


def test_true_false_attempt_scores_with_legacy_option_ids(client: TestClient, db_session, monkeypatch) -> None:
    import app.routes.quizzes as quizzes_routes

    legacy_true_false = [
        {
            "type": "true_false",
            "prompt": "Queues are FIFO structures.",
            "options": [
                {"id": "a", "text": "True"},
                {"id": "b", "text": "False"},
            ],
            "correct_answers": ["true"],
            "explanation": "Queues process items in arrival order.",
            "topic": "Queues",
            "difficulty": "easy",
            "source_refs": [],
        }
    ]
    monkeypatch.setattr(quizzes_routes, "generate_questions", lambda *_args, **_kwargs: legacy_true_false)

    headers, user = register_user(client, email="truefalse@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))

    quiz_id = client.post(
        "/quizzes/generate",
        headers=headers,
        json={
            "title": "True/false quiz",
            "count": 1,
            "material_ids": [str(material.id)],
            "question_types": ["true_false"],
        },
    ).json()["id"]
    quiz = client.get(f"/quizzes/{quiz_id}", headers=headers).json()
    question = quiz["questions"][0]
    assert question["options"] == [
        {"id": "true", "text": "True"},
        {"id": "false", "text": "False"},
    ]

    attempt_id = client.post(f"/quizzes/{quiz_id}/attempts", headers=headers).json()["id"]
    save_response = client.put(
        f"/quizzes/attempts/{attempt_id}/answers/{question['id']}",
        headers=headers,
        json={"answer": "true"},
    )
    assert save_response.status_code == 200
    assert "is_correct" not in save_response.json()

    review = client.post(f"/quizzes/attempts/{attempt_id}/submit", headers=headers).json()
    assert review["attempt"]["score"] == "1.00"


def test_attempt_isolation_between_users(client: TestClient, db_session, monkeypatch) -> None:
    import app.routes.quizzes as quizzes_routes

    monkeypatch.setattr(quizzes_routes, "generate_questions", lambda *_args, **_kwargs: SAMPLE_QUESTIONS[:1])

    owner_headers, owner = register_user(client, email="owner-quiz@example.com")
    other_headers, _other = register_user(client, email="other-quiz@example.com")
    material = seed_material_with_chunks(db_session, UUID(owner["id"]))

    quiz_id = client.post(
        "/quizzes/generate",
        headers=owner_headers,
        json={"title": "Private quiz", "count": 1, "material_ids": [str(material.id)]},
    ).json()["id"]
    attempt_id = client.post(f"/quizzes/{quiz_id}/attempts", headers=owner_headers).json()["id"]

    assert client.get(f"/quizzes/attempts/{attempt_id}/review", headers=other_headers).status_code == 404


def test_quiz_generation_rate_limit(client: TestClient, db_session, monkeypatch) -> None:
    import app.routes.quizzes as quizzes_routes

    monkeypatch.setattr(quizzes_routes, "generate_questions", lambda *_args, **_kwargs: SAMPLE_QUESTIONS[:1])
    monkeypatch.setattr(settings, "rate_limit_quiz_generations_per_hour", 2)

    headers, user = register_user(client, email="limited@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))
    payload = {"title": "Limited quiz", "count": 1, "material_ids": [str(material.id)]}

    assert client.post("/quizzes/generate", headers=headers, json=payload).status_code == 201
    assert client.post("/quizzes/generate", headers=headers, json=payload).status_code == 201

    limited_response = client.post("/quizzes/generate", headers=headers, json=payload)
    assert limited_response.status_code == 429
    assert "Rate limit exceeded" in limited_response.json()["error"]["message"]

    reset_rate_limits_for_tests()


def test_timed_attempt_start_returns_timer_metadata(client: TestClient, db_session, monkeypatch) -> None:
    import app.routes.quizzes as quizzes_routes

    monkeypatch.setattr(quizzes_routes, "generate_questions", lambda *_args, **_kwargs: SAMPLE_QUESTIONS[:1])

    headers, user = register_user(client, email="timed@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))

    quiz_id = client.post(
        "/quizzes/generate",
        headers=headers,
        json={"title": "Timed quiz", "count": 1, "material_ids": [str(material.id)]},
    ).json()["id"]

    patch_response = client.patch(
        f"/quizzes/{quiz_id}",
        headers=headers,
        json={"timer_minutes": 30},
    )
    assert patch_response.status_code == 200

    attempt_response = client.post(f"/quizzes/{quiz_id}/attempts", headers=headers)
    assert attempt_response.status_code == 201
    attempt = attempt_response.json()
    assert attempt["timer_seconds"] == 1800
    assert attempt["seconds_remaining"] is not None
    assert 1790 <= attempt["seconds_remaining"] <= 1800
    assert attempt["deadline_at"] is not None
    assert attempt["timer_expired"] is False

    context = client.get(f"/quizzes/attempts/{attempt['id']}/context", headers=headers).json()
    assert context["timer_seconds"] == 1800
    assert context["deadline_at"] is not None


def test_string_timer_minutes_in_config(client: TestClient, db_session, monkeypatch) -> None:
    import app.routes.quizzes as quizzes_routes

    monkeypatch.setattr(quizzes_routes, "generate_questions", lambda *_args, **_kwargs: SAMPLE_QUESTIONS[:1])

    headers, user = register_user(client, email="string-timer@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))

    quiz_id = client.post(
        "/quizzes/generate",
        headers=headers,
        json={"title": "String timer quiz", "count": 1, "material_ids": [str(material.id)]},
    ).json()["id"]

    quiz = db_session.get(Quiz, UUID(quiz_id))
    assert quiz is not None
    quiz.config = {**(quiz.config or {}), "timer_minutes": "15"}
    db_session.add(quiz)
    db_session.commit()

    attempt_response = client.post(f"/quizzes/{quiz_id}/attempts", headers=headers)
    assert attempt_response.status_code == 201
    attempt = attempt_response.json()
    assert attempt["timer_seconds"] == 900


def test_expired_attempt_auto_submits(client: TestClient, db_session, monkeypatch) -> None:
    import app.routes.quizzes as quizzes_routes

    monkeypatch.setattr(quizzes_routes, "generate_questions", lambda *_args, **_kwargs: SAMPLE_QUESTIONS[:1])

    headers, user = register_user(client, email="expired@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))

    quiz_id = client.post(
        "/quizzes/generate",
        headers=headers,
        json={"title": "Expired quiz", "count": 1, "material_ids": [str(material.id)]},
    ).json()["id"]

    client.patch(f"/quizzes/{quiz_id}", headers=headers, json={"timer_minutes": 1})

    attempt_id = client.post(f"/quizzes/{quiz_id}/attempts", headers=headers).json()["id"]
    attempt = db_session.get(QuizAttempt, UUID(attempt_id))
    assert attempt is not None
    attempt.timing_metadata = {
        "timer_seconds": 60,
        "deadline_at": (datetime.now(UTC) - timedelta(seconds=5)).isoformat(),
    }
    db_session.add(attempt)
    db_session.commit()

    context_response = client.get(f"/quizzes/attempts/{attempt_id}/context", headers=headers)
    assert context_response.status_code == 200
    context = context_response.json()
    assert context["timer_expired"] is True

    review_response = client.get(f"/quizzes/attempts/{attempt_id}/review", headers=headers)
    assert review_response.status_code == 200
    assert review_response.json()["attempt"]["status"] == "submitted"


def test_manual_short_answer_editor_publish_and_play_safety(client: TestClient, db_session) -> None:
    headers, _user = register_user(client, email="manual-short@example.com")

    create_response = client.post(
        "/quizzes",
        headers=headers,
        json={
            "title": "Gravity quiz",
            "short_answer_grading": "provided_answers",
            "questions": [
                {
                    "type": "short_answer",
                    "prompt": "What is gravity?",
                    "model_answers": ["gravity", "mass"],
                    "explanation": "Gravity relates mass and attraction.",
                }
            ],
        },
    )
    assert create_response.status_code == 201
    quiz_id = create_response.json()["id"]
    assert create_response.json()["status"] == "draft"

    publish_response = client.put(
        f"/quizzes/{quiz_id}/content",
        headers=headers,
        json={
            "status": "ready",
            "short_answer_grading": "provided_answers",
            "questions": [
                {
                    "type": "short_answer",
                    "prompt": "What is gravity?",
                    "model_answers": ["gravity", "mass"],
                    "explanation": "Gravity relates mass and attraction.",
                }
            ],
        },
    )
    assert publish_response.status_code == 200
    assert publish_response.json()["status"] == "ready"

    play_response = client.get(f"/quizzes/{quiz_id}", headers=headers).json()
    assert play_response["status"] == "ready"
    assert "correct_answers" not in play_response["questions"][0]

    editor_response = client.get(f"/quizzes/{quiz_id}/editor", headers=headers).json()
    assert "correct_answers" in editor_response["questions"][0]
    assert editor_response["questions"][0]["correct_answers"] == ["gravity", "mass"]

    attempt_response = client.post(f"/quizzes/{quiz_id}/attempts", headers=headers)
    assert attempt_response.status_code == 201
    attempt_id = attempt_response.json()["id"]
    question_id = editor_response["questions"][0]["id"]

    save_response = client.put(
        f"/quizzes/attempts/{attempt_id}/answers/{question_id}",
        headers=headers,
        json={"answer": "gravity"},
    )
    assert save_response.status_code == 200
    assert save_response.json()["answer"] == "gravity"
    assert "is_correct" not in save_response.json()

    submit_response = client.post(f"/quizzes/attempts/{attempt_id}/submit", headers=headers)
    assert submit_response.status_code == 200
    review = submit_response.json()
    assert review["attempt"]["status"] == "submitted"
    # 1 / 2 keyword hits => 0.50 score
    assert review["answers"][0]["score"] in {"0.50", "0.5"}
    assert review["answers"][0]["is_correct"] is None


def test_manual_short_answer_ai_correctness_uses_llm(
    client: TestClient, db_session, monkeypatch
) -> None:
    import app.routes.quizzes as quizzes_routes

    monkeypatch.setattr(quizzes_routes, "score_subjective_answer", lambda *_args, **_kwargs: (0.9, "AI feedback"))

    headers, _user = register_user(client, email="manual-short-ai@example.com")
    create_response = client.post(
        "/quizzes",
        headers=headers,
        json={
            "title": "AI-graded quiz",
            "short_answer_grading": "ai_correctness",
            "questions": [
                {
                    "type": "short_answer",
                    "prompt": "Name something important",
                    "model_answers": ["gravity", "mass"],
                }
            ],
        },
    )
    assert create_response.status_code == 201
    quiz_id = create_response.json()["id"]

    publish_response = client.put(
        f"/quizzes/{quiz_id}/content",
        headers=headers,
        json={
            "status": "ready",
            "short_answer_grading": "ai_correctness",
            "questions": [
                {
                    "type": "short_answer",
                    "prompt": "Name something important",
                    "model_answers": ["gravity", "mass"],
                }
            ],
        },
    )
    assert publish_response.status_code == 200

    editor_response = client.get(f"/quizzes/{quiz_id}/editor", headers=headers).json()
    question_id = editor_response["questions"][0]["id"]

    attempt_response = client.post(f"/quizzes/{quiz_id}/attempts", headers=headers)
    assert attempt_response.status_code == 201
    attempt_id = attempt_response.json()["id"]

    client.put(
        f"/quizzes/attempts/{attempt_id}/answers/{question_id}",
        headers=headers,
        json={"answer": "whatever"},
    )

    submit_response = client.post(f"/quizzes/attempts/{attempt_id}/submit", headers=headers)
    assert submit_response.status_code == 200
    review = submit_response.json()
    assert review["answers"][0]["score"] in {"0.90", "0.9"}


def test_manual_short_answer_publish_validation(client: TestClient, db_session) -> None:
    headers, _user = register_user(client, email="manual-short-invalid@example.com")

    create_response = client.post(
        "/quizzes",
        headers=headers,
        json={
            "title": "Invalid short answer quiz",
            "short_answer_grading": "provided_answers",
            "questions": [
                {
                    "type": "short_answer",
                    "prompt": "What is gravity?",
                    "model_answers": [],
                }
            ],
        },
    )
    assert create_response.status_code == 201
    quiz_id = create_response.json()["id"]

    publish_response = client.put(
        f"/quizzes/{quiz_id}/content",
        headers=headers,
        json={
            "status": "ready",
            "short_answer_grading": "provided_answers",
            "questions": [
                {
                    "type": "short_answer",
                    "prompt": "What is gravity?",
                    "model_answers": [],
                }
            ],
        },
    )
    assert publish_response.status_code == 422


def test_manual_quiz_edit_locked_after_submit(client: TestClient, db_session) -> None:
    headers, _user = register_user(client, email="manual-lock@example.com")

    create_response = client.post(
        "/quizzes",
        headers=headers,
        json={
            "title": "Lock test quiz",
            "short_answer_grading": "provided_answers",
            "questions": [
                {"type": "short_answer", "prompt": "What is X?", "model_answers": ["x"]},
            ],
        },
    )
    quiz_id = create_response.json()["id"]

    client.put(
        f"/quizzes/{quiz_id}/content",
        headers=headers,
        json={
            "status": "ready",
            "short_answer_grading": "provided_answers",
            "questions": [
                {"type": "short_answer", "prompt": "What is X?", "model_answers": ["x"]},
            ],
        },
    )

    editor_response = client.get(f"/quizzes/{quiz_id}/editor", headers=headers).json()
    question_id = editor_response["questions"][0]["id"]

    attempt_response = client.post(f"/quizzes/{quiz_id}/attempts", headers=headers)
    attempt_id = attempt_response.json()["id"]

    client.put(
        f"/quizzes/attempts/{attempt_id}/answers/{question_id}",
        headers=headers,
        json={"answer": "x"},
    )
    client.post(f"/quizzes/attempts/{attempt_id}/submit", headers=headers)

    lock_response = client.put(
        f"/quizzes/{quiz_id}/content",
        headers=headers,
        json={
            "status": "draft",
            "questions": [{"type": "short_answer", "prompt": "Changed prompt", "model_answers": ["x"]}],
        },
    )
    assert lock_response.status_code == 409


def test_populate_manual_quiz_as_draft_keeps_status(
    client: TestClient, db_session, monkeypatch
) -> None:
    import app.routes.quizzes as quizzes_routes

    monkeypatch.setattr(
        quizzes_routes,
        "_retrieval_chunks",
        lambda *_args, **_kwargs: [
            {"id": "c1", "text": "Sample chunk text", "material_title": "Material 1"}
        ],
    )
    monkeypatch.setattr(
        quizzes_routes,
        "generate_questions",
        lambda *_args, count=1, question_types=None, **_kwargs: [
            {
                "type": "mcq",
                "prompt": f"Question 1 ({question_types})",
                "options": [
                    {"id": "a", "text": "Option A"},
                    {"id": "b", "text": "Option B"},
                ],
                "correct_answers": ["b"],
                "explanation": "Because B is correct.",
                "topic": "Topic",
                "difficulty": "easy",
                "source_refs": [],
            }
        ][:count],
    )

    headers, _user = register_user(client, email="manual-populate@example.com")
    material = seed_material_with_chunks(db_session, UUID(_user["id"]))

    create_response = client.post(
        "/quizzes",
        headers=headers,
        json={
            "title": "Populate MCQ quiz",
            "options_count": 2,
            "questions": [
                {
                    "type": "mcq",
                    "prompt": "",
                    "options": [
                        {"id": "a", "text": ""},
                        {"id": "b", "text": ""},
                    ],
                    "correct_option_id": "a",
                }
            ],
        },
    )
    assert create_response.status_code == 201
    quiz_id = create_response.json()["id"]
    assert create_response.json()["status"] == "draft"

    populate_response = client.post(
        f"/quizzes/{quiz_id}/populate",
        headers=headers,
        json={
            "material_ids": [str(material.id)],
            "count": 1,
            "question_types": ["mcq"],
            "options_count": 2,
        },
    )
    assert populate_response.status_code == 201
    populated = populate_response.json()
    assert populated["status"] == "draft"
    assert len(populated["questions"]) == 1
    assert populated["config"]["source"] == "ai_assisted"
