from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FlashcardDeck, GenerationJob, Material, MaterialChunk, MaterialInsight, Quiz, User
from app.schemas.generation_profiles import GenerationProfileCreateRequest
from app.services.generation_profiles import apply_upload_profiles, create_profile, provision_model
from app.services.material_insights import ensure_material_insights, insight_prompt_context
from app.services.materials import materials_service
from helpers import register_user, seed_material_with_chunks


def test_generation_profile_crud(client, auth_headers: dict[str, str]) -> None:
    create_response = client.post(
        "/generation-profiles",
        headers=auth_headers,
        json={
            "name": "Upload summary",
            "prompt_template": "Summarize {material_title} using {context}",
            "apply_on_upload": True,
            "output_type": "summary",
            "metadata": {"style": "bullets"},
        },
    )
    assert create_response.status_code == 201, create_response.text
    created = create_response.json()
    assert created["name"] == "Upload summary"
    assert created["apply_on_upload"] is True

    list_response = client.get("/generation-profiles", headers=auth_headers)
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [created["id"]]

    patch_response = client.patch(
        f"/generation-profiles/{created['id']}",
        headers=auth_headers,
        json={"name": "Focused summary", "apply_on_upload": False},
    )
    assert patch_response.status_code == 200, patch_response.text
    assert patch_response.json()["name"] == "Focused summary"
    assert patch_response.json()["apply_on_upload"] is False

    delete_response = client.delete(f"/generation-profiles/{created['id']}", headers=auth_headers)
    assert delete_response.status_code == 204
    assert client.get("/generation-profiles", headers=auth_headers).json() == []


def test_model_defaults_round_trip_and_provisioning(
    client,
    auth_headers: dict[str, str],
    db_session: Session,
) -> None:
    response = client.put(
        "/settings/model-defaults",
        headers=auth_headers,
        json={
            "default_chat_model": "gpt-4.1-mini",
            "default_generation_model": "gpt-4.1",
            "default_embedding_model": "text-embedding-3-large",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "default_chat_model": "gpt-4.1-mini",
        "default_generation_model": "gpt-4.1",
        "default_embedding_model": "text-embedding-3-large",
    }

    defaults = client.get("/settings/model-defaults", headers=auth_headers)
    assert defaults.status_code == 200
    assert defaults.json()["default_chat_model"] == "gpt-4.1-mini"

    user_id = UUID(client.get("/auth/me", headers=auth_headers).json()["id"])
    assert provision_model(db_session, user_id, "chat") == "gpt-4.1-mini"
    assert provision_model(db_session, user_id, "generation") == "gpt-4.1"
    assert provision_model(db_session, user_id, "embedding") == "text-embedding-3-large"


def test_apply_upload_profiles_creates_linked_artifacts(
    client,
    db_session: Session,
) -> None:
    _headers, user = register_user(client, email="profiles@example.com")
    user_id = UUID(user["id"])
    material = seed_material_with_chunks(
        db_session,
        user_id,
        text=(
            "Photosynthesis converts light energy into chemical energy in chloroplasts. "
            "Chlorophyll absorbs light and supports glucose production for plant cells. "
            "Cellular respiration releases stored energy from glucose through metabolic pathways."
        ),
    )
    material.status = "processed"
    user_record = db_session.get(User, user_id)
    assert user_record is not None

    for name, output_type, metadata in [
        ("Auto quiz", "quiz", {"count": 2, "question_types": ["short_answer"]}),
        ("Auto cards", "flashcards", {"count": 2}),
        ("Auto summary", "summary", None),
    ]:
        create_profile(
            db_session,
            user_record,
            GenerationProfileCreateRequest(
                name=name,
                prompt_template="Use {material_title}. Context: {context}",
                apply_on_upload=True,
                output_type=output_type,  # type: ignore[arg-type]
                metadata=metadata,
            ),
        )
    db_session.flush()

    result = apply_upload_profiles(db_session, material)
    db_session.commit()

    assert len(result["quiz_ids"]) == 1
    assert len(result["deck_ids"]) == 1
    assert len(result["insight_ids"]) == 1

    quiz = db_session.scalar(select(Quiz).where(Quiz.material_id == material.id))
    deck = db_session.scalar(select(FlashcardDeck).where(FlashcardDeck.material_id == material.id))
    insight = db_session.scalar(select(MaterialInsight).where(MaterialInsight.material_id == material.id))

    assert quiz is not None
    assert quiz.generation_profile_id is not None
    assert quiz.questions
    assert deck is not None
    assert deck.generation_profile_id is not None
    assert deck.flashcards
    assert insight is not None
    assert "Photosynthesis" in insight.body

    duplicate = apply_upload_profiles(db_session, material)
    assert duplicate == {"quiz_ids": [], "deck_ids": [], "insight_ids": []}


def test_process_embed_enqueues_generation_profile_job_when_chained(
    client,
    db_session: Session,
    monkeypatch,
    tmp_path,
) -> None:
    _headers, user = register_user(client, email="profile-queue@example.com")
    user_id = UUID(user["id"])
    user_record = db_session.get(User, user_id)
    assert user_record is not None
    create_profile(
        db_session,
        user_record,
        GenerationProfileCreateRequest(
            name="Auto summary",
            prompt_template="Summarize {material_title}. {context}",
            apply_on_upload=True,
            output_type="summary",
        ),
    )
    path = tmp_path / "notes.txt"
    path.write_text("Photosynthesis uses chlorophyll to convert sunlight.", encoding="utf-8")
    material = Material(
        user_id=user_id,
        title="Queued notes",
        file_name="notes.txt",
        file_type="text/plain",
        storage_path=str(path),
        status="chunked",
    )
    db_session.add(material)
    db_session.flush()
    db_session.add(
        MaterialChunk(
            material_id=material.id,
            chunk_index=0,
            text="Photosynthesis uses chlorophyll to convert sunlight.",
            token_count=10,
            embedding=None,
        )
    )
    db_session.flush()

    dispatched: list[str] = []
    monkeypatch.setattr("app.services.jobs.redis_available", lambda: True)
    monkeypatch.setattr(
        "app.services.jobs.jobs_service.dispatch_generation_profiles",
        lambda job_id: dispatched.append(str(job_id)),
    )

    materials_service._process_embed(db_session, material, enqueue_next=True)  # noqa: SLF001
    db_session.flush()

    job = db_session.scalar(
        select(GenerationJob).where(
            GenerationJob.material_id == material.id,
            GenerationJob.job_type == "generation_profiles",
        )
    )
    assert job is not None
    assert job.status == "queued"
    assert dispatched == [str(job.id)]
    assert db_session.scalar(select(MaterialInsight).where(MaterialInsight.material_id == material.id)) is None
    assert material.status == "processed"


def test_ensure_material_insights_creates_key_concepts_and_exam_topics(
    client,
    db_session: Session,
) -> None:
    _headers, user = register_user(client, email="insights@example.com")
    material = seed_material_with_chunks(
        db_session,
        UUID(user["id"]),
        text=(
            "Photosynthesis converts light energy into glucose using chlorophyll in chloroplasts. "
            "Students should compare photosynthesis with respiration and explain limiting factors."
        ),
    )
    material.status = "processed"

    insights = ensure_material_insights(db_session, material)
    db_session.commit()

    assert {insight.insight_type for insight in insights} == {"key_concepts", "exam_topics"}
    prompt_bits = insight_prompt_context(db_session, UUID(user["id"]), [material.id])
    assert any("Photosynthesis" in bit or "photosynthesis" in bit for bit in prompt_bits)
