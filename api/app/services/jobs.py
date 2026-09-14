"""Redis-backed generation job queue with Arq workers.

Flow:
- Material upload runs parse/chunk/embed inline in the API by default
  (`QUEUE_MATERIAL_PROCESSING=false`). Opt in to Arq staging when workers share storage.
- Most quiz/flashcard requests run inline in the API process.
- When every worker slot is busy (global running jobs at capacity), new quiz requests
  are persisted as GenerationJob rows and processed by the Arq worker when a slot
  frees up.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import timedelta
from typing import Any
import threading

import redis
from arq import create_pool
from arq.connections import RedisSettings
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload, selectinload

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import (
    ChatMessage,
    ChatThread,
    Flashcard,
    FlashcardDeck,
    GenerationJob,
    Material,
    MediaAttachment,
    MaterialChunk,
    Question,
    Quiz,
    User,
)
from app.models.entities import utc_now
from app.schemas.jobs import JobResponse
from app.services.api_keys import decrypt_api_key, get_owned_api_key
from app.services.generation import generate_flashcards, generate_questions, rank_chunks_by_query
from app.services.llm import (
    LlmOverride,
    is_llm_configured,
    reset_llm_override,
    reset_platform_provider,
    set_llm_override,
    set_platform_provider,
)
from app.services.llm_providers import infer_provider_from_model, is_provider_configured
from app.services.materials import materials_service
from app.services.usage import enforce_limit, record_usage

logger = logging.getLogger(__name__)

ACTIVE_JOB_STATUSES = ("queued", "running")
GENERATION_JOB_TYPES = ("quiz_generation", "flashcard_generation", "study_artifact_generation")


def _resolve_topic_only_runtime_model(
    thread: ChatThread,
    override: LlmOverride | None,
    model: str | None,
) -> tuple[LlmOverride | None, str | None]:
    if thread.llm_source == "byok" and override is None:
        return None, None
    return override, model


def _bind_job_llm(
    payload: dict[str, Any],
    override: LlmOverride | None,
    *,
    model: str | None = None,
):
    override_token = set_llm_override(override)
    platform_token = None
    if override is None and (payload.get("llm_source") or "platform") == "platform":
        intent = payload.get("intent") or {}
        provider = (
            (intent.get("llm_provider") or payload.get("llm_provider") or "").strip().lower()
            or None
        )
        if not provider or not is_provider_configured(provider):
            provider = infer_provider_from_model(model or intent.get("model"))
        if provider and is_provider_configured(provider):
            platform_token = set_platform_provider(provider)
    return override_token, platform_token


def _unbind_job_llm(override_token: Any, platform_token: Any) -> None:
    reset_llm_override(override_token)
    if platform_token is not None:
        reset_platform_provider(platform_token)


class JobNotFoundError(Exception):
    pass


class JobConcurrencyLimitError(Exception):
    pass


def redis_available() -> bool:
    if not settings.enable_job_queue:
        return False
    try:
        client = redis.from_url(settings.redis_url, socket_connect_timeout=1)
        client.ping()
        return True
    except Exception:
        return False


def _enqueue_arq(function_name: str, job_id: str) -> None:
    async def _run() -> None:
        pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        try:
            await pool.enqueue_job(function_name, job_id)
        finally:
            await pool.close()

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(_run())
        return

    # If we're already inside an event loop (e.g. streaming request path),
    # run the enqueue coroutine in a dedicated thread with its own loop.
    error: list[Exception] = []

    def _runner() -> None:
        try:
            asyncio.run(_run())
        except Exception as exc:  # pragma: no cover - defensive bridge
            error.append(exc)

    thread = threading.Thread(target=_runner, daemon=True)
    thread.start()
    thread.join()
    if error:
        raise error[0]


def _running_generation_job_count(db: Session) -> int:
    return int(
        db.scalar(
            select(func.count(GenerationJob.id)).where(
                GenerationJob.status == "running",
                GenerationJob.job_type.in_(GENERATION_JOB_TYPES),
            )
        )
        or 0
    )


def _user_pending_generation_count(db: Session, user_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count(GenerationJob.id)).where(
                GenerationJob.user_id == user_id,
                GenerationJob.status.in_(ACTIVE_JOB_STATUSES),
                GenerationJob.job_type.in_(GENERATION_JOB_TYPES),
            )
        )
        or 0
    )


def _fail_abandoned_job(db: Session, job: GenerationJob, *, error_message: str, now) -> None:
    job.status = "failed"
    job.error_message = error_message
    job.completed_at = now
    db.add(job)
    if job.message_id is None:
        return
    message = db.scalar(select(ChatMessage).where(ChatMessage.id == job.message_id))
    if message is None:
        return
    message.content = error_message
    message.message_metadata = {
        "event": "generation_failed",
        "job_id": str(job.id),
    }
    db.add(message)


def expire_stale_generation_jobs(db: Session) -> int:
    """Mark abandoned worker jobs as failed so they do not block capacity checks."""
    now = utc_now()
    expired = 0

    running_cutoff = now - timedelta(minutes=settings.stale_running_job_minutes)
    for job in db.scalars(
        select(GenerationJob).where(
            GenerationJob.job_type.in_(GENERATION_JOB_TYPES),
            GenerationJob.status == "running",
            GenerationJob.started_at.is_not(None),
            GenerationJob.started_at < running_cutoff,
        )
    ).all():
        _fail_abandoned_job(
            db,
            job,
            error_message="Generation timed out before it could finish.",
            now=now,
        )
        expired += 1

    queued_cutoff = now - timedelta(minutes=settings.stale_queued_job_minutes)
    for job in db.scalars(
        select(GenerationJob).where(
            GenerationJob.job_type.in_(GENERATION_JOB_TYPES),
            GenerationJob.status == "queued",
            GenerationJob.created_at < queued_cutoff,
        )
    ).all():
        _fail_abandoned_job(
            db,
            job,
            error_message="Queued generation expired before a worker picked it up.",
            now=now,
        )
        expired += 1

    if expired:
        db.flush()
        logger.info("expired_stale_generation_jobs count=%s", expired)
    return expired


def _claim_generation_job(db: Session, job_uuid: uuid.UUID, now) -> bool:
    """Claim a queued job, or reclaim a running job after a worker crash/retry.

    Arq retries after a restart while the DB row is already ``running``. Claiming
    only ``queued`` made those retries return success without generating, leaving
    the client polling forever.
    """
    claimed = db.execute(
        update(GenerationJob)
        .where(
            GenerationJob.id == job_uuid,
            GenerationJob.status.in_(ACTIVE_JOB_STATUSES),
        )
        .values(status="running", started_at=now)
    ).rowcount
    db.commit()
    return bool(claimed)


def should_queue_generation(db: Session) -> bool:
    """Queue-first study generation when Redis, DB, and model runtime are ready.

    Falls back to inline API generation when worker infrastructure is unavailable.
    """
    if not settings.enable_queue_first_study_generation:
        return False
    from app.services.worker_readiness import worker_ready_for_generation

    if not worker_ready_for_generation(db):
        return False
    expire_stale_generation_jobs(db)
    return True


def generation_queue_available(db: Session) -> bool:
    """Backward-compatible alias for should_queue_generation."""
    return should_queue_generation(db)


def _queued_generation_message(generation_type: str = "quiz") -> str:
    if generation_type == "flashcard":
        return "Your flashcards will appear here shortly."
    if generation_type == "artifact":
        return "Your study material will appear here shortly."
    return "Your quiz will appear here shortly."


def _queue_position(db: Session, job: GenerationJob) -> int | None:
    if job.status != "queued":
        return None
    ahead = int(
        db.scalar(
            select(func.count(GenerationJob.id)).where(
                GenerationJob.status == "queued",
                GenerationJob.job_type.in_(GENERATION_JOB_TYPES),
                GenerationJob.created_at < job.created_at,
            )
        )
        or 0
    )
    return ahead + 1


def _to_response(db: Session, job: GenerationJob) -> JobResponse:
    payload = job.payload or {}
    progress_stage = payload.get("progress_stage")
    return JobResponse(
        id=job.id,
        job_type=job.job_type,  # type: ignore[arg-type]
        status=job.status,  # type: ignore[arg-type]
        queue_position=_queue_position(db, job),
        thread_id=job.thread_id,
        material_id=job.material_id,
        message_id=job.message_id,
        result=job.result,
        error_message=job.error_message,
        duration_ms=job.duration_ms,
        started_at=job.started_at,
        completed_at=job.completed_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
        progress_stage=str(progress_stage) if progress_stage else None,
    )


def _generation_failure_label(
    metadata: dict[str, Any],
    *,
    default: str = "Generation returned no questions.",
) -> str:
    """Short user-facing failure reason derived from the generation metadata."""
    degradation = metadata.get("degradation_reason")
    if isinstance(degradation, dict):
        detail = degradation.get("detail") or degradation.get("fallback")
        if detail:
            return str(detail)
        code = str(degradation.get("code") or "")
        labels = {
            "rate_limit": (
                "The AI provider is rate-limiting right now. "
                "Wait a minute and try again, or switch model."
            ),
            "auth": (
                "The AI provider key is invalid or expired. "
                "Update the key in settings, or switch model source."
            ),
            "context_length": (
                "The selected material is too large for the model. "
                "Try a smaller file, a narrower topic, or a different model."
            ),
            "timeout": (
                "The AI provider timed out before finishing. "
                "Try again, or switch to a faster model."
            ),
            "empty_response": (
                "The model returned an unusable response. Try again or pick a different model."
            ),
            "provider_error": (
                "The AI provider couldn't complete the request. "
                "Try again or pick a different model."
            ),
        }
        if code in labels:
            return labels[code]
        if degradation.get("message"):
            return str(degradation["message"])
    return default


def _record_job_metrics(
    db: Session,
    job: GenerationJob,
    *,
    success: bool,
) -> None:
    record_usage(
        db,
        job.user_id,
        "generation_job_completed",
        metadata={
            "job_id": str(job.id),
            "job_type": job.job_type,
            "success": success,
            "duration_ms": job.duration_ms,
        },
    )
    logger.info(
        "generation_job_finished job_id=%s type=%s status=%s duration_ms=%s",
        job.id,
        job.job_type,
        job.status,
        job.duration_ms,
    )


class JobsService:
    def get_job(self, db: Session, user_id: uuid.UUID, job_id: uuid.UUID) -> JobResponse:
        expire_stale_generation_jobs(db)
        # GET sessions do not commit on close; persist stale expirations now.
        db.commit()
        job = db.scalar(
            select(GenerationJob).where(
                GenerationJob.id == job_id,
                GenerationJob.user_id == user_id,
            )
        )
        if job is None:
            raise JobNotFoundError(f"Job {job_id} was not found.")
        return _to_response(db, job)

    def enqueue_quiz_generation(
        self,
        db: Session,
        user: User,
        thread: ChatThread,
        intent: dict[str, Any],
    ) -> ChatMessage:
        return self._enqueue_study_generation(
            db,
            user,
            thread,
            job_type="quiz_generation",
            generation_type="quiz",
            intent=intent,
            # Unified generation quota for both quiz + flashcards.
            limit_event="chat_prompt",
            pending_message=(
                f"You already have {{pending}} quiz generations waiting. "
                "Please wait for one to finish before starting another."
            ),
        )

    def enqueue_flashcard_generation(
        self,
        db: Session,
        user: User,
        thread: ChatThread,
        intent: dict[str, Any],
    ) -> ChatMessage:
        return self._enqueue_study_generation(
            db,
            user,
            thread,
            job_type="flashcard_generation",
            generation_type="flashcard",
            intent=intent,
            # Unified generation quota for both quiz + flashcards.
            limit_event="chat_prompt",
            pending_message=(
                f"You already have {{pending}} flashcard generations waiting. "
                "Please wait for one to finish before starting another."
            ),
        )

    def enqueue_study_artifact_generation(
        self,
        db: Session,
        user: User,
        thread: ChatThread,
        intent: dict[str, Any],
    ) -> ChatMessage:
        return self._enqueue_study_generation(
            db,
            user,
            thread,
            job_type="study_artifact_generation",
            generation_type="artifact",
            intent=intent,
            limit_event="chat_prompt",
            pending_message=(
                f"You already have {{pending}} study generations waiting. "
                "Please wait for one to finish before starting another."
            ),
        )

    def _enqueue_study_generation(
        self,
        db: Session,
        user: User,
        thread: ChatThread,
        *,
        job_type: str,
        generation_type: str,
        intent: dict[str, Any],
        limit_event: str,
        pending_message: str,
    ) -> ChatMessage:
        expire_stale_generation_jobs(db)

        pending = _user_pending_generation_count(db, user.id)
        if pending >= settings.max_pending_generation_jobs_per_user:
            raise JobConcurrencyLimitError(pending_message.format(pending=pending))

        enforce_limit(db, user.id, limit_event)

        job = GenerationJob(
            user_id=user.id,
            job_type=job_type,
            status="queued",
            thread_id=thread.id,
            payload={
                "intent": intent,
                "llm_source": thread.llm_source,
                "llm_provider": thread.llm_provider,
                "user_api_key_id": str(thread.user_api_key_id) if thread.user_api_key_id else None,
                "progress_stage": "understanding",
            },
        )
        db.add(job)
        db.flush()

        message = ChatMessage(
            thread_id=thread.id,
            role="assistant",
            content=_queued_generation_message(generation_type),
            message_metadata={
                "event": "generation_queued",
                "job_id": str(job.id),
                "status": "queued",
                "generation_type": generation_type,
                "progress_stage": "understanding",
                "progress_label": "Understanding request",
            },
        )
        db.add(message)
        db.flush()

        job.message_id = message.id
        db.add(job)
        db.flush()

        return message

    def enqueue_parse_job(
        self,
        db: Session,
        user_id: uuid.UUID,
        material_id: uuid.UUID,
    ) -> GenerationJob:
        job = GenerationJob(
            user_id=user_id,
            job_type="parse_job",
            status="queued",
            material_id=material_id,
            payload={"material_id": str(material_id)},
        )
        db.add(job)
        db.flush()
        return job

    def enqueue_chunk_job(
        self,
        db: Session,
        user_id: uuid.UUID,
        material_id: uuid.UUID,
    ) -> GenerationJob:
        job = GenerationJob(
            user_id=user_id,
            job_type="chunk_job",
            status="queued",
            material_id=material_id,
            payload={"material_id": str(material_id)},
        )
        db.add(job)
        db.flush()
        return job

    def enqueue_embed_job(
        self,
        db: Session,
        user_id: uuid.UUID,
        material_id: uuid.UUID,
    ) -> GenerationJob:
        job = GenerationJob(
            user_id=user_id,
            job_type="embed_job",
            status="queued",
            material_id=material_id,
            payload={"material_id": str(material_id)},
        )
        db.add(job)
        db.flush()
        return job

    def enqueue_generation_profiles(
        self,
        db: Session,
        user_id: uuid.UUID,
        material_id: uuid.UUID,
    ) -> GenerationJob:
        job = GenerationJob(
            user_id=user_id,
            job_type="generation_profiles",
            status="queued",
            material_id=material_id,
            payload={"material_id": str(material_id)},
        )
        db.add(job)
        db.flush()
        return job

    def dispatch_quiz_generation(self, job_id: uuid.UUID) -> None:
        _enqueue_arq("process_quiz_generation", str(job_id))

    def dispatch_flashcard_generation(self, job_id: uuid.UUID) -> None:
        _enqueue_arq("process_flashcard_generation", str(job_id))

    def dispatch_study_artifact_generation(self, job_id: uuid.UUID) -> None:
        _enqueue_arq("process_study_artifact_generation", str(job_id))

    def dispatch_parse_job(self, job_id: uuid.UUID) -> None:
        _enqueue_arq("process_parse", str(job_id))

    def dispatch_chunk_job(self, job_id: uuid.UUID) -> None:
        _enqueue_arq("process_chunk", str(job_id))

    def dispatch_embed_job(self, job_id: uuid.UUID) -> None:
        _enqueue_arq("process_embed", str(job_id))

    def dispatch_generation_profiles(self, job_id: uuid.UUID) -> None:
        _enqueue_arq("process_generation_profiles", str(job_id))

    def mark_dispatch_failed(self, db: Session, job_id: uuid.UUID, error: str) -> None:
        job = db.scalar(select(GenerationJob).where(GenerationJob.id == job_id))
        if job is None:
            return
        job.status = "failed"
        job.error_message = error
        job.completed_at = utc_now()
        db.add(job)


jobs_service = JobsService()


def execute_quiz_generation_job(job_id: str) -> None:
    """Run quiz generation in the Arq worker."""
    from app.services.chat import (  # noqa: PLC0415 — avoid circular import at module load
        _agent_payload_with_insights,
        _chunks_from_media_attachments,
        _needs_topic_prompt,
        _owned_agent,
        _quiz_topic_clarification,
        _retrieval_chunks,
        _thread_material_ids,
        _topic_only_chunks,
    )
    from app.services.generation import (  # noqa: PLC0415
        QuizGenerationParams,
        execute_quiz_generation,
        generation_failure_payload,
        persist_generated_quiz,
    )

    db = SessionLocal()
    started = time.perf_counter()
    job_uuid = uuid.UUID(job_id)
    try:
        now = utc_now()
        if not _claim_generation_job(db, job_uuid, now):
            return

        job = db.scalar(select(GenerationJob).where(GenerationJob.id == job_uuid))
        if job is None:
            return

        thread = db.scalar(select(ChatThread).where(ChatThread.id == job.thread_id))
        user = db.scalar(select(User).where(User.id == job.user_id))
        message = db.scalar(select(ChatMessage).where(ChatMessage.id == job.message_id))
        if thread is None or user is None or message is None:
            job.status = "failed"
            job.error_message = "Missing thread, user, or message for quiz job."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(job)
            db.commit()
            return

        payload = job.payload or {}
        intent = payload.get("intent") or {}
        override: LlmOverride | None = None
        if payload.get("llm_source") == "byok" and payload.get("user_api_key_id"):
            try:
                key_record = get_owned_api_key(
                    db, user.id, uuid.UUID(str(payload["user_api_key_id"]))
                )
                if key_record.is_valid:
                    override = LlmOverride(
                        provider=key_record.provider, api_key=decrypt_api_key(key_record)
                    )
            except Exception:
                override = None
        material_ids = _thread_material_ids(thread)
        media_attachment_ids_raw = intent.get("media_attachment_ids") or []
        media_attachment_ids: list[uuid.UUID] = []
        for raw_id in media_attachment_ids_raw:
            try:
                media_attachment_ids.append(uuid.UUID(str(raw_id)))
            except (TypeError, ValueError):
                continue
        media_attachments = (
            db.scalars(
                select(MediaAttachment).where(
                    MediaAttachment.id.in_(media_attachment_ids),
                    MediaAttachment.user_id == user.id,
                )
            ).all()
            if media_attachment_ids
            else []
        )
        from app.services.image_understanding import (  # noqa: PLC0415
            pending_topic_only_metadata,
            prepare_media_attachments_for_grounding,
            unreadable_attachment_clarify_message,
        )

        prepare_media_attachments_for_grounding(db, media_attachments, override=override)
        media_chunks = _chunks_from_media_attachments(media_attachments)
        count = int(intent.get("count", 10))
        topic_focus = intent.get("topic_focus")
        material_requested = bool(material_ids) or bool(media_attachment_ids)
        uses_material = bool(material_ids) or bool(media_chunks)

        if not material_requested and _needs_topic_prompt(intent):
            message.content = _quiz_topic_clarification(is_first=False)
            message.message_metadata = {"event": "generation_failed", "job_id": str(job.id)}
            job.status = "failed"
            job.error_message = "Topic required for topic-only quiz."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
            return

        if material_requested and not uses_material:
            topic = topic_focus if isinstance(topic_focus, str) else None
            names = [item.filename for item in media_attachments if (item.filename or "").strip()]
            message.content = unreadable_attachment_clarify_message(
                media_attachments,
                artifact_label="quiz",
                topic_focus=topic,
            )
            message.message_metadata = {
                **pending_topic_only_metadata(
                    artifact_type="quiz",
                    topic_focus=topic,
                    attachment_names=names,
                ),
                "job_id": str(job.id),
            }
            job.status = "failed"
            job.error_message = "Media attachment content not readable yet."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
            return

        resolved_override, resolved_model = _resolve_topic_only_runtime_model(
            thread, override, intent.get("model")
        )
        if not uses_material and not is_llm_configured(override=resolved_override):
            message.content = (
                "Topic-only quiz generation needs an available model runtime. "
                "Platform models are the default, and BYOK is optional when valid. "
                "If topic-only generation is temporarily unavailable, attach materials so I can generate from your notes."
            )
            message.message_metadata = {"event": "generation_failed", "job_id": str(job.id)}
            job.status = "failed"
            job.error_message = "LLM not configured for topic-only quiz."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
            return

        chunks = (
            _retrieval_chunks(db, user.id, thread.course_id, material_ids, count)
            if material_ids
            else []
        )
        if media_chunks:
            seen_ids = {chunk.get("id") for chunk in chunks}
            chunks = [chunk for chunk in media_chunks if chunk.get("id") not in seen_ids] + chunks
        if not chunks:
            chunks = _topic_only_chunks(str(topic_focus), count)
        if topic_focus and uses_material:
            chunks = rank_chunks_by_query(chunks, topic_focus)
        if not chunks:
            message.content = (
                "I couldn't find readable content in your attached materials. "
                "Try uploading a different file or naming a topic for a general quiz."
            )
            message.message_metadata = {"event": "generation_failed", "job_id": str(job.id)}
            job.status = "failed"
            job.error_message = "No material chunks available."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
            return

        agent = _owned_agent(db, user.id, thread.professor_agent_id)
        topic_label = topic_focus or thread.title
        override_token, platform_token = _bind_job_llm(
            payload, resolved_override, model=resolved_model
        )
        try:
            params = QuizGenerationParams(
                chunks=chunks,
                count=count,
                question_types=intent.get("question_types") or ["mcq"],
                topic_focus=topic_focus,
                topic_label=topic_label,
                difficulty=intent.get("difficulty") or "medium",
                agent_payload=_agent_payload_with_insights(db, agent, user.id, material_ids)
                if agent
                else None,
                timer_minutes=intent.get("timer_minutes"),
                shuffle_questions=intent.get("shuffle_questions", False),
                shuffle_options=intent.get("shuffle_options", True),
                options_count=intent.get("options_count", 4),
                material_ids=material_ids,
                model=resolved_model,
                uses_material=uses_material,
                variation_seed=uuid.uuid4().int % (2**31),
            )
            generated = execute_quiz_generation(params)
        finally:
            _unbind_job_llm(override_token, platform_token)
        if not generated:
            content, metadata = generation_failure_payload(
                default_message=(
                    "I couldn't generate questions from your materials. "
                    "Try rephrasing or attach different content."
                ),
                job_id=str(job.id),
            )
            message.content = content
            message.message_metadata = metadata
            job.status = "failed"
            job.error_message = _generation_failure_label(metadata)
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
            return

        question_types = intent.get("question_types") or ["mcq"]
        type_label = ", ".join(question_types).replace("_", " ")
        quiz = persist_generated_quiz(
            db,
            user_id=user.id,
            course_id=thread.course_id,
            professor_agent_id=thread.professor_agent_id,
            title=f"{thread.title} - {count} {type_label}",
            config={
                "count": count,
                "question_types": question_types,
                "timer_minutes": intent.get("timer_minutes"),
                "shuffle_questions": intent.get("shuffle_questions", False),
                "shuffle_options": intent.get("shuffle_options", True),
                "options_count": intent.get("options_count", 4),
                "material_ids": [str(material_id) for material_id in material_ids],
                "topic_focus": topic_focus,
                "model": resolved_model,
                "source": "chat",
                "grounding": "materials" if uses_material else "general_topic",
                "job_id": str(job.id),
            },
            generated_questions=generated,
            status="ready",
        )
        record_usage(db, user.id, "chat_prompt")
        db.flush()

        preview = [
            {
                "prompt": question.prompt,
                "options": question.options,
                "topic": question.topic,
            }
            for question in quiz.questions[:3]
        ]
        agent_note = f" using **{agent.name}**'s style" if agent else ""
        message.content = (
            f"Generated {len(quiz.questions)} questions{agent_note} "
            + ("from your materials" if uses_material else f"on {topic_focus}")
            + (f" ({intent.get('timer_minutes')} min timer)" if intent.get("timer_minutes") else "")
            + ". Preview the first few below, then start the quiz when ready."
        )
        message.quiz_id = quiz.id
        message.message_metadata = {
            "event": "generation_completed",
            "job_id": str(job.id),
            "quiz_preview": preview,
            "question_count": len(quiz.questions),
        }

        job.status = "completed"
        job.error_message = None
        job.result = {
            "quiz_id": str(quiz.id),
            "message_id": str(message.id),
            "question_count": len(quiz.questions),
        }
        job.completed_at = utc_now()
        job.duration_ms = int((time.perf_counter() - started) * 1000)
        thread.updated_at = utc_now()

        db.add(message)
        db.add(quiz)
        db.add(thread)
        db.add(job)
        db.commit()
        _record_job_metrics(db, job, success=True)
        db.commit()
    except Exception as exc:
        db.rollback()
        job = db.scalar(select(GenerationJob).where(GenerationJob.id == job_uuid))
        if job is not None:
            job.status = "failed"
            job.error_message = "Quiz generation failed. Please try again."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            if job.message_id:
                message = db.scalar(select(ChatMessage).where(ChatMessage.id == job.message_id))
                if message is not None:
                    message.content = "Quiz generation failed. Please try again."
                    message.message_metadata = {
                        "event": "generation_failed",
                        "job_id": str(job.id),
                    }
                    db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
        logger.exception("quiz_generation_job_failed job_id=%s", job_id)
    finally:
        db.close()


def execute_flashcard_generation_job(job_id: str) -> None:
    """Run flashcard generation in the Arq worker."""
    from app.services.chat import (  # noqa: PLC0415
        _chunks_from_media_attachments,
        _needs_topic_prompt,
        _retrieval_chunks,
        _thread_material_ids,
        _topic_only_chunks,
    )
    from app.services.generation import generation_failure_payload  # noqa: PLC0415

    db = SessionLocal()
    started = time.perf_counter()
    job_uuid = uuid.UUID(job_id)
    try:
        now = utc_now()
        if not _claim_generation_job(db, job_uuid, now):
            return

        job = db.scalar(select(GenerationJob).where(GenerationJob.id == job_uuid))
        if job is None:
            return

        thread = db.scalar(select(ChatThread).where(ChatThread.id == job.thread_id))
        user = db.scalar(select(User).where(User.id == job.user_id))
        message = db.scalar(select(ChatMessage).where(ChatMessage.id == job.message_id))
        if thread is None or user is None or message is None:
            job.status = "failed"
            job.error_message = "Missing thread, user, or message for flashcard job."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(job)
            db.commit()
            return

        payload = job.payload or {}
        intent = payload.get("intent") or {}
        override: LlmOverride | None = None
        if payload.get("llm_source") == "byok" and payload.get("user_api_key_id"):
            try:
                key_record = get_owned_api_key(
                    db, user.id, uuid.UUID(str(payload["user_api_key_id"]))
                )
                if key_record.is_valid:
                    override = LlmOverride(
                        provider=key_record.provider, api_key=decrypt_api_key(key_record)
                    )
            except Exception:
                override = None

        material_ids = _thread_material_ids(thread)
        media_attachment_ids_raw = intent.get("media_attachment_ids") or []
        media_attachment_ids: list[uuid.UUID] = []
        for raw_id in media_attachment_ids_raw:
            try:
                media_attachment_ids.append(uuid.UUID(str(raw_id)))
            except (TypeError, ValueError):
                continue
        media_attachments = (
            db.scalars(
                select(MediaAttachment).where(
                    MediaAttachment.id.in_(media_attachment_ids),
                    MediaAttachment.user_id == user.id,
                )
            ).all()
            if media_attachment_ids
            else []
        )
        from app.services.image_understanding import (  # noqa: PLC0415
            pending_topic_only_metadata,
            prepare_media_attachments_for_grounding,
            unreadable_attachment_clarify_message,
        )

        prepare_media_attachments_for_grounding(db, media_attachments, override=override)
        media_chunks = _chunks_from_media_attachments(media_attachments)
        count = int(intent.get("count", 10))
        topic_focus = intent.get("topic_focus")
        material_requested = bool(material_ids) or bool(media_attachment_ids)
        uses_material = bool(material_ids) or bool(media_chunks)

        if not material_requested and _needs_topic_prompt(intent):
            message.content = (
                "What should the flashcards cover? Name a topic like `/flashcards on [topic]`, "
                "or attach material if you want cards grounded in your notes."
            )
            message.message_metadata = {"event": "generation_failed", "job_id": str(job.id)}
            job.status = "failed"
            job.error_message = "Topic required for topic-only flashcards."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
            return

        if material_requested and not uses_material:
            topic = topic_focus if isinstance(topic_focus, str) else None
            names = [item.filename for item in media_attachments if (item.filename or "").strip()]
            message.content = unreadable_attachment_clarify_message(
                media_attachments,
                artifact_label="flashcards",
                topic_focus=topic,
            )
            message.message_metadata = {
                **pending_topic_only_metadata(
                    artifact_type="flashcards",
                    topic_focus=topic,
                    attachment_names=names,
                ),
                "job_id": str(job.id),
            }
            job.status = "failed"
            job.error_message = "Media attachment content not readable yet."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
            return

        resolved_override, resolved_model = _resolve_topic_only_runtime_model(
            thread, override, intent.get("model")
        )
        if not uses_material and not is_llm_configured(override=resolved_override):
            message.content = (
                "Topic-only flashcard generation needs an available model runtime. "
                "Platform models are the default, and BYOK is optional when valid. "
                "If topic-only generation is temporarily unavailable, attach materials so I can build cards from your notes."
            )
            message.message_metadata = {"event": "generation_failed", "job_id": str(job.id)}
            job.status = "failed"
            job.error_message = "LLM not configured for topic-only flashcards."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
            return

        chunks = (
            _retrieval_chunks(
                db,
                user.id,
                thread.course_id,
                material_ids,
                count,
                query=str(topic_focus) if topic_focus else None,
            )
            if material_ids
            else []
        )
        if media_chunks:
            seen_ids = {chunk.get("id") for chunk in chunks}
            chunks = [chunk for chunk in media_chunks if chunk.get("id") not in seen_ids] + chunks
        if not chunks:
            chunks = _topic_only_chunks(str(topic_focus), count)
        if topic_focus and uses_material:
            chunks = rank_chunks_by_query(chunks, topic_focus)
        if not chunks:
            message.content = (
                "I couldn't find readable content in your attached materials. "
                "Try uploading a different file or naming a topic for general flashcards."
            )
            message.message_metadata = {"event": "generation_failed", "job_id": str(job.id)}
            job.status = "failed"
            job.error_message = "No material chunks available."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
            return

        topic_label = topic_focus or thread.title
        override_token, platform_token = _bind_job_llm(
            payload, resolved_override, model=resolved_model
        )
        try:
            generated = generate_flashcards(
                chunks,
                count=count,
                topic_label=topic_label,
                model=resolved_model,
            )
        finally:
            _unbind_job_llm(override_token, platform_token)

        if not generated:
            content, metadata = generation_failure_payload(
                default_message=(
                    "I couldn't generate flashcards from your materials. "
                    "Try rephrasing or attach different content."
                ),
                job_id=str(job.id),
            )
            message.content = content
            message.message_metadata = metadata
            job.status = "failed"
            job.error_message = _generation_failure_label(
                metadata,
                default="Generation returned no flashcards.",
            )
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
            return

        deck = FlashcardDeck(
            user_id=user.id,
            course_id=thread.course_id,
            title=f"{thread.title} — {len(generated)} flashcards",
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
        record_usage(db, user.id, "chat_prompt")
        db.flush()

        deck = db.scalar(
            select(FlashcardDeck)
            .options(selectinload(FlashcardDeck.flashcards))
            .where(FlashcardDeck.id == deck.id)
        )
        assert deck is not None

        preview = [
            {"front": card.front, "back": card.back, "topic": card.topic}
            for card in deck.flashcards[:3]
        ]
        message.content = (
            f"Built {len(deck.flashcards)} flashcards"
            + (" from your materials" if uses_material else f" on {topic_focus}")
            + ". Preview a few below, then start studying when ready."
        )
        message.message_metadata = {
            "deck_id": str(deck.id),
            "flashcard_preview": preview,
            "card_count": len(deck.flashcards),
        }
        job.status = "completed"
        job.error_message = None
        job.result = {
            "deck_id": str(deck.id),
            "message_id": str(message.id),
            "card_count": len(deck.flashcards),
        }
        job.completed_at = utc_now()
        job.duration_ms = int((time.perf_counter() - started) * 1000)
        thread.updated_at = utc_now()

        db.add(message)
        db.add(deck)
        db.add(thread)
        db.add(job)
        db.commit()
        _record_job_metrics(db, job, success=True)
        db.commit()
    except Exception as exc:
        db.rollback()
        job = db.scalar(select(GenerationJob).where(GenerationJob.id == job_uuid))
        if job is not None:
            job.status = "failed"
            job.error_message = str(exc)
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            if job.message_id:
                message = db.scalar(select(ChatMessage).where(ChatMessage.id == job.message_id))
                if message is not None:
                    message.content = "Flashcard generation failed. Please try again."
                    message.message_metadata = {
                        "event": "generation_failed",
                        "job_id": str(job.id),
                        "error": str(exc),
                    }
                    db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
        logger.exception("flashcard_generation_job_failed job_id=%s", job_id)
    finally:
        db.close()


def _run_stage_job(job_id: str, stage_name: str, process_method: str) -> None:
    db = SessionLocal()
    started = time.perf_counter()
    job_uuid = uuid.UUID(job_id)
    try:
        now = utc_now()
        if not _claim_generation_job(db, job_uuid, now):
            return

        job = db.scalar(select(GenerationJob).where(GenerationJob.id == job_uuid))
        if job is None:
            return

        material = db.scalar(select(Material).where(Material.id == job.material_id))
        if material is None:
            job.status = "failed"
            job.error_message = "Material not found."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(job)
            db.commit()
            return

        method = getattr(materials_service, process_method)
        method(db, material)
        db.flush()
        chunk_count = int(
            db.scalar(
                select(func.count(MaterialChunk.id)).where(MaterialChunk.material_id == material.id)
            )
            or 0
        )

        success = material.status in ("parsed", "chunked", "ready", "processed")
        job.status = "completed" if success else "failed"
        job.error_message = (
            None
            if success
            else (material.extracted_text_preview or f"Material {stage_name} failed.")
        )
        job.result = {
            "material_id": str(material.id),
            "status": material.status,
            "chunk_count": chunk_count,
        }
        job.completed_at = utc_now()
        job.duration_ms = int((time.perf_counter() - started) * 1000)
        db.add(material)
        db.add(job)
        db.commit()
        _record_job_metrics(db, job, success=success)
        db.commit()
    except Exception as exc:
        db.rollback()
        job = db.scalar(select(GenerationJob).where(GenerationJob.id == job_uuid))
        if job is not None:
            job.status = "failed"
            job.error_message = str(exc)
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
        logger.exception(f"{stage_name}_job_failed job_id=%s", job_id)
    finally:
        db.close()


def execute_parse_job(job_id: str) -> None:
    _run_stage_job(job_id, "parse", "_process_parse")


def execute_chunk_job(job_id: str) -> None:
    _run_stage_job(job_id, "chunk", "_process_chunk")


def execute_embed_job(job_id: str) -> None:
    _run_stage_job(job_id, "embed", "_process_embed")


def execute_generation_profiles_job(job_id: str) -> None:
    """Apply upload-triggered generation profiles in the Arq worker."""
    from app.services.generation_profiles import apply_upload_profiles  # noqa: PLC0415

    db = SessionLocal()
    started = time.perf_counter()
    job_uuid = uuid.UUID(job_id)
    try:
        now = utc_now()
        if not _claim_generation_job(db, job_uuid, now):
            return

        job = db.scalar(select(GenerationJob).where(GenerationJob.id == job_uuid))
        if job is None:
            return

        material = db.scalar(select(Material).where(Material.id == job.material_id))
        if material is None:
            job.status = "failed"
            job.error_message = "Material not found."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(job)
            db.commit()
            return
        if material.status != "processed":
            job.status = "failed"
            job.error_message = "Material is not processed."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(job)
            db.commit()
            return

        result = apply_upload_profiles(db, material)
        job.status = "completed"
        job.error_message = None
        job.result = result
        job.completed_at = utc_now()
        job.duration_ms = int((time.perf_counter() - started) * 1000)
        db.add(job)
        db.commit()
        _record_job_metrics(db, job, success=True)
        db.commit()
    except Exception as exc:
        db.rollback()
        job = db.scalar(select(GenerationJob).where(GenerationJob.id == job_uuid))
        if job is not None:
            job.status = "failed"
            job.error_message = str(exc)
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
        logger.exception("generation_profiles_job_failed job_id=%s", job_id)
    finally:
        db.close()


def execute_study_artifact_generation_job(job_id: str) -> None:
    """Generate summary/study-guide/notes/mind-map artifacts in the worker."""
    from app.services.chat import (  # noqa: PLC0415
        _chunks_from_media_attachments,
        _primary_material_id,
        _retrieval_chunks,
        _thread_material_ids,
        _topic_only_chunks,
    )
    from app.services.image_understanding import (
        prepare_media_attachments_for_grounding,
        vision_image_urls,
    )
    from app.services.study_artifacts import (
        artifact_message_content,
        artifact_preview_metadata,
        generate_structured_artifact,
        persist_study_artifact,
        set_job_progress,
    )
    from app.services.generation import generation_failure_payload  # noqa: PLC0415

    db = SessionLocal()
    started = time.perf_counter()
    job_uuid = uuid.UUID(job_id)
    try:
        now = utc_now()
        if not _claim_generation_job(db, job_uuid, now):
            return

        job = db.scalar(select(GenerationJob).where(GenerationJob.id == job_uuid))
        if job is None:
            return

        thread = db.scalar(select(ChatThread).where(ChatThread.id == job.thread_id))
        user = db.scalar(select(User).where(User.id == job.user_id))
        message = db.scalar(select(ChatMessage).where(ChatMessage.id == job.message_id))
        if thread is None or user is None or message is None:
            job.status = "failed"
            job.error_message = "Missing thread, user, or message for study artifact job."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(job)
            db.commit()
            return

        payload = job.payload or {}
        intent = payload.get("intent") or {}
        artifact_type = str(intent.get("artifact_type") or "summary")
        topic_focus = intent.get("topic_focus")
        topic_label = topic_focus or thread.title

        override: LlmOverride | None = None
        if payload.get("llm_source") == "byok" and payload.get("user_api_key_id"):
            try:
                key_record = get_owned_api_key(
                    db, user.id, uuid.UUID(str(payload["user_api_key_id"]))
                )
                if key_record.is_valid:
                    override = LlmOverride(
                        provider=key_record.provider, api_key=decrypt_api_key(key_record)
                    )
            except Exception:
                override = None

        resolved_override, resolved_model = _resolve_topic_only_runtime_model(
            thread, override, intent.get("model")
        )

        set_job_progress(db, job, "reading_material")
        material_ids = _thread_material_ids(thread)
        media_attachment_ids_raw = intent.get("media_attachment_ids") or []
        media_attachment_ids: list[uuid.UUID] = []
        for raw_id in media_attachment_ids_raw:
            try:
                media_attachment_ids.append(uuid.UUID(str(raw_id)))
            except (TypeError, ValueError):
                continue
        media_attachments = (
            db.scalars(
                select(MediaAttachment).where(
                    MediaAttachment.id.in_(media_attachment_ids),
                    MediaAttachment.user_id == user.id,
                )
            ).all()
            if media_attachment_ids
            else []
        )
        prepare_media_attachments_for_grounding(db, media_attachments, override=resolved_override)
        vision_urls = vision_image_urls(media_attachments)
        media_chunks = _chunks_from_media_attachments(media_attachments)
        chunks = (
            _retrieval_chunks(db, user.id, thread.course_id, material_ids, 12)
            if material_ids
            else []
        )
        if media_chunks:
            seen_ids = {chunk.get("id") for chunk in chunks}
            chunks = [chunk for chunk in media_chunks if chunk.get("id") not in seen_ids] + chunks
        if not chunks and topic_focus:
            chunks = _topic_only_chunks(str(topic_focus), 8)
        if topic_focus and chunks:
            chunks = rank_chunks_by_query(chunks, topic_focus)

        set_job_progress(db, job, "generating")
        override_token, platform_token = _bind_job_llm(
            payload, resolved_override, model=resolved_model
        )
        try:
            structured = generate_structured_artifact(
                artifact_type=artifact_type,
                chunks=chunks,
                topic_focus=topic_focus,
                topic_label=topic_label,
                model=resolved_model,
                provider=(intent.get("llm_provider") or payload.get("llm_provider")),
                override=resolved_override,
                image_urls=vision_urls or None,
            )
        finally:
            _unbind_job_llm(override_token, platform_token)

        if not structured:
            content, metadata = generation_failure_payload(
                default_message="Study artifact generation failed. Please try again.",
                job_id=str(job.id),
            )
            message.content = content
            message.message_metadata = metadata
            job.status = "failed"
            job.error_message = _generation_failure_label(
                metadata,
                default="Study artifact generation produced no output.",
            )
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
            return

        set_job_progress(db, job, "persisting")
        title = str(
            structured.get("title") or f"{topic_label} — {artifact_type.replace('_', ' ').title()}"
        )
        artifact = persist_study_artifact(
            db,
            user_id=user.id,
            thread_id=thread.id,
            message_id=message.id,
            material_id=_primary_material_id(material_ids),
            artifact_type=artifact_type,
            title=title,
            content=structured,
        )
        record_usage(db, user.id, "chat_prompt")
        message.content = artifact_message_content(
            artifact_type,
            structured,
            topic_label=str(topic_label),
        )
        message.message_metadata = {
            "event": "generation_completed",
            "job_id": str(job.id),
            **artifact_preview_metadata(artifact),
        }
        job.status = "completed"
        job.error_message = None
        job.result = {
            "artifact_id": str(artifact.id),
            "artifact_type": artifact_type,
            "message_id": str(message.id),
        }
        job.completed_at = utc_now()
        job.duration_ms = int((time.perf_counter() - started) * 1000)
        thread.updated_at = utc_now()
        db.add(message)
        db.add(thread)
        db.add(job)
        db.commit()
        _record_job_metrics(db, job, success=True)
        db.commit()
    except Exception:
        db.rollback()
        job = db.scalar(select(GenerationJob).where(GenerationJob.id == job_uuid))
        if job is not None:
            job.status = "failed"
            job.error_message = "Study artifact generation failed. Please try again."
            job.completed_at = utc_now()
            job.duration_ms = int((time.perf_counter() - started) * 1000)
            if job.message_id:
                message = db.scalar(select(ChatMessage).where(ChatMessage.id == job.message_id))
                if message is not None:
                    message.content = "Study artifact generation failed. Please try again."
                    message.message_metadata = {
                        "event": "generation_failed",
                        "job_id": str(job.id),
                    }
                    db.add(message)
            db.add(job)
            db.commit()
            _record_job_metrics(db, job, success=False)
            db.commit()
        logger.exception("study_artifact_generation_job_failed job_id=%s", job_id)
    finally:
        db.close()
