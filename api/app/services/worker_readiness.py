"""Safe runtime diagnostics for API vs worker generation parity."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.jobs import redis_available
from app.services.llm import is_llm_configured, resolve_model
from app.services.llm_providers import configured_providers, resolve_default_platform

logger = logging.getLogger(__name__)

WORKER_TASK_NAMES = (
    "process_quiz_generation",
    "process_flashcard_generation",
    "process_study_artifact_generation",
    "process_parse",
    "process_chunk",
    "process_embed",
    "process_generation_profiles",
)


def _platform_key_present() -> bool:
    return bool(configured_providers())


def generation_runtime_snapshot(*, process_label: str = "api") -> dict[str, Any]:
    """Return non-secret facts about the current process generation runtime."""
    default_provider, default_model = resolve_default_platform(catalogs=[])
    provider = default_provider or (configured_providers()[0] if configured_providers() else "none")
    return {
        "process": process_label,
        "app_version": settings.app_version,
        "provider": provider,
        "default_model": default_model or resolve_model(None),
        "platform_key_configured": _platform_key_present(),
        "llm_configured": is_llm_configured(),
        "redis_available": redis_available(),
        "job_queue_enabled": settings.enable_job_queue,
        "registered_tasks": list(WORKER_TASK_NAMES),
    }


def database_reachable(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def worker_ready_for_generation(db: Session) -> bool:
    """True when queue infrastructure and model runtime are usable in this deployment."""
    if not settings.enable_job_queue or not redis_available():
        return False
    if not is_llm_configured():
        return False
    if not database_reachable(db):
        return False
    return True


def log_generation_runtime(process_label: str = "api") -> None:
    snapshot = generation_runtime_snapshot(process_label=process_label)
    logger.info(
        "generation_runtime process=%s provider=%s model=%s llm=%s redis=%s",
        snapshot["process"],
        snapshot["provider"],
        snapshot["default_model"],
        snapshot["llm_configured"],
        snapshot["redis_available"],
    )
