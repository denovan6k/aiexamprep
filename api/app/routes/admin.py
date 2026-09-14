from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.core.database import get_db
from app.core.deps import require_super_admin
from app.models import User
from app.schemas.admin import (
    AdminAnalyticsOverview,
    AdminChatMessage,
    AdminChatThreadSummary,
    AdminContentReportResponse,
    AdminGrantSubscriptionRequest,
    AdminGrowthResponse,
    AdminReportResolveRequest,
    AdminRevenueBreakdown,
    AdminSubscriptionListItem,
    AdminUpdateUserRequest,
    AdminUsageAggregateResponse,
    AdminUserDetail,
    AdminUserListItem,
    AdminUserUsageSummary,
    ModerationAppealResolveRequest,
    ModerationAppealResponse,
    SupportTicketResponse,
    SupportTicketUpdateRequest,
)
from app.schemas.pagination import DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, PaginatedResponse
from app.services.admin import (
    AdminAnalyticsService,
    AdminChatService,
    AdminModerationService,
    AdminSupportService,
    AdminUsersService,
)
from sqlalchemy.orm import Session

router = APIRouter()

users_service = AdminUsersService()
analytics_service = AdminAnalyticsService()
moderation_service = AdminModerationService()
support_service = AdminSupportService()
chat_service = AdminChatService()


@router.get("/users", response_model=PaginatedResponse[AdminUserListItem])
def list_users(
    q: str | None = None,
    role: str | None = None,
    plan: str | None = None,
    is_active: bool | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> PaginatedResponse[AdminUserListItem]:
    return users_service.list_users(
        db,
        q=q,
        role=role,
        plan=plan,
        is_active=is_active,
        offset=offset,
        limit=limit,
    )


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def get_user(
    user_id: uuid.UUID,
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> AdminUserDetail:
    return users_service.get_user(db, user_id)


@router.patch("/users/{user_id}", response_model=AdminUserDetail)
def update_user(
    user_id: uuid.UUID,
    request: AdminUpdateUserRequest,
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> AdminUserDetail:
    return users_service.update_user(db, admin=admin, user_id=user_id, request=request)


@router.post("/users/{user_id}/revoke-sessions")
def revoke_user_sessions(
    user_id: uuid.UUID,
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    count = users_service.revoke_sessions(db, admin=admin, user_id=user_id)
    return {"sessions_revoked": count}


@router.post("/users/{user_id}/grant-subscription", response_model=AdminUserDetail)
def grant_subscription(
    user_id: uuid.UUID,
    request: AdminGrantSubscriptionRequest,
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> AdminUserDetail:
    return users_service.grant_subscription(db, admin=admin, user_id=user_id, request=request)


@router.get("/users/{user_id}/usage", response_model=AdminUserUsageSummary)
def get_user_usage(
    user_id: uuid.UUID,
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> AdminUserUsageSummary:
    return users_service.get_usage(db, user_id)


@router.get("/users/{user_id}/chat-threads", response_model=PaginatedResponse[AdminChatThreadSummary])
def list_user_chat_threads(
    user_id: uuid.UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> PaginatedResponse[AdminChatThreadSummary]:
    return chat_service.list_threads(db, admin=admin, user_id=user_id, offset=offset, limit=limit)


@router.get(
    "/users/{user_id}/chat-threads/{thread_id}/messages",
    response_model=PaginatedResponse[AdminChatMessage],
)
def list_user_chat_messages(
    user_id: uuid.UUID,
    thread_id: uuid.UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> PaginatedResponse[AdminChatMessage]:
    return chat_service.list_messages(
        db,
        admin=admin,
        user_id=user_id,
        thread_id=thread_id,
        offset=offset,
        limit=limit,
    )


@router.get("/analytics/overview", response_model=AdminAnalyticsOverview)
def analytics_overview(
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> AdminAnalyticsOverview:
    return analytics_service.overview(db)


@router.get("/analytics/growth", response_model=AdminGrowthResponse)
def analytics_growth(
    days: int = Query(default=30, ge=1, le=365),
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> AdminGrowthResponse:
    return analytics_service.growth(db, days=days)


@router.get("/analytics/revenue", response_model=AdminRevenueBreakdown)
def analytics_revenue(
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> AdminRevenueBreakdown:
    return analytics_service.revenue(db)


@router.get("/analytics/usage", response_model=AdminUsageAggregateResponse)
def analytics_usage(
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> AdminUsageAggregateResponse:
    return analytics_service.usage_aggregate(db)


@router.get("/subscriptions", response_model=PaginatedResponse[AdminSubscriptionListItem])
def list_subscriptions(
    status: str | None = None,
    plan: str | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> PaginatedResponse[AdminSubscriptionListItem]:
    return analytics_service.list_subscriptions(
        db,
        status_filter=status,
        plan_code=plan,
        offset=offset,
        limit=limit,
    )


@router.get("/moderation/reports", response_model=PaginatedResponse[AdminContentReportResponse])
def list_moderation_reports(
    status: str | None = Query(default="open"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> PaginatedResponse[AdminContentReportResponse]:
    return moderation_service.list_reports(db, status_filter=status, offset=offset, limit=limit)


@router.post("/moderation/reports/{report_id}/resolve", response_model=AdminContentReportResponse)
def resolve_moderation_report(
    report_id: uuid.UUID,
    request: AdminReportResolveRequest,
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> AdminContentReportResponse:
    return moderation_service.resolve_report(db, admin=admin, report_id=report_id, request=request)


@router.get("/moderation/appeals", response_model=PaginatedResponse[ModerationAppealResponse])
def list_moderation_appeals(
    status: str | None = Query(default=None),
    user_id: uuid.UUID | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> PaginatedResponse[ModerationAppealResponse]:
    return moderation_service.list_appeals(
        db,
        status_filter=status,
        user_id=user_id,
        offset=offset,
        limit=limit,
    )


@router.post("/moderation/appeals/{appeal_id}/resolve", response_model=ModerationAppealResponse)
def resolve_moderation_appeal(
    appeal_id: uuid.UUID,
    request: ModerationAppealResolveRequest,
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> ModerationAppealResponse:
    return moderation_service.resolve_appeal(db, admin=admin, appeal_id=appeal_id, request=request)


@router.get("/support/tickets", response_model=PaginatedResponse[SupportTicketResponse])
def list_support_tickets(
    status: str | None = None,
    user_id: uuid.UUID | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> PaginatedResponse[SupportTicketResponse]:
    return support_service.list_tickets(
        db,
        status_filter=status,
        user_id=user_id,
        offset=offset,
        limit=limit,
    )


@router.get("/support/tickets/{ticket_id}", response_model=SupportTicketResponse)
def get_support_ticket(
    ticket_id: uuid.UUID,
    _admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> SupportTicketResponse:
    return support_service.get_ticket(db, ticket_id)


@router.patch("/support/tickets/{ticket_id}", response_model=SupportTicketResponse)
def update_support_ticket(
    ticket_id: uuid.UUID,
    request: SupportTicketUpdateRequest,
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> SupportTicketResponse:
    return support_service.update_ticket(db, admin=admin, ticket_id=ticket_id, request=request)
