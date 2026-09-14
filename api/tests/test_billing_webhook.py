from __future__ import annotations

import uuid
from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import Settings
from app.main import app
from app.models.entities import Base, Plan, Subscription, User
from app.routes import billing as billing_routes
from app.services.billing import BillingService, WebhookSignatureError

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
BILLING_TABLES = [
    Subscription.__table__,
    Plan.__table__,
    User.__table__,
]


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    Base.metadata.drop_all(bind=engine, tables=BILLING_TABLES)
    Base.metadata.create_all(bind=engine, tables=list(reversed(BILLING_TABLES)))
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[billing_routes.get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def billing_settings() -> Settings:
    return Settings(
        stripe_secret_key="sk_test_example",
        stripe_webhook_secret="whsec_test_example",
        stripe_pro_monthly_price_id="price_monthly_test",
        stripe_pro_yearly_price_id="price_yearly_test",
    )


@pytest.fixture()
def test_user(db: Session) -> User:
    user = User(
        id=uuid.uuid4(),
        name="Ada Student",
        email="student@example.com",
        password_hash="hashed",
    )
    db.add(user)
    db.commit()
    return user


def _checkout_completed_event(
    *,
    user_id: uuid.UUID,
    customer_id: str = "cus_test_123",
    subscription_id: str = "sub_test_123",
    plan_code: str = "pro_monthly",
) -> dict:
    return {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "mode": "subscription",
                "customer": customer_id,
                "subscription": subscription_id,
                "customer_email": "student@example.com",
                "metadata": {
                    "user_id": str(user_id),
                    "plan_code": plan_code,
                },
            }
        },
    }


def _error_text(response) -> str:
    payload = response.json()
    if "detail" in payload:
        return str(payload["detail"])
    error = payload.get("error") or {}
    return str(error.get("message") or error.get("detail") or payload)


def _subscription_updated_event(
    *,
    subscription_id: str = "sub_test_123",
    customer_id: str = "cus_test_123",
    status: str = "active",
    price_id: str = "price_monthly_test",
) -> dict:
    return {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": subscription_id,
                "customer": customer_id,
                "status": status,
                "current_period_start": 1_700_000_000,
                "current_period_end": 1_700_086_400,
                "cancel_at_period_end": True,
                "items": {
                    "data": [{"price": {"id": price_id}}],
                },
            }
        },
    }


def _subscription_created_event(
    *,
    user_id: uuid.UUID,
    subscription_id: str = "sub_created_123",
    customer_id: str = "cus_created_123",
    status: str = "trialing",
    price_id: str = "price_yearly_test",
) -> dict:
    return {
        "type": "customer.subscription.created",
        "data": {
            "object": {
                "id": subscription_id,
                "customer": customer_id,
                "status": status,
                "current_period_start": 1_700_000_000,
                "current_period_end": 1_702_592_000,
                "cancel_at_period_end": False,
                "metadata": {"user_id": str(user_id)},
                "items": {
                    "data": [{"price": {"id": price_id}}],
                },
            }
        },
    }


def _subscription_deleted_event(*, subscription_id: str = "sub_test_123") -> dict:
    return {
        "type": "customer.subscription.deleted",
        "data": {"object": {"id": subscription_id}},
    }


def test_verify_webhook_signature_rejects_invalid_signature(
    billing_settings: Settings,
) -> None:
    import stripe

    service = BillingService(billing_settings)

    with patch(
        "stripe.Webhook.construct_event",
        side_effect=stripe.error.SignatureVerificationError("bad sig", sig_header="bad"),
    ):
        with pytest.raises(WebhookSignatureError):
            service.verify_webhook_signature(b"{}", "bad-signature")


def test_checkout_completed_creates_subscription(
    db: Session,
    test_user: User,
    billing_settings: Settings,
) -> None:
    service = BillingService(billing_settings)
    event = _checkout_completed_event(user_id=test_user.id)

    service.handle_webhook_event(event, db)
    db.commit()

    subscription = db.query(Subscription).one()
    assert subscription.user_id == test_user.id
    assert subscription.stripe_customer_id == "cus_test_123"
    assert subscription.stripe_subscription_id == "sub_test_123"
    assert subscription.status == "active"
    assert subscription.plan is not None
    assert subscription.plan.code == "pro_monthly"


def test_checkout_completed_links_user_by_email_when_metadata_missing(
    db: Session,
    test_user: User,
    billing_settings: Settings,
) -> None:
    service = BillingService(billing_settings)
    event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "mode": "subscription",
                "customer": "cus_email_lookup",
                "subscription": "sub_email_lookup",
                "customer_details": {"email": "Student@Example.com"},
                "metadata": {"plan_code": "pro_yearly"},
            }
        },
    }

    service.handle_webhook_event(event, db)
    db.commit()

    subscription = db.query(Subscription).one()
    assert subscription.user_id == test_user.id
    assert subscription.plan is not None
    assert subscription.plan.code == "pro_yearly"


def test_subscription_created_creates_subscription_from_stripe_event(
    db: Session,
    test_user: User,
    billing_settings: Settings,
) -> None:
    service = BillingService(billing_settings)

    service.handle_webhook_event(_subscription_created_event(user_id=test_user.id), db)
    db.commit()

    subscription = db.query(Subscription).one()
    assert subscription.user_id == test_user.id
    assert subscription.stripe_customer_id == "cus_created_123"
    assert subscription.stripe_subscription_id == "sub_created_123"
    assert subscription.status == "trialing"
    assert subscription.current_period_start is not None
    assert subscription.current_period_end is not None
    assert subscription.plan is not None
    assert subscription.plan.code == "pro_yearly"


def test_subscription_updated_persists_state(
    db: Session,
    test_user: User,
    billing_settings: Settings,
) -> None:
    service = BillingService(billing_settings)
    service.handle_webhook_event(_checkout_completed_event(user_id=test_user.id), db)
    db.commit()

    service.handle_webhook_event(_subscription_updated_event(status="past_due"), db)
    db.commit()

    subscription = db.query(Subscription).one()
    assert subscription.status == "past_due"
    assert subscription.cancel_at_period_end is True
    assert subscription.current_period_start is not None
    assert subscription.current_period_end is not None


def test_subscription_deleted_marks_canceled(
    db: Session,
    test_user: User,
    billing_settings: Settings,
) -> None:
    service = BillingService(billing_settings)
    service.handle_webhook_event(_checkout_completed_event(user_id=test_user.id), db)
    db.commit()

    service.handle_webhook_event(_subscription_deleted_event(), db)
    db.commit()

    subscription = db.query(Subscription).one()
    assert subscription.status == "canceled"


def test_webhook_route_returns_200_and_persists_subscription(
    client: TestClient,
    db: Session,
    test_user: User,
    billing_settings: Settings,
) -> None:
    event = _checkout_completed_event(user_id=test_user.id)
    billing_service = BillingService(billing_settings)

    with patch.object(
        billing_service,
        "verify_webhook_signature",
        return_value=event,
    ):
        billing_routes.billing_service = billing_service
        response = client.post(
            "/billing/webhook",
            data=b"{}",
            headers={"Stripe-Signature": "sig_test"},
        )

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    subscription = db.query(Subscription).one()
    assert subscription.stripe_subscription_id == "sub_test_123"
    assert subscription.status == "active"


def test_webhook_route_rejects_invalid_signature(
    client: TestClient,
    billing_settings: Settings,
) -> None:
    billing_service = BillingService(billing_settings)

    with patch.object(
        billing_service,
        "verify_webhook_signature",
        side_effect=WebhookSignatureError("invalid signature"),
    ):
        billing_routes.billing_service = billing_service
        response = client.post(
            "/billing/webhook",
            data=b"{}",
            headers={"Stripe-Signature": "bad"},
    )

    assert response.status_code == 400
    assert "invalid signature" in _error_text(response)
