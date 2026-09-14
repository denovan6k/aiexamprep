from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decrypt_secret, encrypt_secret
from app.models import ChatThread, User, UserApiKey
from app.schemas.settings import ApiKeyCreateRequest, ApiKeyResponse
from app.services.providers.base import ProviderAuthError, ProviderError, get_adapter

SUPPORTED_PROVIDERS = {"openai", "anthropic"}


class ApiKeyServiceError(Exception):
    pass


def mask_key_last4(api_key: str) -> str:
    cleaned = api_key.strip()
    if len(cleaned) < 4:
        return cleaned
    return cleaned[-4:]


def _to_response(record: UserApiKey) -> ApiKeyResponse:
    return ApiKeyResponse(
        id=record.id,
        provider=record.provider,  # type: ignore[arg-type]
        label=record.label,
        key_last4=record.key_last4,
        is_valid=record.is_valid,
        last_validated_at=record.last_validated_at,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def list_api_keys(db: Session, user_id: uuid.UUID) -> list[ApiKeyResponse]:
    records = db.scalars(
        select(UserApiKey)
        .where(UserApiKey.user_id == user_id)
        .order_by(UserApiKey.created_at.desc())
    ).all()
    return [_to_response(record) for record in records]


def create_api_key(
    db: Session,
    user: User,
    request: ApiKeyCreateRequest,
) -> ApiKeyResponse:
    provider = request.provider.strip().lower()
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider. Choose one of: {', '.join(sorted(SUPPORTED_PROVIDERS))}.",
        )

    api_key = request.api_key.strip()
    if len(api_key) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="API key is too short.")

    adapter = get_adapter(provider, api_key)
    try:
        adapter.validate_key(api_key)
    except ProviderAuthError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ProviderError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    existing = db.scalar(
        select(UserApiKey).where(UserApiKey.user_id == user.id, UserApiKey.provider == provider)
    )
    now = datetime.now(UTC)
    encrypted = encrypt_secret(api_key, secret=settings.encryption_secret)
    if existing:
        existing.label = request.label
        existing.encrypted_key = encrypted
        existing.key_last4 = mask_key_last4(api_key)
        existing.is_valid = True
        existing.last_validated_at = now
        existing.updated_at = now
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return _to_response(existing)

    record = UserApiKey(
        user_id=user.id,
        provider=provider,
        label=request.label,
        encrypted_key=encrypted,
        key_last4=mask_key_last4(api_key),
        is_valid=True,
        last_validated_at=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_response(record)


def delete_api_key(db: Session, user_id: uuid.UUID, key_id: uuid.UUID) -> None:
    record = db.scalar(
        select(UserApiKey).where(UserApiKey.id == key_id, UserApiKey.user_id == user_id)
    )
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="API key not found.")
    db.execute(
        update(ChatThread)
        .where(ChatThread.user_id == user_id, ChatThread.user_api_key_id == key_id)
        .values(llm_source="platform", llm_provider=None, user_api_key_id=None)
    )
    db.delete(record)
    db.commit()


def get_owned_api_key(db: Session, user_id: uuid.UUID, key_id: uuid.UUID) -> UserApiKey:
    record = db.scalar(
        select(UserApiKey).where(UserApiKey.id == key_id, UserApiKey.user_id == user_id)
    )
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="API key not found.")
    return record


def decrypt_api_key(record: UserApiKey) -> str:
    return decrypt_secret(record.encrypted_key, secret=settings.encryption_secret)


def mark_api_key_invalid(db: Session, record: UserApiKey) -> None:
    record.is_valid = False
    record.updated_at = datetime.now(UTC)
    db.add(record)
    db.flush()
