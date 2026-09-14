from __future__ import annotations

import re
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models import (
    Flashcard,
    FlashcardDeck,
    GenerationProfile,
    Material,
    MaterialChunk,
    MaterialInsight,
    Question,
    Quiz,
    User,
)
from app.schemas.generation_profiles import (
    GenerationProfileCreateRequest,
    GenerationProfileResponse,
    GenerationProfileUpdateRequest,
    MaterialInsightResponse,
    ModelTaskType,
)
from app.schemas.settings import ModelDefaultsRequest, ModelDefaultsResponse
from app.services.generation import generate_flashcards, generate_questions
from app.services.llm import is_llm_configured, llm_text, resolve_model


class GenerationProfileNotFoundError(Exception):
    pass


class MaterialNotProcessableError(Exception):
    pass


def _clean_model(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def provision_model(db: Session, user_id: uuid.UUID, task_type: ModelTaskType) -> str | None:
    user = db.get(User, user_id)
    if user is None:
        return None
    if task_type == "embedding":
        return _clean_model(user.default_embedding_model) or settings.embedding_model
    if task_type == "generation":
        return (
            _clean_model(user.default_generation_model)
            or _clean_model(user.default_chat_model)
            or (resolve_model(None) if is_llm_configured() else None)
        )
    return _clean_model(user.default_chat_model) or (
        resolve_model(None) if is_llm_configured() else None
    )


def get_model_defaults(user: User) -> ModelDefaultsResponse:
    return ModelDefaultsResponse(
        default_chat_model=user.default_chat_model,
        default_generation_model=user.default_generation_model,
        default_embedding_model=user.default_embedding_model,
    )


def update_model_defaults(
    db: Session, user: User, request: ModelDefaultsRequest
) -> ModelDefaultsResponse:
    user.default_chat_model = _clean_model(request.default_chat_model)
    user.default_generation_model = _clean_model(request.default_generation_model)
    user.default_embedding_model = _clean_model(request.default_embedding_model)
    db.add(user)
    db.flush()
    return get_model_defaults(user)


def list_profiles(db: Session, user_id: uuid.UUID) -> list[GenerationProfileResponse]:
    profiles = db.scalars(
        select(GenerationProfile)
        .where(GenerationProfile.user_id == user_id)
        .order_by(GenerationProfile.created_at.desc())
    ).all()
    return [_profile_response(profile) for profile in profiles]


def create_profile(
    db: Session, user: User, request: GenerationProfileCreateRequest
) -> GenerationProfileResponse:
    profile = GenerationProfile(
        user_id=user.id,
        name=request.name.strip(),
        prompt_template=request.prompt_template.strip(),
        apply_on_upload=request.apply_on_upload,
        output_type=request.output_type,
        profile_metadata=request.metadata,
    )
    db.add(profile)
    db.flush()
    return _profile_response(profile)


def get_profile(
    db: Session, user_id: uuid.UUID, profile_id: uuid.UUID
) -> GenerationProfileResponse:
    return _profile_response(_owned_profile(db, user_id, profile_id))


def update_profile(
    db: Session,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    request: GenerationProfileUpdateRequest,
) -> GenerationProfileResponse:
    profile = _owned_profile(db, user_id, profile_id)
    update = request.model_dump(exclude_unset=True)
    if "name" in update and update["name"] is not None:
        profile.name = str(update["name"]).strip()
    if "prompt_template" in update and update["prompt_template"] is not None:
        profile.prompt_template = str(update["prompt_template"]).strip()
    if "apply_on_upload" in update:
        profile.apply_on_upload = bool(update["apply_on_upload"])
    if "output_type" in update and update["output_type"] is not None:
        profile.output_type = str(update["output_type"])
    if "metadata" in update:
        profile.profile_metadata = update["metadata"]
    db.add(profile)
    db.flush()
    return _profile_response(profile)


def delete_profile(db: Session, user_id: uuid.UUID, profile_id: uuid.UUID) -> None:
    profile = _owned_profile(db, user_id, profile_id)
    db.delete(profile)
    db.flush()


def list_material_insights(
    db: Session,
    user_id: uuid.UUID,
    material_id: uuid.UUID | None = None,
) -> list[MaterialInsightResponse]:
    query = select(MaterialInsight).where(MaterialInsight.user_id == user_id)
    if material_id is not None:
        query = query.where(MaterialInsight.material_id == material_id)
    insights = db.scalars(query.order_by(MaterialInsight.created_at.desc())).all()
    return [_insight_response(insight) for insight in insights]


def apply_upload_profiles(db: Session, material: Material) -> dict[str, list[str]]:
    if material.status != "processed":
        return {"quiz_ids": [], "deck_ids": [], "insight_ids": []}
    profiles = db.scalars(
        select(GenerationProfile).where(
            GenerationProfile.user_id == material.user_id,
            GenerationProfile.apply_on_upload.is_(True),
        )
    ).all()
    if not profiles:
        return {"quiz_ids": [], "deck_ids": [], "insight_ids": []}

    chunks = _material_chunks(db, material)
    if not chunks:
        raise MaterialNotProcessableError("Processed material has no chunks to generate from.")

    created = {"quiz_ids": [], "deck_ids": [], "insight_ids": []}
    model = provision_model(db, material.user_id, "generation")
    for profile in profiles:
        if profile.output_type == "summary":
            insight = _create_summary(db, material, profile, chunks, model=model)
            if insight is not None:
                created["insight_ids"].append(str(insight.id))
        elif profile.output_type == "quiz":
            quiz = _create_quiz(db, material, profile, chunks, model=model)
            if quiz is not None:
                created["quiz_ids"].append(str(quiz.id))
        elif profile.output_type == "flashcards":
            deck = _create_flashcard_deck(db, material, profile, chunks, model=model)
            if deck is not None:
                created["deck_ids"].append(str(deck.id))
    db.flush()
    return created


def _create_summary(
    db: Session,
    material: Material,
    profile: GenerationProfile,
    chunks: list[dict[str, Any]],
    *,
    model: str | None,
) -> MaterialInsight | None:
    existing = db.scalar(
        select(MaterialInsight).where(
            MaterialInsight.material_id == material.id,
            MaterialInsight.generation_profile_id == profile.id,
            MaterialInsight.insight_type == "summary",
        )
    )
    if existing is not None:
        return None

    prompt = _render_prompt(profile, material, chunks)
    body = None
    if is_llm_configured():
        try:
            body = llm_text(
                "Summarize course material for exam prep. Be concise and grounded in the provided notes.",
                prompt,
                model=model,
            )
        except Exception:
            body = None
    if not body:
        body = _fallback_summary(chunks)

    insight = MaterialInsight(
        material_id=material.id,
        user_id=material.user_id,
        generation_profile_id=profile.id,
        insight_type="summary",
        title=f"{profile.name}: {material.title}",
        body=body,
        insight_metadata={"profile_name": profile.name, "model": model},
    )
    db.add(insight)
    db.flush()
    return insight


def _create_quiz(
    db: Session,
    material: Material,
    profile: GenerationProfile,
    chunks: list[dict[str, Any]],
    *,
    model: str | None,
) -> Quiz | None:
    existing = db.scalar(
        select(Quiz).where(
            Quiz.material_id == material.id,
            Quiz.generation_profile_id == profile.id,
        )
    )
    if existing is not None:
        return None

    count = _profile_int(profile, "count", 8)
    question_types = _profile_list(profile, "question_types", ["mcq"])
    generated = generate_questions(
        chunks,
        count=count,
        question_types=question_types,
        difficulty=str((profile.profile_metadata or {}).get("difficulty") or "medium"),
        topic_label=material.title,
        model=model,
    )
    if not generated:
        return None

    quiz = Quiz(
        user_id=material.user_id,
        course_id=material.course_id,
        material_id=material.id,
        generation_profile_id=profile.id,
        title=f"{profile.name}: {material.title}",
        config={
            "source": "generation_profile",
            "profile_id": str(profile.id),
            "material_id": str(material.id),
            "prompt_template": profile.prompt_template,
            "model": model,
            "count": count,
            "question_types": question_types,
        },
        status="ready",
    )
    db.add(quiz)
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
    db.flush()
    return db.scalar(select(Quiz).options(selectinload(Quiz.questions)).where(Quiz.id == quiz.id)) or quiz


def _create_flashcard_deck(
    db: Session,
    material: Material,
    profile: GenerationProfile,
    chunks: list[dict[str, Any]],
    *,
    model: str | None,
) -> FlashcardDeck | None:
    existing = db.scalar(
        select(FlashcardDeck).where(
            FlashcardDeck.material_id == material.id,
            FlashcardDeck.generation_profile_id == profile.id,
        )
    )
    if existing is not None:
        return None

    count = _profile_int(profile, "count", 12)
    generated = generate_flashcards(chunks, count=count, topic_label=material.title, model=model)
    if not generated:
        return None

    deck = FlashcardDeck(
        user_id=material.user_id,
        course_id=material.course_id,
        material_id=material.id,
        generation_profile_id=profile.id,
        title=f"{profile.name}: {material.title}",
    )
    db.add(deck)
    db.flush()
    for card in generated:
        db.add(
            Flashcard(
                deck_id=deck.id,
                front=card["front"],
                back=card["back"],
                topic=card.get("topic"),
                difficulty=card.get("difficulty"),
                source_refs=card.get("source_refs") or [],
            )
        )
    db.flush()
    return (
        db.scalar(
            select(FlashcardDeck)
            .options(selectinload(FlashcardDeck.flashcards))
            .where(FlashcardDeck.id == deck.id)
        )
        or deck
    )


def _render_prompt(
    profile: GenerationProfile,
    material: Material,
    chunks: list[dict[str, Any]],
) -> str:
    context = "\n\n".join(chunk["text"][:1200] for chunk in chunks[:8])
    values = {
        "material_title": material.title,
        "file_name": material.file_name,
        "context": context,
    }
    try:
        return profile.prompt_template.format(**values)
    except (KeyError, ValueError):
        return f"{profile.prompt_template}\n\nMaterial:\n{context}"


def _fallback_summary(chunks: list[dict[str, Any]]) -> str:
    text = " ".join(chunk["text"] for chunk in chunks[:4])
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]
    selected = sentences[:5] or [text[:900].strip()]
    return "\n".join(f"- {sentence[:280].strip()}" for sentence in selected if sentence.strip())


def _material_chunks(db: Session, material: Material) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(MaterialChunk)
        .where(MaterialChunk.material_id == material.id)
        .order_by(MaterialChunk.chunk_index.asc())
    ).all()
    return [
        {
            "id": chunk.id,
            "text": chunk.text,
            "material_title": material.title,
        }
        for chunk in rows
    ]


def _profile_int(profile: GenerationProfile, key: str, default: int) -> int:
    value = (profile.profile_metadata or {}).get(key)
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(1, min(parsed, 50))


def _profile_list(profile: GenerationProfile, key: str, default: list[str]) -> list[str]:
    value = (profile.profile_metadata or {}).get(key)
    if not isinstance(value, list):
        return default
    items = [str(item).strip() for item in value if str(item).strip()]
    return items or default


def _owned_profile(db: Session, user_id: uuid.UUID, profile_id: uuid.UUID) -> GenerationProfile:
    profile = db.scalar(
        select(GenerationProfile).where(
            GenerationProfile.id == profile_id,
            GenerationProfile.user_id == user_id,
        )
    )
    if profile is None:
        raise GenerationProfileNotFoundError(f"Generation profile {profile_id} was not found.")
    return profile


def _profile_response(profile: GenerationProfile) -> GenerationProfileResponse:
    return GenerationProfileResponse(
        id=profile.id,
        name=profile.name,
        prompt_template=profile.prompt_template,
        apply_on_upload=profile.apply_on_upload,
        output_type=profile.output_type,  # type: ignore[arg-type]
        metadata=profile.profile_metadata,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


def _insight_response(insight: MaterialInsight) -> MaterialInsightResponse:
    return MaterialInsightResponse(
        id=insight.id,
        material_id=insight.material_id,
        generation_profile_id=insight.generation_profile_id,
        insight_type=insight.insight_type,
        title=insight.title,
        body=insight.body,
        metadata=insight.insight_metadata,
        created_at=insight.created_at,
        updated_at=insight.updated_at,
    )
