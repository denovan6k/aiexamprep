from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel

JobStatus = Literal["queued", "running", "completed", "failed"]
JobType = Literal["quiz_generation", "flashcard_generation", "study_artifact_generation", "material_processing"]


class JobResponse(BaseModel):
    id: UUID
    job_type: JobType
    status: JobStatus
    queue_position: int | None = None
    thread_id: UUID | None = None
    material_id: UUID | None = None
    message_id: UUID | None = None
    result: dict[str, Any] | None = None
    error_message: str | None = None
    duration_ms: int | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    progress_stage: str | None = None
