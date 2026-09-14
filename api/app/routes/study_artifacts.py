from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import StudyArtifact, User
from app.schemas.study_artifacts import StudyArtifactResponse, StudyArtifactUpdateRequest
from app.services.study_artifacts import normalize_mind_map_content

router = APIRouter()


def _owned_artifact(db: Session, user_id: uuid.UUID, artifact_id: uuid.UUID) -> StudyArtifact:
    artifact = db.scalar(
        select(StudyArtifact).where(
            StudyArtifact.id == artifact_id,
            StudyArtifact.user_id == user_id,
        )
    )
    if artifact is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Study artifact not found.")
    return artifact


def _artifact_response(artifact: StudyArtifact) -> StudyArtifactResponse:
    content = dict(artifact.content or {})
    if artifact.artifact_type == "mind_map":
        content = normalize_mind_map_content(content, artifact.schema_version)
    return StudyArtifactResponse(
        id=artifact.id,
        artifact_type=artifact.artifact_type,
        title=artifact.title,
        content=content,
        schema_version=artifact.schema_version if artifact.artifact_type != "mind_map" else 2,
        thread_id=artifact.thread_id,
        message_id=artifact.message_id,
        material_id=artifact.material_id,
        created_at=artifact.created_at,
        updated_at=artifact.updated_at,
    )


@router.get("/{artifact_id}", response_model=StudyArtifactResponse)
def get_study_artifact(
    artifact_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudyArtifactResponse:
    artifact = _owned_artifact(db, user.id, artifact_id)
    return _artifact_response(artifact)


@router.patch("/{artifact_id}", response_model=StudyArtifactResponse)
def update_study_artifact(
    artifact_id: uuid.UUID,
    request: StudyArtifactUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudyArtifactResponse:
    artifact = _owned_artifact(db, user.id, artifact_id)

    if request.title is not None:
        artifact.title = request.title.strip() or artifact.title

    if request.content is not None:
        content = dict(request.content)
        if artifact.artifact_type == "mind_map":
            content = normalize_mind_map_content(content, artifact.schema_version)
            artifact.schema_version = 2
        artifact.content = content

    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    return _artifact_response(artifact)
