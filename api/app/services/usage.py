"""Usage tracking and plan entitlement enforcement."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.roles import user_is_super_admin
from app.models import Plan, Subscription, UsageEvent, User
from app.services import credits as credits_service

FREE_LIMITS = {
    "course_create": 3,
    "material_upload": 3,
    "quiz_generation": 20,
    "flashcard_generation": 20,
    # Counts any generation request originating from chat (quiz + flashcards).
    # This is the “chat prompt/generation meter” the UI will show.
    "chat_prompt": 20,
    "agent_create": 2,
    "mcp_connection_create": 5,
    "cv_upload": 5,
    "cv_tailoring": 10,
}

ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing"}


@dataclass(frozen=True)
class UsageWindow:
    start: datetime
    end: datetime | None


@dataclass(frozen=True)
class PlanLimitProfile:
    code: str
    limits: dict[str, int | None]
    source: str


def _current_subscription(db: Session, user_id: uuid.UUID) -> Subscription | None:
    return db.scalar(
        select(Subscription)
        .where(
            Subscription.user_id == user_id,
            Subscription.status.in_(ACTIVE_SUBSCRIPTION_STATUSES),
        )
        .order_by(Subscription.created_at.desc())
    )


def current_plan_code(db: Session, user_id: uuid.UUID) -> str:
    subscription = _current_subscription(db, user_id)
    if subscription is None:
        return "free"
    if subscription.plan is not None:
        return subscription.plan.code
    return "pro_monthly"


def _normalize_plan_family(plan_code: str) -> str:
    code = (plan_code or "free").strip().lower()
    if code == "free":
        return "free"
    if code.startswith("enterprise") or code.startswith("team"):
        return "enterprise"
    if code.startswith("pro"):
        return "pro"
    return code


def _default_limits_for_plan_code(plan_code: str) -> dict[str, int | None]:
    family = _normalize_plan_family(plan_code)
    if family == "free":
        return dict(FREE_LIMITS)
    if family == "pro":
        return {
            "course_create": None,
            "material_upload": None,
            "quiz_generation": None,
            "flashcard_generation": None,
            "chat_prompt": None,
            "agent_create": 5,
            "mcp_connection_create": None,
            "cv_upload": None,
            "cv_tailoring": None,
        }
    if family == "enterprise":
        return {
            "course_create": None,
            "material_upload": None,
            "quiz_generation": None,
            "flashcard_generation": None,
            "chat_prompt": None,
            "agent_create": None,
            "mcp_connection_create": None,
            "cv_upload": None,
            "cv_tailoring": None,
        }
    return {
        "course_create": None,
        "material_upload": None,
        "quiz_generation": None,
        "flashcard_generation": None,
        "chat_prompt": None,
        "agent_create": None,
        "mcp_connection_create": None,
        "cv_upload": None,
        "cv_tailoring": None,
    }


def _plan_profile(db: Session, user_id: uuid.UUID) -> PlanLimitProfile:
    plan_code = current_plan_code(db, user_id)
    defaults = _default_limits_for_plan_code(plan_code)
    db_plan = db.scalar(select(Plan).where(Plan.code == plan_code))
    if db_plan and isinstance(db_plan.limits, dict) and db_plan.limits:
        merged = dict(defaults)
        for key, value in db_plan.limits.items():
            if isinstance(value, int) or value is None:
                merged[str(key)] = value
        return PlanLimitProfile(code=plan_code, limits=merged, source="plan_row")
    return PlanLimitProfile(code=plan_code, limits=defaults, source="defaults")


def _usage_window_for_user(db: Session, user_id: uuid.UUID) -> UsageWindow:
    subscription = _current_subscription(db, user_id)
    if (
        subscription is not None
        and subscription.current_period_start is not None
        and subscription.current_period_end is not None
    ):
        return UsageWindow(
            start=subscription.current_period_start,
            end=subscription.current_period_end,
        )
    start = month_start()
    # For free users we treat the reset window as “next calendar month”.
    # Having an `end` timestamp lets `/billing/usage` show the exact reset time.
    year = start.year + (1 if start.month == 12 else 0)
    month = 1 if start.month == 12 else start.month + 1
    end = start.replace(year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0)
    return UsageWindow(start=start, end=end)


def usage_count_in_window(
    db: Session,
    user_id: uuid.UUID,
    event_type: str,
    *,
    window: UsageWindow,
) -> int:
    clauses = [
        UsageEvent.user_id == user_id,
        UsageEvent.event_type == event_type,
        UsageEvent.created_at >= window.start,
    ]
    if window.end is not None:
        clauses.append(UsageEvent.created_at < window.end)
    return int(
        db.scalar(
            select(func.coalesce(func.sum(UsageEvent.quantity), 0)).where(*clauses)
        )
        or 0
    )


def current_usage_window(db: Session, user_id: uuid.UUID) -> UsageWindow:
    return _usage_window_for_user(db, user_id)


def _user_bypasses_plan_limits(db: Session, user_id: uuid.UUID) -> bool:
    user = db.get(User, user_id)
    if user is None:
        return False
    return user_is_super_admin(user)


def get_limit_for_event(db: Session, user_id: uuid.UUID, event_type: str) -> int | None:
    if _user_bypasses_plan_limits(db, user_id):
        return None
    profile = _plan_profile(db, user_id)
    return profile.limits.get(event_type)


def enforce_limit(db: Session, user_id: uuid.UUID, event_type: str) -> None:
    if _user_bypasses_plan_limits(db, user_id):
        return
    profile = _plan_profile(db, user_id)
    limit = profile.limits.get(event_type)
    if limit is None:
        return
    window = _usage_window_for_user(db, user_id)
    used = usage_count_in_window(db, user_id, event_type, window=window)
    if used < limit:
        return
    debit = credits_service.try_debit_for_event(
        db,
        user_id,
        event_type,
        metadata={"limit": limit, "used": used, "plan_code": profile.code},
    )
    if debit.ok:
        return

    detail = (
        f"Plan limit reached for {event_type.replace('_', ' ')} "
        f"({used}/{limit} in current period)."
    )
    if window.end is not None:
        detail += f" Limit resets at {window.end.isoformat()}."
    else:
        detail += " Limit resets at the start of next month."
    detail += (
        f" Credits required: {debit.credits_required}. "
        f"Available credits: {debit.credits_available}."
    )
    raise HTTPException(
        status.HTTP_402_PAYMENT_REQUIRED,
        detail=detail,
    )


def month_start() -> datetime:
    now = datetime.now(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def usage_count(db: Session, user_id: uuid.UUID, event_type: str) -> int:
    return usage_count_in_window(
        db,
        user_id,
        event_type,
        window=UsageWindow(start=month_start(), end=None),
    )


def record_usage(
    db: Session, user_id: uuid.UUID, event_type: str, *, quantity: int = 1, metadata: dict | None = None
) -> None:
    db.add(
        UsageEvent(
            user_id=user_id,
            event_type=event_type,
            quantity=quantity,
            event_metadata=metadata,
        )
    )


_USAGE_TYPE_LABELS = {
    "chat_prompt": "Chat generations",
    "material_upload": "Material uploads",
    "course_create": "Courses",
    "agent_create": "Professor agents",
    "quiz_generation": "Quiz generations",
    "flashcard_generation": "Flashcard generations",
    "cv_upload": "CV uploads",
    "cv_tailoring": "CV tailorings",
    "mcp_connection_create": "MCP connections",
}


def usage_history(
    db: Session,
    user_id: uuid.UUID,
    *,
    days: int = 30,
) -> dict:
    """Aggregate the user's usage events for charts (portable across SQLite/Postgres)."""
    from collections import defaultdict
    from datetime import timedelta

    safe_days = max(1, min(90, int(days)))
    now = datetime.now(UTC)
    since = (now - timedelta(days=safe_days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    events = db.scalars(
        select(UsageEvent).where(
            UsageEvent.user_id == user_id,
            UsageEvent.created_at >= since,
        )
    ).all()

    by_day: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    by_type: dict[str, int] = defaultdict(int)
    total_events = 0

    for event in events:
        qty = int(event.quantity or 0)
        total_events += qty
        by_type[event.event_type] += qty
        day_key = event.created_at.astimezone(UTC).date().isoformat()
        by_day[day_key]["total"] += qty
        if event.event_type == "chat_prompt":
            by_day[day_key]["chat_prompts"] += qty
        elif event.event_type == "material_upload":
            by_day[day_key]["material_uploads"] += qty
        elif event.event_type == "course_create":
            by_day[day_key]["course_creates"] += qty
        elif event.event_type == "agent_create":
            by_day[day_key]["agent_creates"] += qty
        elif event.event_type == "cv_tailoring":
            by_day[day_key]["cv_tailorings"] += qty
        else:
            by_day[day_key]["other"] += qty

    series = []
    for offset in range(safe_days):
        day = (since + timedelta(days=offset)).date()
        key = day.isoformat()
        bucket = by_day.get(key, {})
        series.append(
            {
                "date": key,
                "total": int(bucket.get("total", 0)),
                "chat_prompts": int(bucket.get("chat_prompts", 0)),
                "material_uploads": int(bucket.get("material_uploads", 0)),
                "course_creates": int(bucket.get("course_creates", 0)),
                "agent_creates": int(bucket.get("agent_creates", 0)),
                "cv_tailorings": int(bucket.get("cv_tailorings", 0)),
                "other": int(bucket.get("other", 0)),
            }
        )

    by_type_points = [
        {
            "event_type": event_type,
            "label": _USAGE_TYPE_LABELS.get(event_type, event_type.replace("_", " ").title()),
            "total": total,
        }
        for event_type, total in sorted(by_type.items(), key=lambda item: (-item[1], item[0]))
    ]

    return {
        "days": safe_days,
        "series": series,
        "by_type": by_type_points,
        "total_events": total_events,
    }


def ensure_default_plans(db: Session) -> None:
    """Seed plan rows if missing."""
    existing = set(db.scalars(select(Plan.code)).all())
    defaults = [
        ("free", "Free", None, "none", FREE_LIMITS),
        ("pro_monthly", "Student Pro Monthly", None, "month", None),
        ("pro_yearly", "Student Pro Yearly", None, "year", None),
        ("enterprise_monthly", "Enterprise Monthly", None, "month", None),
        ("enterprise_yearly", "Enterprise Yearly", None, "year", None),
    ]
    for code, name, price_id, interval, limits in defaults:
        if code not in existing:
            db.add(Plan(code=code, name=name, stripe_price_id=price_id, interval=interval, limits=limits))
