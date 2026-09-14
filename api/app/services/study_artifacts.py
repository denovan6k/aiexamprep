"""Central dispatcher for study artifact generation."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import ChatMessage, ChatThread, GenerationJob, StudyArtifact, User
from app.core.config import settings
from app.models.entities import utc_now
from app.schemas.artifact_intent import ArtifactIntentResult, GenerationStage
from app.services.generation import build_quiz_corpus, rank_chunks_by_query
from app.services.llm import (
    LlmOverride,
    clear_llm_degradation,
    get_llm_degradation,
    llm_json,
    model_supports_vision,
    resolve_image_understanding_model,
)

logger = logging.getLogger(__name__)

STAGE_LABELS: dict[str, str] = {
    "understanding": "Understanding request",
    "reading_material": "Reading material",
    "generating": "Generating",
    "persisting": "Saving results",
}

TEXT_ARTIFACT_TYPES = frozenset({"summary", "study_guide", "notes"})

MIND_MAP_SCHEMA_VERSION = 2

DEFAULT_MIND_MAP_SETTINGS: dict[str, Any] = {
    "layout": "balanced",
    "levelSpacing": 80,
    "nodeRadius": 14,
}

_ARTIFACT_PROMPTS: dict[str, str] = {
    "summary": (
        "You create concise exam-prep summaries grounded in provided material. "
        'Return JSON: {"title": str, "sections": [{"heading": str, "body": str}]}'
    ),
    "study_guide": (
        "You create structured study guides grounded in provided material. "
        'Return JSON: {"title": str, "sections": [{"heading": str, "key_points": [str], "body": str}]}'
    ),
    "notes": (
        "You create structured study notes grounded in provided material. "
        'Return JSON: {"title": str, "notes": [{"heading": str, "bullets": [str]}]}'
    ),
    "mind_map": (
        "You create fact-rich mind maps grounded in provided material. "
        "Return JSON with keys title and markdown only. "
        "The markdown must use heading levels (# title, ## branches, ### sub-branches) "
        "and optional bullet lists for deeper detail. "
        "Include concrete facts, not generic category labels. "
        "Avoid sections named Overview, Introduction, or Conclusion. "
        "Aim for 2-3 levels of depth with at least 3 top-level branches. "
        'Example: {"title": "Photosynthesis", "markdown": "# Photosynthesis\\n\\n## Light reactions\\n- Thylakoid membranes\\n## Calvin cycle\\n- RuBisCO fixation"}'
    ),
}


def stage_label(stage: GenerationStage | str) -> str:
    return STAGE_LABELS.get(str(stage), "Working")


def set_job_progress(db: Session, job: GenerationJob | None, stage: GenerationStage) -> None:
    if job is None:
        return
    payload = dict(job.payload or {})
    payload["progress_stage"] = stage
    job.payload = payload
    db.add(job)
    db.flush()


def persist_study_artifact(
    db: Session,
    *,
    user_id: uuid.UUID,
    thread_id: uuid.UUID | None,
    message_id: uuid.UUID | None,
    material_id: uuid.UUID | None,
    artifact_type: str,
    title: str,
    content: dict[str, Any],
) -> StudyArtifact:
    schema_version = MIND_MAP_SCHEMA_VERSION if artifact_type == "mind_map" else 1
    normalized_content = content
    if artifact_type == "mind_map":
        normalized_content = normalize_mind_map_content(content, schema_version=1)
    artifact = StudyArtifact(
        user_id=user_id,
        thread_id=thread_id,
        message_id=message_id,
        material_id=material_id,
        artifact_type=artifact_type,
        title=title,
        content=normalized_content,
        schema_version=schema_version,
    )
    db.add(artifact)
    db.flush()
    return artifact


def resolve_artifact_vision_model(model: str | None) -> str:
    if model and model_supports_vision(model):
        return model
    return resolve_image_understanding_model()


def _topic_corpus(chunks: list[dict[str, Any]], topic: str | None) -> str:
    if not chunks:
        return f"General educational topic: {topic or 'study material'}"
    return build_quiz_corpus(chunks)


def _tree_node_label(node: dict[str, Any]) -> str:
    return str(node.get("label") or node.get("content") or "").strip()


def _tree_node_children(node: dict[str, Any]) -> list[dict[str, Any]]:
    children = node.get("children")
    if not isinstance(children, list):
        return []
    return [child for child in children if isinstance(child, dict)]


def mind_map_tree_to_markdown(title: str, root: dict[str, Any]) -> str:
    lines: list[str] = []
    root_label = _tree_node_label(root) or title
    lines.append(f"# {root_label}")

    def walk(node: dict[str, Any], depth: int) -> None:
        for child in _tree_node_children(node):
            label = _tree_node_label(child)
            if not label:
                continue
            if depth == 0:
                lines.append(f"\n## {label}")
            elif depth == 1:
                lines.append(f"\n### {label}")
            else:
                lines.append(f"- {label}")
            walk(child, depth + 1)

    walk(root, 0)
    return "\n".join(lines).strip()


def normalize_mind_map_content(content: dict[str, Any], schema_version: int = 2) -> dict[str, Any]:
    title = str(content.get("title") or "").strip()
    markdown = str(content.get("markdown") or "").strip()
    settings = content.get("settings")
    if not isinstance(settings, dict):
        settings = dict(DEFAULT_MIND_MAP_SETTINGS)
    else:
        settings = {**DEFAULT_MIND_MAP_SETTINGS, **settings}

    root = content.get("root")
    if not markdown and isinstance(root, dict):
        markdown = mind_map_tree_to_markdown(title, root)
        if not title:
            title = _tree_node_label(root)

    if not markdown:
        fallback_title = title or "Mind map"
        markdown = f"# {fallback_title}"

    if not title:
        for line in markdown.splitlines():
            stripped = line.strip()
            if stripped.startswith("# "):
                title = stripped[2:].strip()
                break
        title = title or "Mind map"

    return {
        "title": title,
        "markdown": markdown,
        "settings": settings,
    }


def _normalize_mind_map_generation_result(result: dict[str, Any]) -> dict[str, Any]:
    return normalize_mind_map_content(result, schema_version=1)


def _offline_fallback(artifact_type: str, topic_label: str, corpus: str) -> dict[str, Any]:
    title = f"{topic_label} — {artifact_type.replace('_', ' ').title()}"
    if artifact_type == "notes":
        return {
            "title": title,
            "notes": [{"heading": "Overview", "bullets": [corpus[:800]]}],
        }
    if artifact_type == "mind_map":
        snippet = corpus[:200] or "Study topic"
        return normalize_mind_map_content(
            {
                "title": topic_label,
                "markdown": f"# {topic_label}\n\n## Key ideas\n- {snippet}",
            }
        )
    return {
        "title": title,
        "sections": [{"heading": "Overview", "body": corpus[:1200]}],
    }


def generate_structured_artifact(
    *,
    artifact_type: str,
    chunks: list[dict[str, Any]],
    topic_focus: str | None,
    topic_label: str,
    model: str | None = None,
    provider: str | None = None,
    override: LlmOverride | None = None,
    image_urls: list[str] | None = None,
) -> dict[str, Any] | None:
    system = _ARTIFACT_PROMPTS.get(artifact_type)
    if not system:
        return None
    corpus = _topic_corpus(chunks, topic_focus)
    clear_llm_degradation()

    vision_model = resolve_artifact_vision_model(model) if image_urls else model
    user_parts = [
        f"Topic: {topic_label}",
        f"Focus: {topic_focus or topic_label}",
    ]
    if image_urls:
        user_parts.append(
            "Use the attached image(s) as the primary source. Extract all study-relevant content."
        )
    if corpus.strip():
        user_parts.extend(["", f"Material:\n{corpus}"])
    user_parts.extend(["", f"Produce a {artifact_type.replace('_', ' ')}."])
    user = "\n".join(user_parts)

    result = llm_json(
        system,
        user,
        model=vision_model,
        provider=provider,
        override=override,
        read_timeout_seconds=settings.study_generation_read_timeout_seconds,
        image_urls=image_urls or None,
    )
    if result and isinstance(result, dict):
        if artifact_type == "mind_map":
            return _normalize_mind_map_generation_result(result)
        return result
    if get_llm_degradation() is not None:
        return None
    return _offline_fallback(artifact_type, topic_label, corpus)


def artifact_to_markdown(artifact_type: str, content: dict[str, Any]) -> str:
    title = str(content.get("title") or "").strip()
    parts: list[str] = [f"# {title}"] if title else []

    if artifact_type == "notes":
        for note in content.get("notes") or []:
            if not isinstance(note, dict):
                continue
            heading = str(note.get("heading") or "").strip()
            if heading:
                parts.append(f"\n## {heading}")
            for bullet in note.get("bullets") or []:
                text = str(bullet).strip()
                if text:
                    parts.append(f"- {text}")
        return "\n".join(parts).strip()

    if artifact_type == "mind_map":
        markdown = str(content.get("markdown") or "").strip()
        if markdown:
            return markdown
        root = content.get("root")
        if isinstance(root, dict):
            return mind_map_tree_to_markdown(title, root)
        return ""

    for section in content.get("sections") or []:
        if not isinstance(section, dict):
            continue
        heading = str(section.get("heading") or "").strip()
        if heading:
            parts.append(f"\n## {heading}")
        body = str(section.get("body") or "").strip()
        if body:
            parts.append(body)
        for point in section.get("key_points") or []:
            text = str(point).strip()
            if text:
                parts.append(f"- {text}")
    return "\n".join(parts).strip()


def artifact_message_content(
    artifact_type: str,
    content: dict[str, Any],
    *,
    topic_label: str,
) -> str:
    if artifact_type == "mind_map":
        title = str(content.get("title") or topic_label).strip()
        return f"Here's your mind map on **{title}**."
    markdown = artifact_to_markdown(artifact_type, content)
    if markdown:
        return markdown
    return f"Prepared your {artifact_type.replace('_', ' ')} on {topic_label}."


def artifact_preview_metadata(artifact: StudyArtifact) -> dict[str, Any]:
    content = dict(artifact.content or {})
    if artifact.artifact_type == "mind_map":
        content = normalize_mind_map_content(content, artifact.schema_version)
    return {
        "artifact_id": str(artifact.id),
        "artifact_type": artifact.artifact_type,
        "artifact_title": artifact.title,
        "artifact_preview": content,
    }


def artifact_choice_metadata(*, attachment_names: list[str]) -> dict[str, Any]:
    return {
        "event": "artifact_choice",
        "attachment_names": attachment_names,
        "choices": [
            {"id": "quiz", "label": "Quiz"},
            {"id": "flashcards", "label": "Flashcards"},
            {"id": "practice_exam", "label": "Practice exam"},
            {"id": "summary", "label": "Summary"},
            {"id": "study_guide", "label": "Study guide"},
            {"id": "notes", "label": "Structured notes"},
            {"id": "mind_map", "label": "Mind map"},
        ],
    }
