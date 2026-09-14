from __future__ import annotations

from uuid import UUID
import json

from fastapi.testclient import TestClient

from app.models import Material, MaterialChunk, MediaAttachment
from app.services.embedding import fallback_embedding
from conftest import register_user


def _ndjson(response: TestClient) -> list[dict]:
    return [json.loads(line) for line in response.text.splitlines() if line.strip()]


def _seed_material(db_session, user_id: UUID, title: str, chunks: list[str]) -> Material:
    material = Material(
        user_id=user_id,
        title=title,
        file_name=f"{title.lower().replace(' ', '-')}.txt",
        file_type="text/plain",
        storage_path="/tmp/search.txt",
        status="processed",
    )
    db_session.add(material)
    db_session.flush()
    for index, text in enumerate(chunks):
        db_session.add(
            MaterialChunk(
                material_id=material.id,
                chunk_index=index,
                text=text,
                token_count=max(1, len(text) // 4),
                embedding=fallback_embedding(text),
            )
        )
    db_session.commit()
    db_session.refresh(material)
    return material


def _seed_chat_media(db_session, user_id: UUID, filename: str, content: str) -> MediaAttachment:
    media = MediaAttachment(
        user_id=user_id,
        storage_provider="local",
        storage_key=f"media/{filename}",
        media_url=f"https://example.test/{filename}",
        filename=filename,
        file_type="pdf",
        file_size=len(content),
        parsed_content=content,
        chunk_count=max(1, len(content) // 400),
        parsing_method="test",
    )
    db_session.add(media)
    db_session.commit()
    db_session.refresh(media)
    return media


def test_search_returns_scoped_material_results(client: TestClient, db_session) -> None:
    headers, user = register_user(client, email="searcher@example.com")
    other_headers, other_user = register_user(client, email="other-searcher@example.com")
    _ = other_headers
    _seed_material(
        db_session,
        UUID(user["id"]),
        "Biology",
        ["Photosynthesis uses chlorophyll to convert sunlight into chemical energy."],
    )
    _seed_material(
        db_session,
        UUID(other_user["id"]),
        "Private Physics",
        ["Chlorophyll is mentioned here but belongs to another user."],
    )

    response = client.post("/search", headers=headers, json={"query": "chlorophyll", "limit": 5})

    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "chlorophyll"
    assert len(body["results"]) == 1
    assert body["results"][0]["material_title"] == "Biology"
    assert "another user" not in body["results"][0]["excerpt"]


def test_search_returns_empty_for_irrelevant_query(client: TestClient, db_session) -> None:
    headers, user = register_user(client, email="irrelevant-search@example.com")
    _seed_material(
        db_session,
        UUID(user["id"]),
        "Biology",
        ["Photosynthesis uses chlorophyll to convert sunlight into chemical energy."],
    )

    response = client.post(
        "/search",
        headers=headers,
        json={"query": "quantum entanglement black holes", "limit": 5},
    )

    assert response.status_code == 200
    assert response.json()["results"] == []


def test_search_can_filter_to_material_ids(client: TestClient, db_session) -> None:
    headers, user = register_user(client, email="filtered-search@example.com")
    first = _seed_material(
        db_session,
        UUID(user["id"]),
        "Cell Notes",
        ["Mitochondria release stored energy from glucose."],
    )
    second = _seed_material(
        db_session,
        UUID(user["id"]),
        "Plant Notes",
        ["Photosynthesis depends on chlorophyll in plant cells."],
    )
    _ = first

    response = client.post(
        "/search",
        headers=headers,
        json={"query": "energy chlorophyll", "material_ids": [str(second.id)], "limit": 5},
    )

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert results[0]["material_title"] == "Plant Notes"


def test_search_includes_chat_media_attachments(client: TestClient, db_session) -> None:
    headers, user = register_user(client, email="chat-media-search@example.com")
    _seed_chat_media(
        db_session,
        UUID(user["id"]),
        "19-Graphs.pdf",
        (
            "Graphs are collections of vertices connected by edges. "
            "Adjacency lists and adjacency matrices represent graph structure for traversal."
        ),
    )

    response = client.post(
        "/search",
        headers=headers,
        json={"query": "adjacency vertices graphs", "limit": 5},
    )

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) >= 1
    assert any("graph" in result["material_title"].lower() for result in results)
    assert any(result["source"] == "chat" for result in results)


def test_ask_limits_plan_and_returns_citations(client: TestClient, db_session, monkeypatch) -> None:
    headers, user = register_user(client, email="ask-search@example.com")
    _seed_material(
        db_session,
        UUID(user["id"]),
        "Respiration",
        [
            "Cellular respiration uses glucose and oxygen to produce ATP.",
            "Glycolysis begins glucose breakdown before the Krebs cycle.",
        ],
    )

    monkeypatch.setattr(
        "app.services.search.llm_json",
        lambda *args, **kwargs: {
            "queries": ["ATP respiration", "glucose glycolysis", "oxygen Krebs", "extra ignored"]
        },
    )
    monkeypatch.setattr(
        "app.services.search.llm_text",
        lambda *args, **kwargs: "Cellular respiration produces ATP from glucose and oxygen [1].",
    )

    response = client.post(
        "/search/ask",
        headers=headers,
        json={"query": "How does respiration make ATP?", "limit": 4, "max_subqueries": 3},
    )

    assert response.status_code == 200
    events = _ndjson(response)
    assert [event["type"] for event in events] == ["retrieval_plan", "answer", "citations", "done"]
    assert len(events[0]["plan"]) == 3
    assert events[1]["answer"].endswith("[1].")
    assert events[2]["citations"]
    assert events[2]["citations"][0]["material_title"] == "Respiration"
    assert events[1]["used_fallback"] is False


def test_ask_uses_extract_fallback_without_llm(client: TestClient, db_session, monkeypatch) -> None:
    headers, user = register_user(client, email="ask-fallback@example.com")
    _seed_material(
        db_session,
        UUID(user["id"]),
        "Vectors",
        ["Velocity and acceleration are vector quantities with magnitude and direction."],
    )
    monkeypatch.setattr("app.services.search.llm_json", lambda *args, **kwargs: None)
    monkeypatch.setattr("app.services.search.llm_text", lambda *args, **kwargs: None)

    response = client.post(
        "/search/ask",
        headers=headers,
        json={"query": "velocity acceleration", "limit": 3, "max_subqueries": 3},
    )

    assert response.status_code == 200
    events = _ndjson(response)
    assert 1 <= len(events[0]["plan"]) <= 3
    assert events[1]["used_fallback"] is True
    assert "Vectors" in events[1]["answer"]
