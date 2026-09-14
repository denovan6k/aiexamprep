from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, settings
from app.models import Plan, Subscription, User
from app.schemas.billing import (
    BillingInterval,
    CheckoutRequest,
    CheckoutResponse,
    Entitlements,
    PlanCode,
    PortalRequest,
    PortalResponse,
    UsageSummary,
)
from app.services.usage import ensure_default_plans


class WebhookSignatureError(Exception):
    """Raised when Stripe webhook signature verification fails."""


@dataclass(frozen=True)
class PlanDefinition:
    code: PlanCode
    name: str
    interval: BillingInterval
    price_cents: int | None
    price_setting_name: str | None
    features: tuple[str, ...]


class BillingService:
    def __init__(self, app_settings: Settings = settings) -> None:
        self.settings = app_settings

    def list_plans(self, current_plan_code: PlanCode = "free") -> list[Plan]:
        from app.schemas.billing import Plan as PlanSchema

        return [
            PlanSchema(
                code=plan.code,
                name=plan.name,
                interval=plan.interval,
                price_cents=plan.price_cents,
                stripe_price_id=self._price_id_for(plan),
                features=list(plan.features),
                is_current=plan.code == current_plan_code,
            )
            for plan in self._plan_definitions()
        ]

    def get_entitlements(self, plan_code: PlanCode = "free") -> Entitlements:
        entitlements_by_plan: dict[PlanCode, Entitlements] = {
            "free": Entitlements(
                plan_code="free",
                is_active=True,
                course_limit=3,
                material_upload_limit=10,
                quiz_generation_limit=20,
                professor_agent_limit=2,
                features=[
                    "Limited courses",
                    "Limited uploads",
                    "Limited quiz generations",
                    "Basic professor agents",
                ],
            ),
            "pro_monthly": self._pro_entitlements("pro_monthly"),
            "pro_yearly": self._pro_entitlements("pro_yearly"),
            "enterprise_monthly": self._enterprise_entitlements("enterprise_monthly"),
            "enterprise_yearly": self._enterprise_entitlements("enterprise_yearly"),
        }
        return entitlements_by_plan[plan_code]

    def get_usage_summary(self, plan_code: PlanCode = "free") -> UsageSummary:
        return UsageSummary(
            plan_code=plan_code,
            courses_used=0,
            material_uploads_used=0,
            quiz_generations_used=0,
            professor_agents_used=0,
            chat_prompts_used=0,
            generation_limit=None,
            generations_used=0,
            upload_limit=None,
            reset_at=None,
            credits_balance=0,
            credits_next_expiry_at=None,
            entitlements=self.get_entitlements(plan_code),
        )

    def create_checkout(
        self, request: CheckoutRequest, *, user_id: uuid.UUID | None = None
    ) -> CheckoutResponse:
        plan = self._plan_definition(request.plan_code)
        price_id = self._price_id_for(plan)
        if self._stripe_is_configured() and price_id:
            return self._create_stripe_checkout(request, price_id, user_id=user_id)

        return CheckoutResponse(
            checkout_url=self._placeholder_checkout_url(request, price_id),
            plan_code=request.plan_code,
            stripe_price_id=price_id,
            is_placeholder=True,
        )

    def create_portal_session(self, request: PortalRequest) -> PortalResponse:
        if self._stripe_is_configured() and request.customer_id:
            return self._create_stripe_portal_session(request)

        return PortalResponse(
            portal_url=self._placeholder_portal_url(request),
            is_placeholder=True,
        )

    def verify_webhook_signature(self, payload: bytes, signature: str) -> Any:
        if not self.settings.stripe_webhook_secret:
            raise ValueError("Stripe webhook secret is not configured.")

        import stripe

        stripe.api_key = self.settings.stripe_secret_key
        try:
            return stripe.Webhook.construct_event(
                payload,
                signature,
                self.settings.stripe_webhook_secret,
            )
        except stripe.error.SignatureVerificationError as exc:
            raise WebhookSignatureError(str(exc)) from exc

    def handle_webhook_event(self, event: Any, db: Session) -> None:
        ensure_default_plans(db)
        db.flush()
        event_type = self._event_value(event, "type")
        data_object = self._event_value(self._event_value(event, "data"), "object")

        if event_type == "checkout.session.completed":
            self._handle_checkout_completed(db, data_object)
        elif event_type == "customer.subscription.created":
            self._handle_subscription_created(db, data_object)
        elif event_type == "customer.subscription.updated":
            self._handle_subscription_updated(db, data_object)
        elif event_type == "customer.subscription.deleted":
            self._handle_subscription_deleted(db, data_object)

    def _handle_checkout_completed(self, db: Session, session: Any) -> None:
        if self._event_value(session, "mode") != "subscription":
            return

        stripe_subscription_id = self._event_value(session, "subscription")
        stripe_customer_id = self._event_value(session, "customer")
        if not stripe_subscription_id or not stripe_customer_id:
            return

        metadata = self._event_value(session, "metadata") or {}
        plan_code = self._metadata_value(metadata, "plan_code")
        user_id = self._resolve_user_id(
            db,
            user_id=self._metadata_value(metadata, "user_id"),
            customer_email=self._checkout_customer_email(session),
        )
        if user_id is None:
            return

        plan = self._plan_for_code(db, plan_code) if plan_code else None
        subscription = self._find_or_create_subscription(
            db,
            user_id=user_id,
            stripe_subscription_id=stripe_subscription_id,
        )
        subscription.stripe_customer_id = stripe_customer_id
        subscription.stripe_subscription_id = stripe_subscription_id
        subscription.status = "active"
        if plan is not None:
            subscription.plan_id = plan.id

    def _handle_subscription_created(self, db: Session, stripe_sub: Any) -> None:
        stripe_subscription_id = self._event_value(stripe_sub, "id")
        stripe_customer_id = self._event_value(stripe_sub, "customer")
        if not stripe_subscription_id or not stripe_customer_id:
            return

        metadata = self._event_value(stripe_sub, "metadata") or {}
        user_id = self._resolve_user_id(
            db,
            user_id=self._metadata_value(metadata, "user_id"),
            customer_email=self._metadata_value(metadata, "customer_email"),
        )

        subscription = db.scalar(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_subscription_id
            )
        )
        if subscription is None:
            subscription = db.scalar(
                select(Subscription)
                .where(Subscription.stripe_customer_id == stripe_customer_id)
                .order_by(Subscription.created_at.desc())
            )

        if subscription is None:
            if user_id is None:
                return
            subscription = Subscription(user_id=user_id)
            db.add(subscription)

        subscription.stripe_customer_id = stripe_customer_id
        subscription.stripe_subscription_id = stripe_subscription_id
        subscription.status = self._event_value(stripe_sub, "status") or "active"
        subscription.current_period_start = self._from_unix(
            self._event_value(stripe_sub, "current_period_start")
        )
        subscription.current_period_end = self._from_unix(
            self._event_value(stripe_sub, "current_period_end")
        )
        subscription.cancel_at_period_end = bool(
            self._event_value(stripe_sub, "cancel_at_period_end") or False
        )

        plan_code = self._metadata_value(metadata, "plan_code")
        plan = self._plan_for_code(db, plan_code) if plan_code else None
        price_id = self._subscription_price_id(stripe_sub)
        if plan is None and price_id:
            plan = self._plan_for_price_id(db, price_id)
        if plan is not None:
            subscription.plan_id = plan.id
            self._sync_plan_price_from_stripe_sub(db, plan, stripe_sub)

    def _handle_subscription_updated(self, db: Session, stripe_sub: Any) -> None:
        stripe_subscription_id = self._event_value(stripe_sub, "id")
        if not stripe_subscription_id:
            return

        subscription = db.scalar(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_subscription_id
            )
        )
        if subscription is None:
            stripe_customer_id = self._event_value(stripe_sub, "customer")
            if not stripe_customer_id:
                return
            subscription = db.scalar(
                select(Subscription).where(
                    Subscription.stripe_customer_id == stripe_customer_id
                )
            )
            if subscription is None:
                return
            subscription.stripe_subscription_id = stripe_subscription_id

        subscription.stripe_customer_id = self._event_value(stripe_sub, "customer")
        subscription.status = self._event_value(stripe_sub, "status") or subscription.status
        subscription.current_period_start = self._from_unix(
            self._event_value(stripe_sub, "current_period_start")
        )
        subscription.current_period_end = self._from_unix(
            self._event_value(stripe_sub, "current_period_end")
        )
        subscription.cancel_at_period_end = bool(
            self._event_value(stripe_sub, "cancel_at_period_end") or False
        )

        price_id = self._subscription_price_id(stripe_sub)
        if price_id:
            plan = self._plan_for_price_id(db, price_id)
            if plan is not None:
                subscription.plan_id = plan.id
                self._sync_plan_price_from_stripe_sub(db, plan, stripe_sub)

    def _handle_subscription_deleted(self, db: Session, stripe_sub: Any) -> None:
        stripe_subscription_id = self._event_value(stripe_sub, "id")
        if not stripe_subscription_id:
            return

        subscription = db.scalar(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_subscription_id
            )
        )
        if subscription is None:
            return

        subscription.status = "canceled"
        subscription.cancel_at_period_end = False

    def _resolve_user_id(
        self,
        db: Session,
        *,
        user_id: str | None,
        customer_email: str | None,
    ) -> uuid.UUID | None:
        if user_id:
            try:
                return uuid.UUID(user_id)
            except ValueError:
                pass

        if customer_email:
            normalized = customer_email.strip().lower()
            user = db.scalar(select(User).where(User.email == normalized))
            if user is not None:
                return user.id

        return None

    def _find_or_create_subscription(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        stripe_subscription_id: str,
    ) -> Subscription:
        existing = db.scalar(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_subscription_id
            )
        )
        if existing is not None:
            return existing

        existing = db.scalar(
            select(Subscription)
            .where(Subscription.user_id == user_id)
            .order_by(Subscription.created_at.desc())
        )
        if existing is not None:
            return existing

        subscription = Subscription(user_id=user_id)
        db.add(subscription)
        return subscription

    def _plan_for_code(self, db: Session, plan_code: str | None) -> Plan | None:
        if not plan_code:
            return None
        return db.scalar(select(Plan).where(Plan.code == plan_code))

    def _plan_for_price_id(self, db: Session, price_id: str) -> Plan | None:
        plan = db.scalar(select(Plan).where(Plan.stripe_price_id == price_id))
        if plan is not None:
            return plan

        code_by_price = {
            self.settings.stripe_pro_monthly_price_id: "pro_monthly",
            self.settings.stripe_pro_yearly_price_id: "pro_yearly",
            self.settings.stripe_enterprise_monthly_price_id: "enterprise_monthly",
            self.settings.stripe_enterprise_yearly_price_id: "enterprise_yearly",
        }
        plan_code = code_by_price.get(price_id)
        if plan_code:
            return db.scalar(select(Plan).where(Plan.code == plan_code))
        return None

    def _checkout_customer_email(self, session: Any) -> str | None:
        customer_details = self._event_value(session, "customer_details")
        if customer_details is not None:
            email = self._event_value(customer_details, "email")
            if email:
                return email
        return self._event_value(session, "customer_email")

    def _subscription_price_id(self, stripe_sub: Any) -> str | None:
        items = self._event_value(stripe_sub, "items")
        if items is None:
            return None
        data = self._event_value(items, "data") or []
        if not data:
            return None
        first_item = data[0]
        price = self._event_value(first_item, "price")
        if price is None:
            return None
        return self._event_value(price, "id")

    def _subscription_price_amount(self, stripe_sub: Any) -> int | None:
        items = self._event_value(stripe_sub, "items")
        if items is None:
            return None
        data = self._event_value(items, "data") or []
        if not data:
            return None
        first_item = data[0]
        price = self._event_value(first_item, "price")
        if price is None:
            return None
        amount = self._event_value(price, "unit_amount")
        if amount is None:
            return None
        try:
            return int(amount)
        except (TypeError, ValueError):
            return None

    def _sync_plan_price_from_stripe_sub(self, db: Session, plan: Plan, stripe_sub: Any) -> None:
        amount = self._subscription_price_amount(stripe_sub)
        if amount is not None and amount > 0:
            plan.price_cents = amount
            db.add(plan)

    def _metadata_value(self, metadata: Any, key: str) -> str | None:
        if metadata is None:
            return None
        if isinstance(metadata, dict):
            value = metadata.get(key)
        else:
            value = getattr(metadata, key, None)
        return str(value) if value else None

    def _event_value(self, obj: Any, key: str, default: Any = None) -> Any:
        if obj is None:
            return default
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    def _from_unix(self, timestamp: int | None) -> datetime | None:
        if timestamp is None:
            return None
        return datetime.fromtimestamp(timestamp, tz=UTC)

    def _stripe_is_configured(self) -> bool:
        return bool(self.settings.stripe_secret_key)

    def _price_id_for(self, plan: PlanDefinition) -> str | None:
        if plan.price_setting_name is None:
            return None
        return getattr(self.settings, plan.price_setting_name) or None

    def _plan_definition(self, code: PlanCode) -> PlanDefinition:
        return next(plan for plan in self._plan_definitions() if plan.code == code)

    def _placeholder_checkout_url(self, request: CheckoutRequest, price_id: str | None) -> str:
        query = {
            "plan": request.plan_code,
            "mode": "checkout",
            "placeholder": "true",
        }
        if price_id:
            query["price_id"] = price_id
        if request.success_url:
            query["success_url"] = str(request.success_url)
        if request.cancel_url:
            query["cancel_url"] = str(request.cancel_url)
        if request.customer_email:
            query["customer_email"] = request.customer_email
        return f"https://billing.knorvex.local/checkout?{urlencode(query)}"

    def _placeholder_portal_url(self, request: PortalRequest) -> str:
        query = {
            "mode": "portal",
            "placeholder": "true",
        }
        if request.return_url:
            query["return_url"] = str(request.return_url)
        if request.customer_id:
            query["customer_id"] = request.customer_id
        if request.customer_email:
            query["customer_email"] = request.customer_email
        return f"https://billing.knorvex.local/portal?{urlencode(query)}"

    def _create_stripe_checkout(
        self,
        request: CheckoutRequest,
        price_id: str,
        *,
        user_id: uuid.UUID | None = None,
    ) -> CheckoutResponse:
        import stripe

        stripe.api_key = self.settings.stripe_secret_key
        checkout_params: dict[str, Any] = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": str(request.success_url)
            if request.success_url
            else "https://app.knorvex.local/billing/success?session_id={CHECKOUT_SESSION_ID}",
            "cancel_url": str(request.cancel_url)
            if request.cancel_url
            else "https://app.knorvex.local/billing",
            "metadata": {
                "plan_code": request.plan_code,
                **({"user_id": str(user_id)} if user_id else {}),
            },
            "subscription_data": {
                "metadata": {
                    "plan_code": request.plan_code,
                    **({"user_id": str(user_id)} if user_id else {}),
                },
            },
        }
        if request.customer_email:
            checkout_params["customer_email"] = request.customer_email

        session = stripe.checkout.Session.create(**checkout_params)
        if not session.url:
            raise RuntimeError("Stripe checkout session did not include a URL.")

        return CheckoutResponse(
            checkout_url=session.url,
            plan_code=request.plan_code,
            stripe_price_id=price_id,
            is_placeholder=False,
        )

    def _create_stripe_portal_session(self, request: PortalRequest) -> PortalResponse:
        import stripe

        stripe.api_key = self.settings.stripe_secret_key
        session = stripe.billing_portal.Session.create(
            customer=request.customer_id,
            return_url=str(request.return_url)
            if request.return_url
            else "https://app.knorvex.local/settings/billing",
        )
        if not session.url:
            raise RuntimeError("Stripe billing portal session did not include a URL.")

        return PortalResponse(portal_url=session.url, is_placeholder=False)

    def _pro_entitlements(self, plan_code: PlanCode) -> Entitlements:
        return Entitlements(
            plan_code=plan_code,
            is_active=True,
            course_limit=None,
            material_upload_limit=None,
            quiz_generation_limit=None,
            professor_agent_limit=None,
            features=[
                "Higher upload limits",
                "Advanced quiz customization",
                "More professor agents",
                "Richer progress insights",
            ],
        )

    def _plan_definitions(self) -> tuple[PlanDefinition, ...]:
        return (
            PlanDefinition(
                code="free",
                name="Free",
                interval="none",
                price_cents=0,
                price_setting_name=None,
                features=(
                    "Limited courses",
                    "Limited uploads",
                    "Limited quiz generations",
                    "Basic professor agents",
                ),
            ),
            PlanDefinition(
                code="pro_monthly",
                name="Pro Monthly",
                interval="month",
                price_cents=None,
                price_setting_name="stripe_pro_monthly_price_id",
                features=(
                    "Higher upload limits",
                    "Advanced quiz customization",
                    "More professor agents",
                    "Richer progress insights",
                ),
            ),
            PlanDefinition(
                code="pro_yearly",
                name="Pro Yearly",
                interval="year",
                price_cents=None,
                price_setting_name="stripe_pro_yearly_price_id",
                features=(
                    "Everything in Pro Monthly",
                    "Yearly billing",
                    "Best value for long exam cycles",
                ),
            ),
            PlanDefinition(
                code="enterprise_monthly",
                name="Enterprise Monthly",
                interval="month",
                price_cents=None,
                price_setting_name="stripe_enterprise_monthly_price_id",
                features=(
                    "Unlimited courses and uploads",
                    "Unlimited quiz and flashcard generations",
                    "Unlimited professor agents",
                    "Priority support",
                ),
            ),
            PlanDefinition(
                code="enterprise_yearly",
                name="Enterprise Yearly",
                interval="year",
                price_cents=None,
                price_setting_name="stripe_enterprise_yearly_price_id",
                features=(
                    "Everything in Enterprise Monthly",
                    "Yearly billing",
                    "Dedicated onboarding support",
                ),
            ),
        )

    def _enterprise_entitlements(self, plan_code: PlanCode) -> Entitlements:
        return Entitlements(
            plan_code=plan_code,
            is_active=True,
            course_limit=None,
            material_upload_limit=None,
            quiz_generation_limit=None,
            professor_agent_limit=None,
            features=[
                "Unlimited courses and uploads",
                "Unlimited generations",
                "Unlimited professor agents",
                "Priority support",
            ],
        )
