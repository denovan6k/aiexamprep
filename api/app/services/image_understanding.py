"""Lazy vision-based text extraction for image media attachments."""
from __future__ import annotations

import logging
import mimetypes
from typing import Any, TYPE_CHECKING

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import MediaAttachment
from app.services.llm import (
    LlmOverride,
    is_llm_configured,
    llm_json,
    resolve_image_understanding_model,
)
from app.services.storage import get_media_storage

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_IMAGE_EXTENSIONS = frozenset({"jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"})
_MAX_STORED_CHARS = 8000

_VISION_EXTRACT_SYSTEM = (
    "You extract study-relevant text from images of notes, slides, textbooks, and whiteboards. "
    'Return ONLY valid JSON: {"text": str, "description": str, "has_study_content": bool}. '
    "Put readable notes in text. Put a brief visual summary in description when text is sparse."
)


def is_image_attachment(attachment: MediaAttachment) -> bool:
    content_type = mimetypes.guess_type(attachment.filename)[0] or ""
    if content_type.startswith("image/"):
        return True
    return attachment.file_type.lower().lstrip(".") in _IMAGE_EXTENSIONS


def _format_parsed_content(text: str, description: str | None) -> str:
    cleaned = (text or "").strip()
    summary = (description or "").strip()
    if cleaned and summary and summary.lower() not in cleaned.lower():
        combined = f"{cleaned}\n\n[Visual summary: {summary}]"
    else:
        combined = cleaned or summary
    return combined[:_MAX_STORED_CHARS].strip()


def attachment_access_url(attachment: MediaAttachment) -> str | None:
    """Return a fetchable URL for an attachment, refreshing from storage when possible."""
    storage_key = (attachment.storage_key or "").strip()
    if storage_key:
        try:
            storage = get_media_storage()
            provider_name = storage.get_capabilities().provider_name
            if (attachment.storage_provider or "").strip() == provider_name:
                url = storage.get_url(storage_key)
                if url:
                    return url
        except Exception:
            logger.warning(
                "attachment_access_url_refresh_failed attachment_id=%s",
                attachment.id,
                exc_info=True,
            )
    return (attachment.media_url or "").strip() or None


def ensure_image_text(
    db: Session,
    attachment: MediaAttachment,
    *,
    override: LlmOverride | None = None,
) -> str | None:
    """Extract and persist text for an image attachment. Fail-open; never raises."""
    if not is_image_attachment(attachment):
        return attachment.parsed_content
    if attachment.parsed_content and attachment.parsed_content.strip():
        return attachment.parsed_content
    if not attachment.media_url:
        return None
    if not is_llm_configured(override=None):
        return None

    image_url = attachment_access_url(attachment)
    if not image_url:
        return None

    # Vision extract always uses the platform vision model, not BYOK chat keys.
    _ = override
    try:
        parsed = llm_json(
            _VISION_EXTRACT_SYSTEM,
            "Extract all readable study text from this image.",
            model=resolve_image_understanding_model(),
            override=None,
            read_timeout_seconds=settings.image_understanding_read_timeout_seconds,
            image_urls=[image_url],
        )
    except Exception:
        logger.exception("image_vision_extract_failed attachment_id=%s", attachment.id)
        return None

    if not parsed or not isinstance(parsed, dict):
        return None

    text = str(parsed.get("text") or "").strip()
    description = str(parsed.get("description") or "").strip()
    has_study = parsed.get("has_study_content")
    if has_study is False and not text:
        return None

    combined = _format_parsed_content(text, description)
    if not combined:
        return None

    attachment.parsed_content = combined
    attachment.parsing_method = "vision"
    db.add(attachment)
    db.flush()
    return combined


def prepare_media_attachments_for_grounding(
    db: Session,
    attachments: list[MediaAttachment],
    *,
    override: LlmOverride | None = None,
) -> list[MediaAttachment]:
    """Run lazy vision extract on image attachments before chunking or chat context."""
    for attachment in attachments:
        if is_image_attachment(attachment):
            ensure_image_text(db, attachment, override=override)
    return attachments


def vision_image_urls(attachments: list[MediaAttachment]) -> list[str]:
    urls: list[str] = []
    for attachment in attachments:
        if not is_image_attachment(attachment):
            continue
        url = attachment_access_url(attachment)
        if url:
            urls.append(url)
    return urls


def has_only_unparsed_images(attachments: list[MediaAttachment]) -> bool:
    if not attachments:
        return False
    images = [item for item in attachments if is_image_attachment(item)]
    if not images:
        return False
    return all(not (item.parsed_content or "").strip() for item in images)


def unreadable_attachment_message(attachments: list[MediaAttachment]) -> str:
    if has_only_unparsed_images(attachments):
        return (
            "I couldn't read text from the photo you attached. Try a clearer, well-lit image, "
            "upload a PDF instead, or name a topic and I can build study material from that."
        )
    return (
        "I could not read usable text from the files you attached yet. "
        "Please wait for processing to finish, re-upload a clearer file, or attach a different document."
    )


def unreadable_attachment_clarify_message(
    attachments: list[MediaAttachment],
    *,
    artifact_label: str = "quiz",
    topic_focus: str | None = None,
) -> str:
    """Explain unreadable media and offer topic-only generation instead of a dead-end."""
    names = [item.filename for item in attachments if (item.filename or "").strip()]
    if has_only_unparsed_images(attachments):
        intro = (
            "I couldn't read text from the photo you attached, so I can't ground that "
            f"{artifact_label} in the image yet."
        )
    elif names:
        shown = ", ".join(f"**{name}**" for name in names[:3])
        if len(names) > 3:
            shown = f"{shown}, and {len(names) - 3} more"
        intro = (
            f"I couldn't read usable text from {shown}, so I can't ground that {artifact_label} "
            "in the file yet."
        )
    else:
        intro = (
            f"I couldn't read usable text from your attached file(s), so I can't ground that "
            f"{artifact_label} in the file yet."
        )
    if topic_focus and str(topic_focus).strip():
        topic = str(topic_focus).strip()
        return (
            f"{intro}\n\n"
            f"Want a general {artifact_label} on **{topic}** anyway? "
            "Reply **yes** to continue, name another topic, or re-upload a text-based PDF."
        )
    return (
        f"{intro}\n\n"
        f"Want a general {artifact_label} on a topic anyway? "
        f"Name a subject (for example `/{artifact_label.split()[0]} on [topic]`), "
        "or re-upload a text-based PDF."
    )


def pending_topic_only_metadata(
    *,
    artifact_type: str,
    topic_focus: str | None = None,
    attachment_names: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "event": "clarify",
        "reason": "unreadable_attachment",
        "attachment_names": attachment_names or [],
        "pending_topic_only": {
            "artifact_type": artifact_type,
            "topic_focus": topic_focus,
        },
    }
