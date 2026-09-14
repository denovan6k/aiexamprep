from uuid import UUID

from fastapi.testclient import TestClient

from helpers import register_user, seed_material_with_chunks

SAMPLE_FLASHCARDS = [
    {
        "front": "What is LIFO?",
        "back": "Last in, first out.",
        "topic": "Stacks",
        "difficulty": "easy",
        "source_refs": [],
    },
    {
        "front": "What is FIFO?",
        "back": "First in, first out.",
        "topic": "Queues",
        "difficulty": "easy",
        "source_refs": [],
    },
]


def test_flashcards_require_authentication(client: TestClient) -> None:
    response = client.get("/flashcard-decks")
    assert response.status_code == 401


def test_generate_flashcard_deck_without_material_returns_400(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.post(
        "/flashcard-decks/generate",
        headers=auth_headers,
        json={"title": "Empty deck", "count": 5},
    )
    assert response.status_code == 400
    assert "Upload and process at least one material" in response.json()["error"]["message"]


def test_generate_list_get_and_delete_deck(client: TestClient, db_session, monkeypatch) -> None:
    import app.routes.flashcards as flashcards_routes

    monkeypatch.setattr(
        flashcards_routes, "generate_flashcards", lambda *_args, **_kwargs: SAMPLE_FLASHCARDS
    )

    headers, user = register_user(client, email="flashcards@example.com")
    material = seed_material_with_chunks(db_session, UUID(user["id"]))

    generate_response = client.post(
        "/flashcard-decks/generate",
        headers=headers,
        json={
            "title": "Data structures deck",
            "count": 2,
            "material_ids": [str(material.id)],
        },
    )
    assert generate_response.status_code == 201
    deck = generate_response.json()
    assert deck["title"] == "Data structures deck"
    assert len(deck["flashcards"]) == 2

    list_response = client.get("/flashcard-decks", headers=headers)
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()["items"]] == [deck["id"]]

    get_response = client.get(f"/flashcard-decks/{deck['id']}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["flashcards"][0]["front"] == "What is LIFO?"

    cards_response = client.get(f"/flashcard-decks/{deck['id']}/cards", headers=headers)
    assert cards_response.status_code == 200
    assert len(cards_response.json()) == 2

    delete_response = client.delete(f"/flashcard-decks/{deck['id']}", headers=headers)
    assert delete_response.status_code == 204
    assert client.get(f"/flashcard-decks/{deck['id']}", headers=headers).status_code == 404


def test_flashcard_deck_isolation_between_users(client: TestClient, db_session, monkeypatch) -> None:
    import app.routes.flashcards as flashcards_routes

    monkeypatch.setattr(
        flashcards_routes, "generate_flashcards", lambda *_args, **_kwargs: SAMPLE_FLASHCARDS[:1]
    )

    owner_headers, owner = register_user(client, email="deck-owner@example.com")
    other_headers, _other = register_user(client, email="deck-other@example.com")
    material = seed_material_with_chunks(db_session, UUID(owner["id"]))

    deck_id = client.post(
        "/flashcard-decks/generate",
        headers=owner_headers,
        json={"title": "Private deck", "count": 1, "material_ids": [str(material.id)]},
    ).json()["id"]

    assert client.get(f"/flashcard-decks/{deck_id}", headers=other_headers).status_code == 404
    assert client.delete(f"/flashcard-decks/{deck_id}", headers=other_headers).status_code == 404


def test_manual_flashcard_deck_create_update_and_populate(client: TestClient, db_session, monkeypatch) -> None:
    import app.routes.flashcards as flashcards_routes

    monkeypatch.setattr(
        flashcards_routes,
        "_retrieval_chunks",
        lambda *_args, **_kwargs: [{"id": "c1", "text": "Chunk text", "material_title": "Material 1"}],
    )
    monkeypatch.setattr(
        flashcards_routes,
        "generate_flashcards",
        lambda *_args, count=1, **_kwargs: [
            {"front": f"Front {i + 1}", "back": f"Back {i + 1}", "topic": "Topic", "difficulty": "easy", "source_refs": []}
            for i in range(count)
        ],
    )

    headers, _user = register_user(client, email="manual-deck@example.com")

    create_response = client.post(
        "/flashcard-decks",
        headers=headers,
        json={
            "title": "Manual deck",
            "cards": [
                {"front": "What is LIFO?", "back": "Last in, first out.", "topic": "Stacks", "difficulty": "easy"},
                {"front": "What is FIFO?", "back": "First in, first out.", "topic": "Queues", "difficulty": "easy"},
            ],
        },
    )
    assert create_response.status_code == 201
    deck_id = create_response.json()["id"]
    assert len(create_response.json()["flashcards"]) == 2

    update_response = client.put(
        f"/flashcard-decks/{deck_id}",
        headers=headers,
        json={
            "title": "Updated deck",
            "cards": [{"front": "New front", "back": "New back", "topic": "Topic", "difficulty": "easy"}],
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Updated deck"
    assert len(update_response.json()["flashcards"]) == 1

    material = seed_material_with_chunks(db_session, UUID(_user["id"]))
    populate_response = client.post(
        f"/flashcard-decks/{deck_id}/populate",
        headers=headers,
        json={"material_ids": [str(material.id)], "count": 2},
    )
    assert populate_response.status_code == 201
    assert len(populate_response.json()["flashcards"]) == 2
