from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.jobs import JobResponse
from app.services.jobs import JobNotFoundError, jobs_service

router = APIRouter()


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobResponse:
    try:
        return jobs_service.get_job(db, user.id, job_id)
    except JobNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
