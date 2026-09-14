from uuid import UUID, uuid4
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import select

from conftest import register_user
from app.core.config import settings
from app.models import GenerationJob, Material, MaterialChunk
from app.services.extraction import chunk_text
from app.services.embedding import embed_texts
from app.services.materials import materials_service

MATERIAL_UPLOAD_STATUSES = {
    "pending",
    "uploaded",
    "processing",
    "parsed",
    "chunked",
    "processed",
    "failed",
    "parse_failed",
}

def test_material_lifecycle(client: TestClient, db_session) -> None:
    headers, _user = register_user(client, email="materials-flow@example.com")

    create_response = client.post(
        "/materials",
        headers=headers,
        files={
            "file": (
                "lecture-notes.txt",
                (
                    b"Photosynthesis converts sunlight into chemical energy using chlorophyll. "
                    b"Cellular respiration releases stored energy from glucose."
                ),
                "text/plain",
            )
        },
    )

    assert create_response.status_code == 201
    created_material = create_response.json()
    assert created_material["id"]
    assert created_material["file_name"] == "lecture-notes.txt"
    assert created_material["status"] in MATERIAL_UPLOAD_STATUSES
    chunks = db_session.scalars(
        select(MaterialChunk).where(MaterialChunk.material_id == UUID(created_material["id"]))
    ).all()
    if created_material["status"] == "processed":
        assert chunks
        assert chunks[0].embedding

    list_response = client.get("/materials", headers=headers)

    assert list_response.status_code == 200
    list_body = list_response.json()
    assert "items" in list_body
    assert any(item["id"] == created_material["id"] for item in list_body["items"])
    assert list_body["total"] >= 1

    rename_response = client.patch(
        f"/materials/{created_material['id']}",
        headers=headers,
        json={"title": "Renamed lecture notes"},
    )
    assert rename_response.status_code == 200
    assert rename_response.json()["title"] == "Renamed lecture notes"

    filtered = client.get("/materials", headers=headers, params={"q": "Renamed", "limit": 12})
    assert filtered.status_code == 200
    assert any(item["id"] == created_material["id"] for item in filtered.json()["items"])

    get_response = client.get(f"/materials/{created_material['id']}", headers=headers)

    assert get_response.status_code == 200
    assert get_response.json()["id"] == created_material["id"]

    reprocess_response = client.post(
        f"/materials/{created_material['id']}/reprocess", headers=headers
    )

    assert reprocess_response.status_code == 200
    reprocess_body = reprocess_response.json()
    assert "message" in reprocess_body

    delete_response = client.delete(f"/materials/{created_material['id']}", headers=headers)

    assert delete_response.status_code == 204
    assert (
        client.get(f"/materials/{created_material['id']}", headers=headers).status_code == 404
    )


def test_material_status_endpoint(client: TestClient, db_session) -> None:
    headers, _user = register_user(client, email="materials-status@example.com")
    create_response = client.post(
        "/materials",
        headers=headers,
        files={
            "file": (
                "status-check.txt",
                b"Mitochondria generate ATP through oxidative phosphorylation.",
                "text/plain",
            )
        },
    )
    assert create_response.status_code == 201
    material_id = create_response.json()["id"]

    status_response = client.get(f"/materials/{material_id}/status", headers=headers)
    assert status_response.status_code == 200
    body = status_response.json()
    assert body["id"] == material_id
    assert body["status"] in MATERIAL_UPLOAD_STATUSES
    headers, _user = register_user(client, email="materials-404@example.com")
    material_id = uuid4()

    get_response = client.get(f"/materials/{material_id}", headers=headers)
    delete_response = client.delete(f"/materials/{material_id}", headers=headers)
    reprocess_response = client.post(f"/materials/{material_id}/reprocess", headers=headers)

    assert get_response.status_code == 404
    assert delete_response.status_code == 404
    assert reprocess_response.status_code == 404
    assert f"Material {material_id} was not found." in get_response.text


def test_material_upload_processes_inline_by_default(
    client: TestClient,
    db_session,
    monkeypatch,
) -> None:
    monkeypatch.setattr("app.services.jobs.redis_available", lambda: True)
    headers, _user = register_user(client, email="materials-inline-default@example.com")

    response = client.post(
        "/materials",
        headers=headers,
        files={
            "file": (
                "notes.txt",
                b"Photosynthesis depends on chlorophyll and light energy.",
                "text/plain",
            )
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "processed"
    assert body["chunk_count"] > 0
    job = db_session.scalar(
        select(GenerationJob).where(GenerationJob.material_id == UUID(body["id"]))
    )
    assert job is None


def test_material_upload_queues_async_processing_when_enabled(
    client: TestClient,
    db_session,
    monkeypatch,
) -> None:
    dispatched: list[str] = []
    monkeypatch.setattr("app.core.config.settings.queue_material_processing", True)
    monkeypatch.setattr("app.services.jobs.redis_available", lambda: True)
    monkeypatch.setattr(
        "app.services.jobs.jobs_service.dispatch_parse_job",
        lambda job_id: dispatched.append(str(job_id)),
    )
    headers, _user = register_user(client, email="materials-async@example.com")

    response = client.post(
        "/materials",
        headers=headers,
        files={
            "file": (
                "async-notes.txt",
                b"Photosynthesis depends on chlorophyll and light energy.",
                "text/plain",
            )
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    job = db_session.scalar(
        select(GenerationJob).where(GenerationJob.material_id == UUID(body["id"]))
    )
    assert job is not None
    assert job.job_type == "parse_job"
    assert job.payload["material_id"] == body["id"]
    assert dispatched == [str(job.id)]


def test_create_material_process_inline_marks_processed(db_session, monkeypatch) -> None:
    monkeypatch.setattr("app.services.jobs.redis_available", lambda: True)

    user_id = uuid4()
    upload = SimpleNamespace(
        filename="queues.txt",
        content_type="text/plain",
        file=SimpleNamespace(read=lambda: b"Queue uses FIFO ordering for breadth-first traversal."),
    )

    response = materials_service.create_material(
        db_session,
        user_id,
        upload,  # type: ignore[arg-type]
        None,
        "4-Queues",
        process_inline=True,
    )

    assert response.status == "processed"
    assert response.chunk_count > 0
    processing_job = db_session.scalar(
        select(GenerationJob).where(
            GenerationJob.material_id == response.id,
            GenerationJob.job_type == "parse_job",
        )
    )
    assert processing_job is None


def test_semantic_retrieval_prefers_topic_matching_chunk(db_session) -> None:
    user_id = uuid4()
    material = Material(
        user_id=user_id,
        title="Biology notes",
        file_name="biology.txt",
        file_type="text/plain",
        storage_path="biology.txt",
        status="processed",
    )
    db_session.add(material)
    db_session.flush()

    chunks = [
        "Mitochondria release energy from glucose during cellular respiration.",
        "Photosynthesis uses chlorophyll to convert sunlight into chemical energy.",
    ]
    from app.services.embedding import fallback_embedding

    for index, text in enumerate(chunks):
        db_session.add(
            MaterialChunk(
                material_id=material.id,
                chunk_index=index,
                text=text,
                token_count=12,
                embedding=fallback_embedding(text),
            )
        )
    db_session.commit()

    retrieved = materials_service.retrieve_chunks_semantic(
        db_session,
        user_id=user_id,
        query="chlorophyll photosynthesis",
        material_ids=[],
        limit=2,
        institution_id=None,
        course_id=None,
    )

    assert retrieved[0]["text"].startswith("Photosynthesis")
    assert "_embedding" not in retrieved[0]


def test_semantic_retrieval_falls_back_to_keyword_without_embeddings(db_session) -> None:
    user_id = uuid4()
    material = Material(
        user_id=user_id,
        title="Physics notes",
        file_name="physics.txt",
        file_type="text/plain",
        storage_path="physics.txt",
        status="processed",
    )
    db_session.add(material)
    db_session.flush()

    for index, text in enumerate(
        [
            "Entropy and thermodynamics describe disorder in systems.",
            "Vectors describe velocity, acceleration, and force in mechanics.",
        ]
    ):
        db_session.add(
            MaterialChunk(
                material_id=material.id,
                chunk_index=index,
                text=text,
                token_count=10,
                embedding=None,
            )
        )
    db_session.commit()

    retrieved = materials_service.retrieve_chunks_semantic(
        db_session,
        user_id=user_id,
        query="velocity force",
        material_ids=[],
        limit=2,
    )

    assert retrieved[0]["text"].startswith("Vectors")
    assert "_embedding" not in retrieved[0]


def test_chunk_text_merges_small_fragments_before_overlap() -> None:
    text = "\n\n".join(
        [
            "Short intro.",
            "Tiny aside.",
            "This paragraph has enough substance to anchor the chunk around a real exam topic "
            "with a little more detail.",
            "Small close.",
        ]
    )

    chunks = chunk_text(text, max_chars=110, overlap=0, min_chars=80)

    assert len(chunks) == 2
    assert "Short intro" in chunks[0]
    assert "Tiny aside" in chunks[0]
    assert chunks[-1] != "Small close."
    assert "Small close" in chunks[-1]


def test_embed_texts_batches_retries_and_mean_pools_without_network(monkeypatch) -> None:
    class FakeEmbeddings:
        def __init__(self) -> None:
            self.calls = 0

        def create(self, *, model, input, dimensions):  # noqa: ANN001
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("temporary provider error")
            data = [
                SimpleNamespace(index=index, embedding=[1.0, float(index + 1), 0.0, 0.0])
                for index, _text in enumerate(input)
            ]
            return SimpleNamespace(data=data)

    class FakeOpenAI:
        instance: "FakeOpenAI | None" = None

        def __init__(self, *, api_key: str) -> None:
            self.api_key = api_key
            self.embeddings = FakeEmbeddings()
            FakeOpenAI.instance = self

    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr("openai.OpenAI", FakeOpenAI)

    embeddings = embed_texts(
        ["alpha beta gamma. " * 80],
        batch_size=2,
        max_retries=1,
        max_input_chars=120,
    )

    assert len(embeddings) == 1
    assert len(embeddings[0]) == 4
    assert FakeOpenAI.instance is not None
    assert FakeOpenAI.instance.embeddings.calls > 1
