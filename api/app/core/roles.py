from __future__ import annotations

from app.core.config import settings
from app.models import User

ROLE_USER = "user"
ROLE_SUPER_ADMIN = "super_admin"

PLATFORM_ROLES = frozenset({ROLE_USER, ROLE_SUPER_ADMIN})


def super_admin_emails() -> set[str]:
    return {email.strip().lower() for email in settings.super_admin_emails.split(",") if email.strip()}


def effective_role(user: User) -> str:
    role = (user.role or ROLE_USER).strip().lower()
    if role == ROLE_SUPER_ADMIN:
        return ROLE_SUPER_ADMIN
    if user.email.lower() in super_admin_emails():
        return ROLE_SUPER_ADMIN
    return role if role in PLATFORM_ROLES else ROLE_USER


def user_has_role(user: User, role: str) -> bool:
    return effective_role(user) == role


def user_is_super_admin(user: User) -> bool:
    return user_has_role(user, ROLE_SUPER_ADMIN)


def initial_role_for_email(email: str) -> str:
    if email.strip().lower() in super_admin_emails():
        return ROLE_SUPER_ADMIN
    return ROLE_USER
