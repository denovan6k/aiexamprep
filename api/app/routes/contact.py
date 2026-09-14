from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.core.config import settings
from app.core.rate_limit import check_email_rate_limit
from app.core.client_context import resolve_client_ip
from app.emails.renderer import render_template
from app.services.email import get_email_provider
from app.services.email.base import OutboundEmail
from app.schemas.contact import ContactRequest, ContactResponse

router = APIRouter()


@router.post("", response_model=ContactResponse, status_code=status.HTTP_200_OK)
def submit_contact(
    request_data: ContactRequest,
    request: Request,
) -> ContactResponse:
    # 1. Enforce rate limits
    # Rate limit by Email
    check_email_rate_limit(
        request_data.email,
        "contact_email",
        limit=settings.rate_limit_contact_per_hour,
        window_seconds=3600,
    )
    
    # Rate limit by IP
    client_ip = resolve_client_ip(request) or "unknown"
    check_email_rate_limit(
        client_ip,
        "contact_ip",
        limit=settings.rate_limit_contact_per_hour,
        window_seconds=3600,
    )

    # 2. Prepare email body
    topic_label = request_data.topic or "General inquiry"
    subject = f"[Contact Form] {topic_label.capitalize()} from {request_data.name}"
    
    # Render using template (which resolves html & text)
    _, html, text = render_template(
        "contact.html",
        subject=subject,
        name=request_data.name,
        email=request_data.email,
        topic=request_data.topic,
        message=request_data.message,
    )

    # 3. Send email to contact inbox
    message = OutboundEmail(
        to=settings.effective_contact_inbox,
        subject=subject,
        html=html,
        text=text,
        reply_to=request_data.email,
    )

    get_email_provider().send(message)

    return ContactResponse(
        success=True,
        message="Your message has been sent successfully."
    )
