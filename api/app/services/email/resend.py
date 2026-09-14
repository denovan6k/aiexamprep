from __future__ import annotations

import httpx

from app.core.config import settings
from app.services.email.base import EmailProvider, OutboundEmail


RESEND_API_URL = "https://api.resend.com/emails"


class ResendEmailProvider:
    def send(self, message: OutboundEmail) -> None:
        if not settings.resend_api_key:
            raise RuntimeError("RESEND_API_KEY is required when EMAIL_PROVIDER=resend.")
        if not settings.effective_email_from:
            raise RuntimeError("EMAIL_FROM is required when EMAIL_PROVIDER=resend.")

        payload: dict[str, object] = {
            "from": settings.effective_email_from,
            "to": [message.to],
            "subject": message.subject,
            "html": message.html,
            "text": message.text,
        }
        if message.reply_to:
            payload["reply_to"] = message.reply_to

        response = httpx.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15.0,
        )
        if response.status_code >= 400:
            raise RuntimeError(
                f"Resend API error ({response.status_code}): {response.text.strip()}"
            )
