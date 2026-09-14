from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError

from app.core.config import settings
from app.models import CreditGrant, CreditUsage


def _credit_tables_missing(exc: Exception) -> bool:
    msg = str(exc).lower()
    # Example: psycopg.errors.UndefinedTable: relation "credit_grants" does not exist
    return (
        ("credit_grants" in msg and "does not exist" in msg)
        or ("credit_usages" in msg and "does not exist" in msg)
    )


EVENT_TOKEN_ESTIMATES: dict[str, tuple[int, int]] = {
    "material_upload": (1200, 0),
    "quiz_generation": (2200, 1800),
    "flashcard_generation": (1800, 1400),
    "chat_prompt": (1400, 900),
    "agent_create": (800, 200),
}


@dataclass(frozen=True)
class CreditDebitResult:
    ok: bool
    credits_required: int
    credits_available: int


def _active_grants(db: Session, user_id: uuid.UUID) -> list[CreditGrant]:
    now = datetime.now(UTC)
    return db.scalars(
        select(CreditGrant)
        .where(
            CreditGrant.user_id == user_id,
            CreditGrant.credits_remaining > 0,
            CreditGrant.expires_at > now,
        )
        .order_by(CreditGrant.expires_at.asc(), CreditGrant.created_at.asc())
    ).all()


def balance(db: Session, user_id: uuid.UUID) -> int:
    now = datetime.now(UTC)
    try:
        return int(
            db.scalar(
                select(func.coalesce(func.sum(CreditGrant.credits_remaining), 0)).where(
                    CreditGrant.user_id == user_id,
                    CreditGrant.credits_remaining > 0,
                    CreditGrant.expires_at > now,
                )
            )
            or 0
        )
    except ProgrammingError as exc:
        if _credit_tables_missing(exc):
            # Local/dev safety: if migrations haven't been applied yet, treat as 0 balance.
            return 0
        raise


def next_expiry(db: Session, user_id: uuid.UUID) -> datetime | None:
    now = datetime.now(UTC)
    try:
        return db.scalar(
            select(CreditGrant.expires_at)
            .where(
                CreditGrant.user_id == user_id,
                CreditGrant.credits_remaining > 0,
                CreditGrant.expires_at > now,
            )
            .order_by(CreditGrant.expires_at.asc())
            .limit(1)
        )
    except ProgrammingError as exc:
        if _credit_tables_missing(exc):
            return None
        raise


def create_grant(
    db: Session,
    user_id: uuid.UUID,
    credits: int,
    *,
    source: str = "purchase",
    description: str | None = None,
    expires_at: datetime | None = None,
) -> CreditGrant:
    safe_credits = max(0, int(credits))
    expiry = expires_at or (datetime.now(UTC) + timedelta(days=max(1, settings.credits_expiry_days)))
    grant = CreditGrant(
        user_id=user_id,
        credits_total=safe_credits,
        credits_remaining=safe_credits,
        source=source,
        description=description,
        expires_at=expiry,
    )
    db.add(grant)
    db.flush()
    return grant


def estimate_credits_for_event(event_type: str, *, metadata: dict[str, Any] | None = None) -> int:
    input_tokens, output_tokens = EVENT_TOKEN_ESTIMATES.get(event_type, (1000, 500))
    if metadata:
        input_tokens = int(metadata.get("estimated_input_tokens", input_tokens))
        output_tokens = int(metadata.get("estimated_output_tokens", output_tokens))
    input_usd = (max(0, input_tokens) / 1_000_000) * settings.credits_pricing_input_usd_per_million
    output_usd = (max(0, output_tokens) / 1_000_000) * settings.credits_pricing_output_usd_per_million
    total_usd = (input_usd + output_usd) * max(0.1, settings.credits_margin_multiplier)
    per_credit = max(0.0001, settings.credits_usd_per_credit)
    raw = total_usd / per_credit
    return max(settings.credits_min_charge_per_event, int(math.ceil(raw)))


def try_debit_for_event(
    db: Session,
    user_id: uuid.UUID,
    event_type: str,
    *,
    metadata: dict[str, Any] | None = None,
) -> CreditDebitResult:
    required = estimate_credits_for_event(event_type, metadata=metadata)
    try:
        grants = _active_grants(db, user_id)
    except ProgrammingError as exc:
        if _credit_tables_missing(exc):
            # No credit tables yet => can't debit, behave like “no credits”.
            return CreditDebitResult(ok=False, credits_required=required, credits_available=0)
        raise
    available = sum(grant.credits_remaining for grant in grants)
    if available < required:
        return CreditDebitResult(ok=False, credits_required=required, credits_available=available)

    remaining = required
    for grant in grants:
        if remaining <= 0:
            break
        from_grant = min(remaining, grant.credits_remaining)
        grant.credits_remaining -= from_grant
        remaining -= from_grant
        db.add(grant)
        db.add(
            CreditUsage(
                user_id=user_id,
                credit_grant_id=grant.id,
                event_type=event_type,
                credits_used=from_grant,
                usage_metadata=metadata,
            )
        )
    return CreditDebitResult(ok=True, credits_required=required, credits_available=available)
