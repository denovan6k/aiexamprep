from __future__ import annotations

from app.core.config import settings
from app.services.email.base import EmailProvider
from app.services.email.console import ConsoleEmailProvider
from app.services.email.resend import ResendEmailProvider
from app.services.email.smtp import SmtpEmailProvider

_provider: EmailProvider | None = None


def _resolve_provider_name() -> str:
    configured = settings.email_provider.strip().lower()
    if configured:
        return configured
    if settings.app_env.lower() != "production":
        return "console"
    if settings.resend_api_key.strip():
        return "resend"
    if settings.smtp_host.strip():
        return "smtp"
    return "console"


def get_email_provider() -> EmailProvider:
    global _provider
    if _provider is not None:
        return _provider

    provider_name = _resolve_provider_name()
    if provider_name == "resend":
        _provider = ResendEmailProvider()
    elif provider_name == "smtp":
        _provider = SmtpEmailProvider()
    elif provider_name == "console":
        _provider = ConsoleEmailProvider()
    else:
        raise RuntimeError(
            f"Unsupported EMAIL_PROVIDER '{provider_name}'. Use resend, smtp, or console."
        )
    return _provider


def reset_email_provider_for_tests() -> None:
    global _provider
    _provider = None
