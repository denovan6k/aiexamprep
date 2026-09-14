from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.generation_profiles import (
    GenerationProfileCreateRequest,
    GenerationProfileResponse,
    GenerationProfileUpdateRequest,
    MaterialInsightResponse,
)
from app.services import generation_profiles as profiles_service

router = APIRouter()


@router.get("", response_model=list[GenerationProfileResponse])
def list_generation_profiles(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GenerationProfileResponse]:
    return profiles_service.list_profiles(db, user.id)


@router.post("", response_model=GenerationProfileResponse, status_code=status.HTTP_201_CREATED)
def create_generation_profile(
    request: GenerationProfileCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GenerationProfileResponse:
    return profiles_service.create_profile(db, user, request)


@router.get("/insights", response_model=list[MaterialInsightResponse])
def list_material_insights(
    material_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MaterialInsightResponse]:
    return profiles_service.list_material_insights(db, user.id, material_id)


@router.get("/{profile_id}", response_model=GenerationProfileResponse)
def get_generation_profile(
    profile_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GenerationProfileResponse:
    try:
        return profiles_service.get_profile(db, user.id, profile_id)
    except profiles_service.GenerationProfileNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{profile_id}", response_model=GenerationProfileResponse)
def update_generation_profile(
    profile_id: uuid.UUID,
    request: GenerationProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GenerationProfileResponse:
    try:
        return profiles_service.update_profile(db, user.id, profile_id, request)
    except profiles_service.GenerationProfileNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_generation_profile(
    profile_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    try:
        profiles_service.delete_profile(db, user.id, profile_id)
    except profiles_service.GenerationProfileNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
