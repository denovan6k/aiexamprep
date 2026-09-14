from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.admin import SupportTicketCreateRequest, SupportTicketResponse
from app.schemas.pagination import DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, PaginatedResponse
from app.services.admin.support import AdminSupportService
from sqlalchemy.orm import Session

router = APIRouter()

support_service = AdminSupportService()


@router.post("/tickets", response_model=SupportTicketResponse, status_code=status.HTTP_201_CREATED)
def create_support_ticket(
    request: SupportTicketCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SupportTicketResponse:
    return support_service.create_ticket(db, user=user, request=request)


@router.get("/tickets/me", response_model=PaginatedResponse[SupportTicketResponse])
def list_my_support_tickets(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[SupportTicketResponse]:
    return support_service.list_tickets(db, user_id=user.id, offset=offset, limit=limit)
