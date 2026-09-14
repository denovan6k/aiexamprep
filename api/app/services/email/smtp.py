from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.services.email.base import EmailProvider, OutboundEmail


class SmtpEmailProvider:
    def send(self, message: OutboundEmail) -> None:
        if not settings.smtp_host:
            raise RuntimeError("SMTP_HOST is required when EMAIL_PROVIDER=smtp.")
        if not settings.effective_email_from:
            raise RuntimeError("EMAIL_FROM is required when EMAIL_PROVIDER=smtp.")

        email = EmailMessage()
        email["Subject"] = message.subject
        email["From"] = settings.effective_email_from
        email["To"] = message.to
        if message.reply_to:
            email["Reply-To"] = message.reply_to
        email.set_content(message.text)
        email.add_alternative(message.html, subtype="html")

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(email)
