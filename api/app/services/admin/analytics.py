from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import ContentReport, ModerationAppeal, Plan, Subscription, SupportTicket, User
from app.schemas.admin import (
    AdminAnalyticsOverview,
    AdminGrowthPoint,
    AdminGrowthResponse,
    AdminPlanRevenueItem,
    AdminRevenueBreakdown,
    AdminSubscriptionListItem,
    AdminUsageAggregateItem,
    AdminUsageAggregateResponse,
)
from app.schemas.pagination import PaginatedResponse
from app.services.usage import ACTIVE_SUBSCRIPTION_STATUSES, month_start


DEFAULT_PLAN_PRICES_CENTS = {
    "pro_monthly": 1500,
    "pro_yearly": 12000,
}


class AdminAnalyticsService:
    def overview(self, db: Session) -> AdminAnalyticsOverview:
        total_users = int(db.scalar(select(func.count()).select_from(User)) or 0)
        active_users = int(
            db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True))) or 0
        )
        active_subscribers = self._active_subscriber_count(db)
        mrr, is_estimated = self._estimated_mrr(db)
        open_tickets = int(
            db.scalar(
                select(func.count()).select_from(SupportTicket).where(SupportTicket.status == "open")
            )
            or 0
        )
        open_appeals = int(
            db.scalar(
                select(func.count())
                .select_from(ModerationAppeal)
                .where(ModerationAppeal.status == "pending")
            )
            or 0
        )
        open_reports = int(
            db.scalar(
                select(func.count()).select_from(ContentReport).where(ContentReport.status == "open")
            )
            or 0
        )
        return AdminAnalyticsOverview(
            total_users=total_users,
            active_users=active_users,
            active_subscribers=active_subscribers,
            estimated_mrr_cents=mrr,
            open_support_tickets=open_tickets,
            open_appeals=open_appeals,
            open_reports=open_reports,
            is_revenue_estimated=is_estimated,
        )

    def growth(self, db: Session, *, days: int = 30) -> AdminGrowthResponse:
        days = max(1, min(days, 365))
        start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(
            days=days - 1
        )
        users = db.scalars(select(User).where(User.created_at >= start)).all()
        counts: dict[str, int] = {}
        for day_offset in range(days):
            day = (start + timedelta(days=day_offset)).date().isoformat()
            counts[day] = 0
        for user in users:
            day = user.created_at.astimezone(UTC).date().isoformat()
            if day in counts:
                counts[day] += 1
        points = [AdminGrowthPoint(date=day, signups=count) for day, count in sorted(counts.items())]
        return AdminGrowthResponse(days=days, points=points)

    def revenue(self, db: Session) -> AdminRevenueBreakdown:
        mrr, is_estimated = self._estimated_mrr(db)
        active_subscribers = self._active_subscriber_count(db)
        by_plan = self._revenue_by_plan(db, is_estimated)
        return AdminRevenueBreakdown(
            estimated_mrr_cents=mrr,
            estimated_arr_cents=mrr * 12,
            active_subscribers=active_subscribers,
            by_plan=by_plan,
            is_estimated=is_estimated,
        )

    def usage_aggregate(self, db: Session) -> AdminUsageAggregateResponse:
        from app.models import UsageEvent

        rows = db.execute(
            select(UsageEvent.event_type, func.coalesce(func.sum(UsageEvent.quantity), 0))
            .where(UsageEvent.created_at >= month_start())
            .group_by(UsageEvent.event_type)
            .order_by(func.coalesce(func.sum(UsageEvent.quantity), 0).desc())
        ).all()
        items = [
            AdminUsageAggregateItem(event_type=event_type, total_quantity=int(total or 0))
            for event_type, total in rows
        ]
        return AdminUsageAggregateResponse(items=items)

    def list_subscriptions(
        self,
        db: Session,
        *,
        status_filter: str | None = None,
        plan_code: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> PaginatedResponse[AdminSubscriptionListItem]:
        query = select(Subscription).order_by(Subscription.created_at.desc())
        if status_filter:
            query = query.where(Subscription.status == status_filter)

        subscriptions = db.scalars(query).all()
        items: list[AdminSubscriptionListItem] = []
        for subscription in subscriptions:
            code = subscription.plan.code if subscription.plan else None
            if plan_code and code != plan_code:
                continue
            user = subscription.user
            items.append(
                AdminSubscriptionListItem(
                    id=subscription.id,
                    user_id=subscription.user_id,
                    user_email=user.email if user else "",
                    user_name=user.name if user else "",
                    plan_code=code,
                    plan_name=subscription.plan.name if subscription.plan else None,
                    status=subscription.status,
                    stripe_customer_id=subscription.stripe_customer_id,
                    stripe_subscription_id=subscription.stripe_subscription_id,
                    current_period_end=subscription.current_period_end,
                    cancel_at_period_end=subscription.cancel_at_period_end,
                    created_at=subscription.created_at,
                )
            )

        total = len(items)
        page = items[offset : offset + limit]
        return PaginatedResponse(items=page, total=total, limit=limit, offset=offset)

    def _active_subscriber_count(self, db: Session) -> int:
        return int(
            db.scalar(
                select(func.count())
                .select_from(Subscription)
                .where(Subscription.status.in_(ACTIVE_SUBSCRIPTION_STATUSES))
            )
            or 0
        )

    def _plan_mrr_cents(self, plan: Plan | None, *, is_estimated: bool) -> int:
        if plan is None:
            return 0
        if plan.price_cents is not None:
            if plan.interval == "year":
                return plan.price_cents // 12
            return plan.price_cents
        if plan.code in DEFAULT_PLAN_PRICES_CENTS:
            price = DEFAULT_PLAN_PRICES_CENTS[plan.code]
            if plan.interval == "year":
                return price // 12
            return price
        return 0

    def _estimated_mrr(self, db: Session) -> tuple[int, bool]:
        is_estimated = not bool(settings.stripe_secret_key)
        subscriptions = db.scalars(
            select(Subscription).where(Subscription.status.in_(ACTIVE_SUBSCRIPTION_STATUSES))
        ).all()
        mrr = 0
        for subscription in subscriptions:
            plan = subscription.plan
            if plan is None:
                continue
            if plan.code == "free":
                continue
            mrr += self._plan_mrr_cents(plan, is_estimated=is_estimated)
            if plan.price_cents is None and plan.code in DEFAULT_PLAN_PRICES_CENTS:
                is_estimated = True
        return mrr, is_estimated

    def _revenue_by_plan(self, db: Session, is_estimated: bool) -> list[AdminPlanRevenueItem]:
        plans = db.scalars(select(Plan).where(Plan.active.is_(True))).all()
        items: list[AdminPlanRevenueItem] = []
        for plan in plans:
            if plan.code == "free":
                continue
            count = int(
                db.scalar(
                    select(func.count())
                    .select_from(Subscription)
                    .where(
                        Subscription.plan_id == plan.id,
                        Subscription.status.in_(ACTIVE_SUBSCRIPTION_STATUSES),
                    )
                )
                or 0
            )
            mrr_each = self._plan_mrr_cents(plan, is_estimated=is_estimated)
            items.append(
                AdminPlanRevenueItem(
                    plan_code=plan.code,
                    plan_name=plan.name,
                    subscriber_count=count,
                    mrr_contribution_cents=mrr_each * count,
                )
            )
        return items
