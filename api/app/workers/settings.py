"""Arq worker configuration — run with: arq app.workers.settings.WorkerSettings"""

from arq.connections import RedisSettings

from app.core.config import settings
from app.services.worker_readiness import log_generation_runtime
from app.workers.tasks import (
    process_flashcard_generation,
    process_generation_profiles,
    process_quiz_generation,
    process_study_artifact_generation,
    process_parse,
    process_chunk,
    process_embed,
)


async def on_startup(ctx: dict) -> None:
    log_generation_runtime("worker")


class WorkerSettings:
    on_startup = on_startup
    # Keep max_jobs aligned with settings.max_concurrent_global_jobs.
    functions = [
        process_quiz_generation,
        process_flashcard_generation,
        process_study_artifact_generation,
        process_parse,
        process_chunk,
        process_embed,
        process_generation_profiles,
    ]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = settings.max_concurrent_global_jobs
    job_timeout = 600
