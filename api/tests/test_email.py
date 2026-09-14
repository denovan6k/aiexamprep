from unittest.mock import patch

import httpx
import pytest

from app.core.config import settings
from app.emails.renderer import render_template
from app.services.email import get_email_provider, reset_email_provider_for_tests
from app.services.email.base import OutboundEmail
from app.services.email.console import ConsoleEmailProvider
from app.services.email.resend import ResendEmailProvider
from app.services.email.smtp import SmtpEmailProvider


@pytest.fixture(autouse=True)
def _reset_email_provider() -> None:
    reset_email_provider_for_tests()
    yield
    reset_email_provider_for_tests()


def test_render_otp_template() -> None:
    subject, html, text = render_template(
        "otp.html",
        subject="Your Knorvex email verification code",
        intro_text="Use the code below to verify your email address.",
        code="123456",
        expires_minutes=10,
        recipient_name="Ada",
    )

    assert subject == "Your Knorvex email verification code"
    assert "123456" in html
    assert "123456" in text
    assert "Ada" in html
    assert "Knorvex" in html
    assert "Verification" in html
    assert "#7EE8D8" in html


def test_render_welcome_template() -> None:
    subject, html, text = render_template(
        "welcome.html",
        subject="Welcome to Knorvex, Ada!",
        recipient_name="Ada",
        verify_url="http://localhost:3000/email-verification?email=ada%40example.com",
    )

    assert subject == "Welcome to Knorvex, Ada!"
    assert "Welcome to Knorvex" in html
    assert "Verify your email" in html
    assert "Next steps" in html
    assert "verify" in text.lower()
    assert "Upload lecture notes" in text


def test_render_login_alert_template() -> None:
    subject, html, text = render_template(
        "login_alert.html",
        subject="New sign-in to your Knorvex account",
        recipient_name="Ada",
        login_time="August 10, 2026 at 14:00 UTC",
        ip_address="203.0.113.10",
        location="Kingston, Kingston, Jamaica",
        device="Chrome on Windows",
    )

    assert subject == "New sign-in to your Knorvex account"
    assert "203.0.113.10" in html
    assert "Kingston" in html
    assert "Chrome on Windows" in html
    assert "Chrome on Windows" in text
    assert "Security" in html
    assert "reset your password" in html.lower()
    assert "reset-password" in text


def test_render_contact_template() -> None:
    subject, html, text = render_template(
        "contact.html",
        subject="[Contact] Support from Ada",
        name="Ada Lovelace",
        email="ada@example.com",
        topic="support",
        message="I need help with uploads.",
    )

    assert subject == "[Contact] Support from Ada"
    assert "Ada Lovelace" in html
    assert "ada@example.com" in html
    assert "I need help with uploads." in html
    assert "Contact" in html
    assert "Ada Lovelace" in text


def test_get_email_provider_console(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "email_provider", "console")
    assert isinstance(get_email_provider(), ConsoleEmailProvider)


def test_get_email_provider_resend(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "email_provider", "resend")
    assert isinstance(get_email_provider(), ResendEmailProvider)


def test_get_email_provider_smtp(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "email_provider", "smtp")
    assert isinstance(get_email_provider(), SmtpEmailProvider)


def test_resend_provider_requires_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "email_provider", "resend")
    monkeypatch.setattr(settings, "resend_api_key", "")
    monkeypatch.setattr(settings, "email_from", "Knorvex <noreply@example.com>")

    provider = ResendEmailProvider()
    message = OutboundEmail(
        to="user@example.com",
        subject="Test",
        html="<p>Hi</p>",
        text="Hi",
    )

    with pytest.raises(RuntimeError, match="RESEND_API_KEY"):
        provider.send(message)


def test_resend_provider_posts_to_api(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "resend_api_key", "re_test_key")
    monkeypatch.setattr(settings, "email_from", "Knorvex <noreply@example.com>")

    captured: dict[str, object] = {}

    def fake_post(url: str, **kwargs: object) -> httpx.Response:
        captured["url"] = url
        captured["kwargs"] = kwargs
        request = httpx.Request("POST", url)
        return httpx.Response(200, json={"id": "email_123"}, request=request)

    with patch("app.services.email.resend.httpx.post", side_effect=fake_post):
        ResendEmailProvider().send(
            OutboundEmail(
                to="user@example.com",
                subject="Test",
                html="<p>Hi</p>",
                text="Hi",
            )
        )

    assert captured["url"] == "https://api.resend.com/emails"
    headers = captured["kwargs"]["headers"]
    assert headers["Authorization"] == "Bearer re_test_key"
