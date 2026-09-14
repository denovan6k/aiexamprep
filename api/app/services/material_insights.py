"""Material insight generation for professor-agent prompts."""
from __future__ import annotations

import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Material, MaterialChunk, MaterialInsight


def ensure_material_insights(db: Session, material: Material) -> list[MaterialInsight]:
    if material.status != "processed":
        return []

    existing = db.scalars(
        select(MaterialInsight).where(
            MaterialInsight.material_id == material.id,
            MaterialInsight.generation_profile_id.is_(None),
            MaterialInsight.insight_type.in_(["key_concepts", "exam_topics"]),
        )
    ).all()
    if existing:
        return existing

    chunks = db.scalars(
        select(MaterialChunk)
        .where(MaterialChunk.material_id == material.id)
        .order_by(MaterialChunk.chunk_index.asc())
        .limit(8)
    ).all()
    text = " ".join(chunk.text for chunk in chunks)
    if not text.strip():
        return []

    concepts = _key_concepts(text)
    topics = _exam_topics(text, concepts)
    created: list[MaterialInsight] = []
    for insight_type, title, body, metadata in [
        (
            "key_concepts",
            f"Key concepts: {material.title}",
            "\n".join(f"- {item}" for item in concepts),
            {"concepts": concepts},
        ),
        (
            "exam_topics",
            f"Likely exam topics: {material.title}",
            "\n".join(f"- {item}" for item in topics),
            {"topics": topics},
        ),
    ]:
        insight = MaterialInsight(
            material_id=material.id,
            user_id=material.user_id,
            insight_type=insight_type,
            title=title,
            body=body,
            insight_metadata=metadata,
        )
        db.add(insight)
        created.append(insight)
    db.flush()
    return created


def insight_prompt_context(
    db: Session,
    user_id,
    material_ids: list,
    *,
    limit: int = 6,
) -> list[str]:
    if not material_ids:
        return []
    insights = db.scalars(
        select(MaterialInsight)
        .where(
            MaterialInsight.user_id == user_id,
            MaterialInsight.material_id.in_(material_ids),
            MaterialInsight.insight_type.in_(["key_concepts", "exam_topics", "summary"]),
        )
        .order_by(MaterialInsight.created_at.desc())
        .limit(limit)
    ).all()
    return [f"{insight.title}: {insight.body[:500]}" for insight in insights if insight.body]


def _key_concepts(text: str) -> list[str]:
    words = re.findall(r"\b[A-Za-z][A-Za-z\-]{4,}\b", text)
    counts: dict[str, int] = {}
    for word in words:
        normalized = word.strip("-").lower()
        if normalized in _STOPWORDS or normalized.endswith("ing"):
            continue
        counts[normalized] = counts.get(normalized, 0) + 1
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [word.title() for word, _count in ranked[:8]] or ["Core definitions", "Worked examples"]


def _exam_topics(text: str, concepts: list[str]) -> list[str]:
    sentences = [
        re.sub(r"\s+", " ", part).strip()
        for part in re.split(r"(?<=[.!?])\s+", text)
        if len(part.strip()) >= 45
    ]
    topics = [sentence[:180] for sentence in sentences[:5]]
    if topics:
        return topics
    return [f"Explain {concept}" for concept in concepts[:5]]


_STOPWORDS = {
    "about",
    "after",
    "before",
    "between",
    "could",
    "example",
    "following",
    "material",
    "notes",
    "should",
    "their",
    "there",
    "these",
    "those",
    "through",
    "using",
    "where",
    "which",
    "would",
}
