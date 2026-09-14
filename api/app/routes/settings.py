from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.settings import (
    ApiKeyCreateRequest,
    ApiKeyResponse,
    ModelDefaultsRequest,
    ModelDefaultsResponse,
)
from app.services import api_keys as api_keys_service
from app.services import generation_profiles as profiles_service

router = APIRouter()


@router.get("/api-keys", response_model=list[ApiKeyResponse])
def list_api_keys(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ApiKeyResponse]:
    return api_keys_service.list_api_keys(db, user.id)


@router.post("/api-keys", response_model=ApiKeyResponse, status_code=status.HTTP_201_CREATED)
def create_api_key(
    request: ApiKeyCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiKeyResponse:
    return api_keys_service.create_api_key(db, user, request)


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_api_key(
    key_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    api_keys_service.delete_api_key(db, user.id, key_id)


@router.get("/model-defaults", response_model=ModelDefaultsResponse)
def get_model_defaults(
    user: User = Depends(get_current_user),
) -> ModelDefaultsResponse:
    return profiles_service.get_model_defaults(user)


@router.put("/model-defaults", response_model=ModelDefaultsResponse)
def update_model_defaults(
    request: ModelDefaultsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ModelDefaultsResponse:
    return profiles_service.update_model_defaults(db, user, request)
