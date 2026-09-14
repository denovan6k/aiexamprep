from uuid import UUID

from fastapi.testclient import TestClient

from helpers import register_user, seed_material_with_chunks


def test_agents_require_authentication(client: TestClient) -> None:
    response = client.get("/agents")
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Missing bearer token."


def test_agent_crud_flow(client: TestClient, monkeypatch) -> None:
    import app.routes.agents as agents_routes

    monkeypatch.setattr(
        agents_routes,
        "generate_agent_profile",
        lambda _description: {
            "name": "Dr. Strict",
            "subject_area": "Biology",
            "difficulty": "hard",
            "marking_strictness": "strict",
            "question_style": {"mcq": True},
            "favorite_topics": ["cell signaling"],
            "common_traps": ["confusing terms"],
            "feedback_tone": "direct",
            "rubric_preferences": {},
        },
    )

    headers, _user = register_user(client)

    create_response = client.post(
        "/agents",
        headers=headers,
        json={
            "description": "Strict biology examiner who focuses on cell signaling pathways.",
            "name": "Dr. Strict",
            "subject_area": "Biology",
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    agent_id = created["id"]
    assert created["name"] == "Dr. Strict"
    assert created["subject_area"] == "Biology"

    list_response = client.get("/agents", headers=headers)
    assert list_response.status_code == 200
    assert [agent["id"] for agent in list_response.json()["items"]] == [agent_id]

    get_response = client.get(f"/agents/{agent_id}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["difficulty"] == "hard"

    patch_response = client.patch(
        f"/agents/{agent_id}",
        headers=headers,
        json={"feedback_tone": "encouraging"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["feedback_tone"] == "encouraging"

    delete_response = client.delete(f"/agents/{agent_id}", headers=headers)
    assert delete_response.status_code == 204
    assert client.get(f"/agents/{agent_id}", headers=headers).status_code == 404


def test_agent_isolation_between_users(client: TestClient, monkeypatch) -> None:
    import app.routes.agents as agents_routes

    monkeypatch.setattr(
        agents_routes,
        "generate_agent_profile",
        lambda _description: {"name": "Examiner", "subject_area": "Chemistry"},
    )

    owner_headers, _owner = register_user(client, email="owner@example.com")
    other_headers, _other = register_user(client, email="other@example.com")

    create_response = client.post(
        "/agents",
        headers=owner_headers,
        json={"description": "Chemistry examiner with emphasis on stoichiometry problems."},
    )
    agent_id = create_response.json()["id"]

    assert client.get(f"/agents/{agent_id}", headers=other_headers).status_code == 404
    assert client.patch(
        f"/agents/{agent_id}", headers=other_headers, json={"name": "Hacked"}
    ).status_code == 404


def test_rate_question(client: TestClient, db_session, monkeypatch) -> None:
    import app.routes.agents as agents_routes
    import app.routes.quizzes as quizzes_routes
    from app.models.entities import Question, Quiz
    from app.services.material_insights import ensure_material_insights

    monkeypatch.setattr(
        agents_routes,
        "generate_agent_profile",
        lambda _description: {"name": "Examiner", "subject_area": "Biology"},
    )
    captured_agent_payloads = []

    def fake_generate_questions(*_args, **kwargs):
        captured_agent_payloads.append(kwargs.get("agent"))
        return [
            {
                "type": "mcq",
                "prompt": "What does LIFO mean?",
                "options": [{"id": "a", "text": "Last in, first out"}],
                "correct_answers": ["a"],
                "explanation": "Stacks are LIFO.",
                "topic": "Stacks",
                "difficulty": "easy",
                "source_refs": [],
            }
        ]

    monkeypatch.setattr(
        quizzes_routes,
        "generate_questions",
        fake_generate_questions,
    )

    headers, user = register_user(client, email="rater@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))
    material.status = "processed"
    ensure_material_insights(db_session, material)
    db_session.commit()

    agent_id = client.post(
        "/agents",
        headers=headers,
        json={"description": "Biology examiner focused on foundational definitions."},
    ).json()["id"]

    quiz_id = client.post(
        "/quizzes/generate",
        headers=headers,
        json={
            "title": "Stack basics",
            "count": 1,
            "material_ids": [str(material.id)],
            "professor_agent_id": agent_id,
        },
    ).json()["id"]

    question_id = client.get(f"/quizzes/{quiz_id}", headers=headers).json()["questions"][0]["id"]
    assert captured_agent_payloads
    assert captured_agent_payloads[0]["material_insights"]

    rating_response = client.post(
        f"/agents/questions/{question_id}/rating",
        headers=headers,
        json={"rating": "up"},
    )
    assert rating_response.status_code == 201
    assert rating_response.json()["rating"] == "up"

    update_response = client.post(
        f"/agents/questions/{question_id}/rating",
        headers=headers,
        json={"rating": "down"},
    )
    assert update_response.status_code == 201
    assert update_response.json()["rating"] == "down"

    quiz = db_session.get(Quiz, UUID(quiz_id))
    assert quiz is not None
    question = db_session.get(Question, UUID(question_id))
    assert question is not None
    assert question.quiz_id == quiz.id
    agent_response = client.get(f"/agents/{agent_id}", headers=headers)
    assert agent_response.status_code == 200
    agent_body = agent_response.json()
    assert agent_body["rubric_preferences"]["feedback"]["up"] == 1
    assert agent_body["rubric_preferences"]["feedback"]["down"] == 1
    assert agent_body["rubric_preferences"]["needs_review"] is True
    assert any("Stacks" in trap for trap in agent_body["common_traps"])


def test_agent_mcp_connection_crud(client: TestClient, monkeypatch) -> None:
    import app.routes.agents as agents_routes
    import app.services.agent_mcp as agent_mcp_service

    monkeypatch.setattr(
        agents_routes,
        "generate_agent_profile",
        lambda _description: {"name": "MCP Agent", "subject_area": "Physics"},
    )
    monkeypatch.setattr(
        agent_mcp_service,
        "_mcp_jsonrpc",
        lambda *_args, **_kwargs: {"tools": [{"name": "search", "description": "Search docs"}]},
    )

    headers, _user = register_user(client, email="mcp@example.com")
    agent_id = client.post(
        "/agents",
        headers=headers,
        json={"description": "Physics examiner who uses external document search tools."},
    ).json()["id"]

    create_response = client.post(
        f"/agents/{agent_id}/mcp-connections",
        headers=headers,
        json={
            "name": "Docs",
            "server_url": "https://mcp.example.com/mcp",
            "transport": "streamable-http",
            "auth_type": "none",
        },
    )
    assert create_response.status_code == 201
    connection_id = create_response.json()["id"]

    list_response = client.get(f"/agents/{agent_id}/mcp-connections", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    sync_response = client.post(
        f"/agents/{agent_id}/mcp-connections/{connection_id}/sync",
        headers=headers,
    )
    assert sync_response.status_code == 200
    assert sync_response.json()["tool_count"] == 1

    get_agent = client.get(f"/agents/{agent_id}", headers=headers).json()
    assert get_agent["mcp_connection_count"] == 1

    delete_response = client.delete(
        f"/agents/{agent_id}/mcp-connections/{connection_id}",
        headers=headers,
    )
    assert delete_response.status_code == 204
