from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.roles import user_is_super_admin
from app.core.database import get_db
from app.core.security import hash_token
from app.models import AuthSession, User
from app.services.auth import is_expired


def bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header.")
    return token


def optional_bearer_token(authorization: str | None = Header(default=None)) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def _session_user(db: Session, token: str, *, allow_inactive: bool = False) -> User | None:
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if (
        session is None
        or session.revoked_at is not None
        or is_expired(session.expires_at)
        or session.user is None
        or (not allow_inactive and not session.user.is_active)
    ):
        return None
    return session.user


def get_current_user(
    token: str = Depends(bearer_token),
    db: Session = Depends(get_db),
) -> User:
    user = _session_user(db, token)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token.")
    return user


def get_current_user_allow_inactive(
    token: str = Depends(bearer_token),
    db: Session = Depends(get_db),
) -> User:
    user = _session_user(db, token, allow_inactive=True)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token.")
    return user


def get_optional_current_user(
    token: str | None = Depends(optional_bearer_token),
    db: Session = Depends(get_db),
) -> User | None:
    if token is None:
        return None
    return _session_user(db, token)


def is_super_admin(user: User) -> bool:
    return user_is_super_admin(user)


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    if not user_is_super_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Super admin access required.")
    return user
