from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import SupportTicket, User
from app.schemas.admin import (
    SupportTicketCreateRequest,
    SupportTicketResponse,
    SupportTicketUpdateRequest,
)
from app.schemas.pagination import PaginatedResponse
from app.services.admin.audit import AdminAuditService


class AdminSupportService:
    def __init__(self) -> None:
        self.audit = AdminAuditService()

    def list_tickets(
        self,
        db: Session,
        *,
        status_filter: str | None = None,
        user_id: uuid.UUID | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> PaginatedResponse[SupportTicketResponse]:
        query = select(SupportTicket).order_by(SupportTicket.created_at.desc())
        if status_filter:
            query = query.where(SupportTicket.status == status_filter)
        if user_id:
            query = query.where(SupportTicket.user_id == user_id)
        tickets = db.scalars(query).all()
        items = [self._ticket_response(db, ticket) for ticket in tickets]
        total = len(items)
        page = items[offset : offset + limit]
        return PaginatedResponse(items=page, total=total, limit=limit, offset=offset)

    def get_ticket(self, db: Session, ticket_id: uuid.UUID) -> SupportTicketResponse:
        ticket = db.get(SupportTicket, ticket_id)
        if ticket is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Ticket {ticket_id} was not found.")
        return self._ticket_response(db, ticket)

    def update_ticket(
        self,
        db: Session,
        *,
        admin: User,
        ticket_id: uuid.UUID,
        request: SupportTicketUpdateRequest,
    ) -> SupportTicketResponse:
        ticket = db.get(SupportTicket, ticket_id)
        if ticket is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Ticket {ticket_id} was not found.")

        changes: dict[str, object] = {}
        if request.status is not None:
            changes["status"] = request.status
            ticket.status = request.status
            if request.status in {"resolved", "closed"}:
                ticket.resolved_at = datetime.now(UTC)
        if request.priority is not None:
            changes["priority"] = request.priority
            ticket.priority = request.priority
        if request.assigned_admin_id is not None:
            changes["assigned_admin_id"] = str(request.assigned_admin_id)
            ticket.assigned_admin_id = request.assigned_admin_id
        if request.admin_notes is not None:
            changes["admin_notes"] = request.admin_notes
            ticket.admin_notes = request.admin_notes

        if changes:
            self.audit.log(
                db,
                admin=admin,
                action="support.ticket.update",
                target_type="support_ticket",
                target_id=ticket.id,
                metadata=changes,
            )
            db.add(ticket)
            db.commit()
            db.refresh(ticket)

        return self._ticket_response(db, ticket)

    def create_ticket(
        self,
        db: Session,
        *,
        user: User,
        request: SupportTicketCreateRequest,
    ) -> SupportTicketResponse:
        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = int(
            db.scalar(
                select(func.count())
                .select_from(SupportTicket)
                .where(
                    SupportTicket.user_id == user.id,
                    SupportTicket.created_at >= today_start,
                )
            )
            or 0
        )
        if today_count >= 5:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail="You can submit at most 5 support tickets per day.",
            )

        ticket = SupportTicket(
            user_id=user.id,
            category=request.category,
            subject=request.subject,
            body=request.body,
            status="open",
            priority="normal",
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        return self._ticket_response(db, ticket)

    def _ticket_response(self, db: Session, ticket: SupportTicket) -> SupportTicketResponse:
        user = db.get(User, ticket.user_id)
        return SupportTicketResponse(
            id=ticket.id,
            user_id=ticket.user_id,
            user_email=user.email if user else None,
            user_name=user.name if user else None,
            category=ticket.category,
            subject=ticket.subject,
            body=ticket.body,
            status=ticket.status,
            priority=ticket.priority,
            assigned_admin_id=ticket.assigned_admin_id,
            admin_notes=ticket.admin_notes,
            resolved_at=ticket.resolved_at,
            created_at=ticket.created_at,
            updated_at=ticket.updated_at,
        )
