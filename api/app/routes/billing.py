from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Subscription, User
from app.schemas.billing import (
    CreditPurchaseRequest,
    CreditPurchaseResponse,
    CheckoutRequest,
    CheckoutResponse,
    Entitlements,
    Plan,
    PortalRequest,
    PortalResponse,
    UsageHistoryResponse,
    UsageSummary,
)
from app.services.billing import BillingService, WebhookSignatureError
from app.services import credits as credits_service
from app.services.usage import (
    current_plan_code,
    current_usage_window,
    get_limit_for_event,
    usage_count_in_window,
    usage_history,
)

router = APIRouter()
billing_service = BillingService()


@router.get("/plans", response_model=list[Plan])
def list_plans(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Plan]:
    return billing_service.list_plans(current_plan_code(db, user.id))


@router.get("/entitlements", response_model=Entitlements)
def get_entitlements(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Entitlements:
    return billing_service.get_entitlements(current_plan_code(db, user.id))


@router.get("/usage", response_model=UsageSummary)
def get_usage(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UsageSummary:
    plan_code = current_plan_code(db, user.id)
    window = current_usage_window(db, user.id)
    uploads_used = usage_count_in_window(db, user.id, "material_upload", window=window)
    chat_used = usage_count_in_window(db, user.id, "chat_prompt", window=window)
    return UsageSummary(
        plan_code=plan_code,
        courses_used=usage_count_in_window(db, user.id, "course_create", window=window),
        material_uploads_used=uploads_used,
        # Back-compat: the UI historically called these “quiz generations”.
        # We now consume a single generation quota for both quiz + flashcard
        # generation, tracked under `chat_prompt`.
        quiz_generations_used=chat_used,
        professor_agents_used=usage_count_in_window(db, user.id, "agent_create", window=window),
        chat_prompts_used=chat_used,
        generations_used=chat_used,
        generation_limit=get_limit_for_event(db, user.id, "chat_prompt"),
        upload_limit=get_limit_for_event(db, user.id, "material_upload"),
        reset_at=window.end,
        credits_balance=credits_service.balance(db, user.id),
        credits_next_expiry_at=credits_service.next_expiry(db, user.id),
        entitlements=billing_service.get_entitlements(plan_code),
    )


@router.get("/usage/history", response_model=UsageHistoryResponse)
def get_usage_history(
    days: int = Query(default=30, ge=1, le=90),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UsageHistoryResponse:
    return UsageHistoryResponse.model_validate(usage_history(db, user.id, days=days))


@router.post("/credits/purchase", response_model=CreditPurchaseResponse, status_code=status.HTTP_201_CREATED)
def purchase_credits(
    request: CreditPurchaseRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreditPurchaseResponse:
    grant = credits_service.create_grant(
        db,
        user.id,
        request.credits,
        source="manual_purchase",
        description=request.description or "Manual credit purchase",
    )
    db.commit()
    return CreditPurchaseResponse(
        granted_credits=grant.credits_total,
        credits_balance=credits_service.balance(db, user.id),
        expires_at=grant.expires_at,
    )


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    request: CheckoutRequest,
    user: User = Depends(get_current_user),
) -> CheckoutResponse:
    request.customer_email = request.customer_email or user.email
    return billing_service.create_checkout(request, user_id=user.id)


@router.post("/portal", response_model=PortalResponse)
def create_portal(
    request: PortalRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PortalResponse:
    request.customer_email = request.customer_email or user.email
    if not request.customer_id:
        subscription = db.scalar(
            select(Subscription)
            .where(Subscription.user_id == user.id, Subscription.stripe_customer_id.is_not(None))
            .order_by(Subscription.created_at.desc())
        )
        if subscription is not None:
            request.customer_id = subscription.stripe_customer_id
    return billing_service.create_portal_session(request)


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> dict[str, str]:
    payload = await request.body()
    try:
        event = billing_service.verify_webhook_signature(payload, stripe_signature or "")
    except ValueError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except WebhookSignatureError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    try:
        billing_service.handle_webhook_event(event, db)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"status": "ok"}
