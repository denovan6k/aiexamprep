from fastapi import APIRouter, Request

from app.core.client_context import build_login_client_info, resolve_client_ip
from app.schemas.common import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok", service="knorvex-api")


@router.get("/debug/client-context")
def debug_client_context(request: Request) -> dict:
    """Debug endpoint to verify client IP and User-Agent forwarding."""
    client_info = build_login_client_info(request)
    
    return {
        "resolved_ip": resolve_client_ip(request),
        "user_agent": request.headers.get("user-agent"),
        "client_info": client_info,
        "headers": {
            "cf-connecting-ip": request.headers.get("cf-connecting-ip"),
            "x-real-ip": request.headers.get("x-real-ip"),
            "x-forwarded-for": request.headers.get("x-forwarded-for"),
            "x-vercel-forwarded-for": request.headers.get("x-vercel-forwarded-for"),
        },
    }
