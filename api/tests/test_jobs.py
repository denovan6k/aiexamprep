from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models import ChatThread, ChatMessage, GenerationJob, User, UserApiKey
from app.models.entities import utc_now
from app.services.jobs import (
    ACTIVE_JOB_STATUSES,
    GENERATION_JOB_TYPES,
    _claim_generation_job,
    _queued_generation_message,
    expire_stale_generation_jobs,
    redis_available,
    should_queue_generation,
    jobs_service,
)


def _test_user(db_session: Session) -> User:
    user = User(
        name="Jobs Test User",
        email=f"jobs-{uuid4()}@example.com",
        password_hash="hashed",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_redis_available_false_when_disabled() -> None:
    with patch("app.services.jobs.settings.enable_job_queue", False):
        assert redis_available() is False


def test_active_job_statuses_include_queued_and_running() -> None:
    assert "queued" in ACTIVE_JOB_STATUSES
    assert "running" in ACTIVE_JOB_STATUSES


def test_queued_generation_message_is_simple() -> None:
    message = _queued_generation_message()
    assert message == "Your quiz will appear here shortly."
    assert "10" not in message
    assert "position" not in message


def test_should_queue_generation_false_without_redis(db_session: Session) -> None:
    with patch("app.services.jobs.settings.enable_queue_first_study_generation", True):
        with patch("app.services.worker_readiness.redis_available", return_value=False):
            assert should_queue_generation(db_session) is False


def test_should_queue_generation_false_when_queue_first_disabled(db_session: Session) -> None:
    with patch("app.services.jobs.settings.enable_queue_first_study_generation", False):
        with patch("app.services.jobs.redis_available", return_value=True):
            assert should_queue_generation(db_session) is False


def test_should_queue_generation_false_when_worker_not_ready(db_session: Session) -> None:
    with patch("app.services.jobs.settings.enable_queue_first_study_generation", True):
        with patch("app.services.jobs.redis_available", return_value=True):
            with patch("app.services.worker_readiness.worker_ready_for_generation", return_value=False):
                assert should_queue_generation(db_session) is False


def test_should_queue_generation_true_when_worker_ready(db_session: Session) -> None:
    with patch("app.services.jobs.settings.enable_queue_first_study_generation", True):
        with patch("app.services.jobs.redis_available", return_value=True):
            with patch("app.services.worker_readiness.worker_ready_for_generation", return_value=True):
                assert should_queue_generation(db_session) is True


def test_queued_generation_message_supports_artifact() -> None:
    assert _queued_generation_message("artifact") == "Your study material will appear here shortly."


def test_should_queue_generation_ignores_legacy_material_jobs(db_session: Session) -> None:
    user = _test_user(db_session)
    for _ in range(10):
        db_session.add(
            GenerationJob(
                user_id=user.id,
                job_type="material_processing",
                status="running",
                started_at=utc_now(),
            )
        )
    db_session.commit()

    with patch("app.services.jobs.settings.enable_queue_first_study_generation", True):
        with patch("app.services.jobs.redis_available", return_value=True):
            with patch("app.services.worker_readiness.worker_ready_for_generation", return_value=True):
                assert should_queue_generation(db_session) is True


def test_expire_stale_generation_jobs_marks_old_running_jobs_failed(db_session: Session) -> None:
    user = _test_user(db_session)
    stale_job = GenerationJob(
        user_id=user.id,
        job_type="quiz_generation",
        status="running",
        started_at=utc_now() - timedelta(minutes=30),
    )
    db_session.add(stale_job)
    db_session.commit()

    expired = expire_stale_generation_jobs(db_session)
    db_session.refresh(stale_job)

    assert expired == 1
    assert stale_job.status == "failed"
    assert stale_job.error_message


def test_expire_stale_generation_jobs_updates_queued_chat_message(db_session: Session) -> None:
    user = _test_user(db_session)
    thread = ChatThread(user_id=user.id, title="Stale quiz", material_ids=[])
    db_session.add(thread)
    db_session.flush()
    message = ChatMessage(
        thread_id=thread.id,
        role="assistant",
        content="Your quiz will appear here shortly.",
        message_metadata={"event": "generation_queued"},
    )
    db_session.add(message)
    db_session.flush()
    stale_job = GenerationJob(
        user_id=user.id,
        job_type="quiz_generation",
        status="running",
        thread_id=thread.id,
        message_id=message.id,
        started_at=utc_now() - timedelta(minutes=30),
    )
    db_session.add(stale_job)
    db_session.commit()

    expire_stale_generation_jobs(db_session)
    db_session.refresh(stale_job)
    db_session.refresh(message)

    assert stale_job.status == "failed"
    assert message.message_metadata["event"] == "generation_failed"
    assert "timed out" in (stale_job.error_message or "").lower()


def test_claim_generation_job_reclaims_running_after_worker_restart(db_session: Session) -> None:
    user = _test_user(db_session)
    original_started = utc_now() - timedelta(minutes=5)
    job = GenerationJob(
        user_id=user.id,
        job_type="quiz_generation",
        status="running",
        started_at=original_started,
    )
    db_session.add(job)
    db_session.commit()

    now = utc_now()
    assert _claim_generation_job(db_session, job.id, now) is True
    db_session.refresh(job)
    assert job.status == "running"
    assert job.started_at is not None
    assert job.started_at != original_started


def test_claim_generation_job_skips_completed(db_session: Session) -> None:
    user = _test_user(db_session)
    job = GenerationJob(
        user_id=user.id,
        job_type="quiz_generation",
        status="completed",
        started_at=utc_now(),
        completed_at=utc_now(),
    )
    db_session.add(job)
    db_session.commit()

    assert _claim_generation_job(db_session, job.id, utc_now()) is False
    db_session.refresh(job)
    assert job.status == "completed"


def test_generation_job_types_include_quiz_only_for_capacity() -> None:
    assert "quiz_generation" in GENERATION_JOB_TYPES
    assert "material_processing" not in GENERATION_JOB_TYPES


def test_enqueue_quiz_generation_includes_thread_byok_payload(db_session: Session) -> None:
    user = _test_user(db_session)
    key = UserApiKey(
        user_id=user.id,
        provider="openai",
        encrypted_key="encrypted",
        key_last4="1234",
        is_valid=True,
    )
    thread = ChatThread(
        user_id=user.id,
        title="BYOK job",
        material_ids=[],
        llm_source="byok",
        llm_provider="openai",
    )
    db_session.add(key)
    db_session.add(thread)
    db_session.flush()
    thread.user_api_key_id = key.id
    db_session.commit()
    db_session.refresh(thread)

    message = jobs_service.enqueue_quiz_generation(
        db_session,
        user,
        thread,
        {"intent": "generate_quiz", "count": 5, "topic_focus": "biology"},
    )
    job = db_session.query(GenerationJob).filter(GenerationJob.message_id == message.id).one()

    assert job.payload["llm_source"] == "byok"
    assert job.payload["llm_provider"] == "openai"
    assert job.payload["user_api_key_id"] == str(key.id)


def test_bind_job_llm_prefers_intent_provider(monkeypatch) -> None:
    from app.services.jobs import _bind_job_llm

    monkeypatch.setattr("app.services.jobs.is_provider_configured", lambda provider: provider == "gemini")
    captured: dict[str, str] = {}

    def fake_set_platform_provider(provider: str):
        captured["provider"] = provider
        return object()

    monkeypatch.setattr("app.services.jobs.set_platform_provider", fake_set_platform_provider)

    payload = {
        "llm_source": "platform",
        "llm_provider": "openrouter",
        "intent": {
            "model": "gemini-3.6-flash",
            "llm_provider": "gemini",
        },
    }
    _bind_job_llm(payload, None, model="gemini-3.6-flash")
    assert captured["provider"] == "gemini"
