from __future__ import annotations

import logging
from datetime import UTC, datetime
from urllib.parse import quote

from app.core.config import settings
from app.emails.renderer import render_template
from app.services.email import get_email_provider
from app.services.email.base import OutboundEmail


logger = logging.getLogger(__name__)

OTP_PURPOSE_COPY = {
    "email_verification": {
        "subject": "Your Knorvex email verification code",
        "intro": "Use the code below to verify your email address.",
    },
    "password_reset": {
        "subject": "Your Knorvex password reset code",
        "intro": "Use the code below to reset your password.",
    },
}


class AuthMailer:
    def send_otp(self, *, email: str, code: str, purpose: str, recipient_name: str | None = None) -> None:
        copy = OTP_PURPOSE_COPY.get(purpose)
        if copy is None:
            raise ValueError(f"Unsupported OTP purpose: {purpose}")

        expires_minutes = settings.auth_otp_ttl_seconds // 60
        subject, html, text = render_template(
            "otp.html",
            subject=copy["subject"],
            intro_text=copy["intro"],
            code=code,
            expires_minutes=expires_minutes,
            recipient_name=recipient_name,
        )
        self._deliver(to=email, subject=subject, html=html, text=text)

    def send_welcome(self, *, email: str, name: str | None = None) -> None:
        recipient_name = name or email.split("@", 1)[0]
        verify_url = (
            f"{settings.app_public_url.rstrip('/')}/email-verification"
            f"?email={quote(email)}"
        )
        subject = f"Welcome to Knorvex, {recipient_name}!"
        _, html, text = render_template(
            "welcome.html",
            subject=subject,
            recipient_name=recipient_name,
            verify_url=verify_url,
        )
        self._deliver(to=email, subject=subject, html=html, text=text)

    def send_login_alert(
        self,
        *,
        email: str,
        recipient_name: str | None = None,
        ip_address: str | None = None,
        device: str | None = None,
        location: str | None = None,
        login_time: datetime | None = None,
    ) -> None:
        if not settings.email_login_alerts_enabled:
            return

        when = login_time or datetime.now(UTC)
        login_time_label = when.strftime("%B %d, %Y at %H:%M UTC")
        subject = "New sign-in to your Knorvex account"
        _, html, text = render_template(
            "login_alert.html",
            subject=subject,
            recipient_name=recipient_name,
            login_time=login_time_label,
            ip_address=ip_address,
            device=device,
            location=location,
        )
        self._deliver(to=email, subject=subject, html=html, text=text)

    def _deliver(self, *, to: str, subject: str, html: str, text: str) -> None:
        reply_to = settings.effective_email_reply_to or None
        message = OutboundEmail(
            to=to,
            subject=subject,
            html=html,
            text=text,
            reply_to=reply_to,
        )
        try:
            get_email_provider().send(message)
        except Exception:
            logger.exception("Failed to send email to=%s subject=%s", to, subject)
            if settings.app_env.lower() == "production":
                raise


auth_mailer = AuthMailer()


def send_auth_otp(*, email: str, code: str, purpose: str, recipient_name: str | None = None) -> None:
    """Backward-compatible helper used by auth service and tests."""
    auth_mailer.send_otp(
        email=email,
        code=code,
        purpose=purpose,
        recipient_name=recipient_name,
    )
