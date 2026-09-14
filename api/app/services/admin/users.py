from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.roles import ROLE_SUPER_ADMIN, ROLE_USER
from app.models import (
    AuthSession,
    ChatThread,
    Course,
    ModerationAppeal,
    Plan,
    Subscription,
    SupportTicket,
    UsageEvent,
    User,
)
from app.schemas.admin import (
    AdminGrantSubscriptionRequest,
    AdminUpdateUserRequest,
    AdminUserActivityCounts,
    AdminUserDetail,
    AdminUserListItem,
    AdminUserSubscriptionSummary,
    AdminUserUsageSummary,
)
from app.schemas.pagination import PaginatedResponse
from app.services.admin.audit import AdminAuditService
from app.services.usage import ACTIVE_SUBSCRIPTION_STATUSES, current_plan_code, month_start, usage_count


class AdminUsersService:
    def __init__(self) -> None:
        self.audit = AdminAuditService()

    def list_users(
        self,
        db: Session,
        *,
        q: str | None = None,
        role: str | None = None,
        plan: str | None = None,
        is_active: bool | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> PaginatedResponse[AdminUserListItem]:
        query = select(User)
        if q:
            pattern = f"%{q.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(User.email).like(pattern),
                    func.lower(User.name).like(pattern),
                )
            )
        if role:
            query = query.where(User.role == role)
        if is_active is not None:
            query = query.where(User.is_active == is_active)

        users = db.scalars(query.order_by(User.created_at.desc())).all()
        items: list[AdminUserListItem] = []
        for user in users:
            plan_code = current_plan_code(db, user.id)
            if plan and plan_code != plan:
                continue
            items.append(self._list_item(db, user, plan_code))

        total = len(items)
        page = items[offset : offset + limit]
        return PaginatedResponse(items=page, total=total, limit=limit, offset=offset)

    def get_user(self, db: Session, user_id: uuid.UUID) -> AdminUserDetail:
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"User {user_id} was not found.")
        return self._detail(db, user)

    def update_user(
        self,
        db: Session,
        *,
        admin: User,
        user_id: uuid.UUID,
        request: AdminUpdateUserRequest,
    ) -> AdminUserDetail:
        if admin.id == user_id:
            if request.is_active is False:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="You cannot suspend your own account.",
                )
            if request.role is not None and request.role != ROLE_SUPER_ADMIN:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="You cannot remove your own super admin role.",
                )

        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"User {user_id} was not found.")

        changes: dict[str, object] = {}
        if request.role is not None and request.role in {ROLE_USER, ROLE_SUPER_ADMIN}:
            changes["role"] = request.role
            user.role = request.role
        if request.is_active is not None:
            changes["is_active"] = request.is_active
            user.is_active = request.is_active

        if changes:
            self.audit.log(
                db,
                admin=admin,
                action="user.update",
                target_type="user",
                target_id=user.id,
                metadata=changes,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        return self._detail(db, user)

    def revoke_sessions(
        self,
        db: Session,
        *,
        admin: User,
        user_id: uuid.UUID,
    ) -> int:
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"User {user_id} was not found.")

        now = datetime.now(UTC)
        sessions = db.scalars(
            select(AuthSession).where(
                AuthSession.user_id == user_id,
                AuthSession.revoked_at.is_(None),
            )
        ).all()
        count = 0
        for session in sessions:
            session.revoked_at = now
            count += 1

        self.audit.log(
            db,
            admin=admin,
            action="user.revoke_sessions",
            target_type="user",
            target_id=user_id,
            metadata={"sessions_revoked": count},
        )
        db.commit()
        return count

    def grant_subscription(
        self,
        db: Session,
        *,
        admin: User,
        user_id: uuid.UUID,
        request: AdminGrantSubscriptionRequest,
    ) -> AdminUserDetail:
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"User {user_id} was not found.")

        plan = db.scalar(select(Plan).where(Plan.code == request.plan_code))
        if plan is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Plan {request.plan_code} was not found.")

        subscription = db.scalar(
            select(Subscription)
            .where(Subscription.user_id == user_id)
            .order_by(Subscription.created_at.desc())
        )
        if subscription is None:
            subscription = Subscription(user_id=user_id)
            db.add(subscription)

        if request.plan_code == "free":
            subscription.status = "canceled"
            subscription.plan_id = plan.id
        else:
            subscription.status = request.status
            subscription.plan_id = plan.id
            subscription.current_period_start = datetime.now(UTC)
            subscription.current_period_end = datetime.now(UTC) + timedelta(days=365 if request.plan_code == "pro_yearly" else 30)
            subscription.cancel_at_period_end = False

        self.audit.log(
            db,
            admin=admin,
            action="user.grant_subscription",
            target_type="user",
            target_id=user_id,
            metadata={"plan_code": request.plan_code, "status": request.status},
        )
        db.commit()
        db.refresh(user)
        return self._detail(db, user)

    def get_usage(self, db: Session, user_id: uuid.UUID) -> AdminUserUsageSummary:
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"User {user_id} was not found.")

        plan_code = current_plan_code(db, user_id)
        chat_messages = int(
            db.scalar(
                select(func.count())
                .select_from(UsageEvent)
                .where(
                    UsageEvent.user_id == user_id,
                    UsageEvent.event_type == "chat_message",
                    UsageEvent.created_at >= month_start(),
                )
            )
            or 0
        )
        return AdminUserUsageSummary(
            plan_code=plan_code,
            courses_used=usage_count(db, user_id, "course_create"),
            material_uploads_used=usage_count(db, user_id, "material_upload"),
            # Generation quota is unified under `chat_prompt`.
            quiz_generations_used=usage_count(db, user_id, "chat_prompt"),
            flashcard_generations_used=0,
            agent_creates_used=usage_count(db, user_id, "agent_create"),
            chat_messages_used=chat_messages,
        )

    def _list_item(self, db: Session, user: User, plan_code: str) -> AdminUserListItem:
        return AdminUserListItem(
            id=user.id,
            email=user.email,
            full_name=user.name,
            role=user.role,
            is_active=user.is_active,
            plan_code=plan_code,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    def _detail(self, db: Session, user: User) -> AdminUserDetail:
        plan_code = current_plan_code(db, user.id)
        subscription = db.scalar(
            select(Subscription)
            .where(Subscription.user_id == user.id)
            .order_by(Subscription.created_at.desc())
        )
        sub_summary = AdminUserSubscriptionSummary(plan_code=plan_code)
        if subscription is not None:
            sub_summary = AdminUserSubscriptionSummary(
                plan_code=subscription.plan.code if subscription.plan else plan_code,
                plan_name=subscription.plan.name if subscription.plan else None,
                status=subscription.status,
                stripe_customer_id=subscription.stripe_customer_id,
                stripe_subscription_id=subscription.stripe_subscription_id,
                current_period_start=subscription.current_period_start,
                current_period_end=subscription.current_period_end,
                cancel_at_period_end=subscription.cancel_at_period_end,
            )

        active_sessions = int(
            db.scalar(
                select(func.count())
                .select_from(AuthSession)
                .where(
                    AuthSession.user_id == user.id,
                    AuthSession.revoked_at.is_(None),
                    AuthSession.expires_at > datetime.now(UTC),
                )
            )
            or 0
        )

        activity = AdminUserActivityCounts(
            courses=int(db.scalar(select(func.count()).select_from(Course).where(Course.user_id == user.id)) or 0),
            chat_threads=int(
                db.scalar(select(func.count()).select_from(ChatThread).where(ChatThread.user_id == user.id)) or 0
            ),
            support_tickets=int(
                db.scalar(select(func.count()).select_from(SupportTicket).where(SupportTicket.user_id == user.id)) or 0
            ),
            moderation_appeals=int(
                db.scalar(select(func.count()).select_from(ModerationAppeal).where(ModerationAppeal.user_id == user.id))
                or 0
            ),
            usage_events_this_month=int(
                db.scalar(
                    select(func.coalesce(func.sum(UsageEvent.quantity), 0)).where(
                        UsageEvent.user_id == user.id,
                        UsageEvent.created_at >= month_start(),
                    )
                )
                or 0
            ),
        )

        institution_name = user.institution.name if user.institution else None
        return AdminUserDetail(
            id=user.id,
            email=user.email,
            full_name=user.name,
            role=user.role,
            is_active=user.is_active,
            is_email_verified=user.email_verified_at is not None,
            institution_id=user.institution_id,
            institution_name=institution_name,
            created_at=user.created_at,
            updated_at=user.updated_at,
            active_sessions=active_sessions,
            subscription=sub_summary,
            activity=activity,
        )
