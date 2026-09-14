from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SupportTicketCategory = Literal["general", "billing", "account", "product", "other"]
SupportTicketStatus = Literal["open", "in_progress", "resolved", "closed"]
SupportTicketPriority = Literal["low", "normal", "high"]

AppealType = Literal["account_suspension", "content_removal", "other"]
AppealStatus = Literal["pending", "approved", "rejected"]

PlatformRole = Literal["user", "super_admin"]


class AdminUserListItem(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    plan_code: str
    created_at: datetime
    updated_at: datetime


class AdminUserSubscriptionSummary(BaseModel):
    plan_code: str
    plan_name: str | None = None
    status: str | None = None
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancel_at_period_end: bool = False


class AdminUserActivityCounts(BaseModel):
    courses: int = 0
    chat_threads: int = 0
    support_tickets: int = 0
    moderation_appeals: int = 0
    usage_events_this_month: int = 0


class AdminUserDetail(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    is_email_verified: bool
    institution_id: uuid.UUID | None = None
    institution_name: str | None = None
    created_at: datetime
    updated_at: datetime
    active_sessions: int = 0
    subscription: AdminUserSubscriptionSummary
    activity: AdminUserActivityCounts


class AdminUpdateUserRequest(BaseModel):
    role: PlatformRole | None = None
    is_active: bool | None = None


class AdminGrantSubscriptionRequest(BaseModel):
    plan_code: Literal[
        "free",
        "pro_monthly",
        "pro_yearly",
        "enterprise_monthly",
        "enterprise_yearly",
    ] = "pro_monthly"
    status: Literal["active", "trialing"] = "active"


class AdminUserUsageSummary(BaseModel):
    plan_code: str
    courses_used: int = 0
    material_uploads_used: int = 0
    quiz_generations_used: int = 0
    flashcard_generations_used: int = 0
    agent_creates_used: int = 0
    chat_messages_used: int = 0


class AdminAnalyticsOverview(BaseModel):
    total_users: int
    active_users: int
    active_subscribers: int
    estimated_mrr_cents: int
    open_support_tickets: int
    open_appeals: int
    open_reports: int
    is_revenue_estimated: bool = True


class AdminGrowthPoint(BaseModel):
    date: str
    signups: int


class AdminGrowthResponse(BaseModel):
    days: int
    points: list[AdminGrowthPoint]


class AdminPlanRevenueItem(BaseModel):
    plan_code: str
    plan_name: str
    subscriber_count: int
    mrr_contribution_cents: int


class AdminRevenueBreakdown(BaseModel):
    estimated_mrr_cents: int
    estimated_arr_cents: int
    active_subscribers: int
    by_plan: list[AdminPlanRevenueItem]
    is_estimated: bool = True


class AdminUsageAggregateItem(BaseModel):
    event_type: str
    total_quantity: int


class AdminUsageAggregateResponse(BaseModel):
    items: list[AdminUsageAggregateItem]


class AdminSubscriptionListItem(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_email: str
    user_name: str
    plan_code: str | None
    plan_name: str | None
    status: str
    stripe_customer_id: str | None
    stripe_subscription_id: str | None
    current_period_end: datetime | None
    cancel_at_period_end: bool
    created_at: datetime


class SupportTicketCreateRequest(BaseModel):
    category: SupportTicketCategory = "general"
    subject: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1, max_length=10000)


class SupportTicketUpdateRequest(BaseModel):
    status: SupportTicketStatus | None = None
    priority: SupportTicketPriority | None = None
    assigned_admin_id: uuid.UUID | None = None
    admin_notes: str | None = Field(default=None, max_length=10000)


class SupportTicketResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_email: str | None = None
    user_name: str | None = None
    category: str
    subject: str
    body: str
    status: str
    priority: str
    assigned_admin_id: uuid.UUID | None = None
    admin_notes: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ModerationAppealCreateRequest(BaseModel):
    appeal_type: AppealType
    reason: str = Field(min_length=1, max_length=10000)
    reference_type: str | None = Field(default=None, max_length=50)
    reference_id: uuid.UUID | None = None


class ModerationAppealResolveRequest(BaseModel):
    status: Literal["approved", "rejected"]
    admin_response: str | None = Field(default=None, max_length=10000)


class ModerationAppealResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_email: str | None = None
    user_name: str | None = None
    appeal_type: str
    reference_type: str | None = None
    reference_id: uuid.UUID | None = None
    reason: str
    status: str
    reviewed_by_user_id: uuid.UUID | None = None
    admin_response: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AdminContentReportResponse(BaseModel):
    id: uuid.UUID
    reporter_id: uuid.UUID
    reporter_email: str | None = None
    target_type: str
    target_id: uuid.UUID
    reason: str
    details: str | None = None
    status: str
    created_at: datetime
    reviewed_at: datetime | None = None


class AdminReportResolveRequest(BaseModel):
    status: Literal["resolved", "dismissed"]
    notes: str | None = Field(default=None, max_length=5000)


class AdminChatThreadSummary(BaseModel):
    id: uuid.UUID
    title: str
    message_count: int
    created_at: datetime
    updated_at: datetime


class AdminChatMessage(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime
