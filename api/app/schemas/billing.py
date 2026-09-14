from datetime import datetime
from typing import Literal

from pydantic import BaseModel, HttpUrl


PlanCode = Literal[
    "free",
    "pro_monthly",
    "pro_yearly",
    "enterprise_monthly",
    "enterprise_yearly",
]
BillingInterval = Literal["none", "month", "year"]


class Plan(BaseModel):
    code: PlanCode
    name: str
    interval: BillingInterval
    price_cents: int | None
    stripe_price_id: str | None = None
    features: list[str]
    is_current: bool = False


class CheckoutRequest(BaseModel):
    plan_code: PlanCode
    success_url: HttpUrl | None = None
    cancel_url: HttpUrl | None = None
    customer_email: str | None = None


class CheckoutResponse(BaseModel):
    checkout_url: str
    plan_code: PlanCode
    stripe_price_id: str | None = None
    is_placeholder: bool


class PortalRequest(BaseModel):
    return_url: HttpUrl | None = None
    customer_id: str | None = None
    customer_email: str | None = None


class PortalResponse(BaseModel):
    portal_url: str
    is_placeholder: bool


class Entitlements(BaseModel):
    plan_code: PlanCode
    is_active: bool
    course_limit: int | None
    material_upload_limit: int | None
    quiz_generation_limit: int | None
    professor_agent_limit: int | None
    features: list[str]


class UsageSummary(BaseModel):
    plan_code: PlanCode
    courses_used: int
    material_uploads_used: int
    quiz_generations_used: int
    professor_agents_used: int
    chat_prompts_used: int = 0
    generation_limit: int | None = None
    generations_used: int = 0
    upload_limit: int | None = None
    reset_at: datetime | None = None
    credits_balance: int = 0
    credits_next_expiry_at: datetime | None = None
    entitlements: Entitlements


class UsageHistoryDayPoint(BaseModel):
    date: str
    total: int
    chat_prompts: int = 0
    material_uploads: int = 0
    course_creates: int = 0
    agent_creates: int = 0
    cv_tailorings: int = 0
    other: int = 0


class UsageHistoryTypePoint(BaseModel):
    event_type: str
    label: str
    total: int


class UsageHistoryResponse(BaseModel):
    days: int
    series: list[UsageHistoryDayPoint]
    by_type: list[UsageHistoryTypePoint]
    total_events: int


class CreditPurchaseRequest(BaseModel):
    credits: int
    description: str | None = None


class CreditPurchaseResponse(BaseModel):
    granted_credits: int
    credits_balance: int
    expires_at: datetime
