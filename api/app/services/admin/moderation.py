from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ContentReport, ModerationAppeal, User
from app.schemas.admin import (
    AdminContentReportResponse,
    AdminReportResolveRequest,
    ModerationAppealResolveRequest,
    ModerationAppealResponse,
)
from app.schemas.pagination import PaginatedResponse
from app.services.admin.audit import AdminAuditService


class AdminModerationService:
    def __init__(self) -> None:
        self.audit = AdminAuditService()

    def list_reports(
        self,
        db: Session,
        *,
        status_filter: str | None = "open",
        offset: int = 0,
        limit: int = 20,
    ) -> PaginatedResponse[AdminContentReportResponse]:
        query = select(ContentReport).order_by(ContentReport.created_at.desc())
        if status_filter:
            query = query.where(ContentReport.status == status_filter)
        reports = db.scalars(query).all()
        items = [self._report_response(db, report) for report in reports]
        total = len(items)
        page = items[offset : offset + limit]
        return PaginatedResponse(items=page, total=total, limit=limit, offset=offset)

    def resolve_report(
        self,
        db: Session,
        *,
        admin: User,
        report_id: uuid.UUID,
        request: AdminReportResolveRequest,
    ) -> AdminContentReportResponse:
        report = db.get(ContentReport, report_id)
        if report is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Report {report_id} was not found.")
        if report.status != "open":
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Report is already resolved.")

        if request.notes:
            report.details = (
                f"{report.details}\n\nAdmin notes: {request.notes}".strip()
                if report.details
                else f"Admin notes: {request.notes}"
            )
        report.status = request.status
        report.reviewed_by_user_id = admin.id
        report.reviewed_at = datetime.now(UTC)

        self.audit.log(
            db,
            admin=admin,
            action="moderation.report.resolve",
            target_type="content_report",
            target_id=report.id,
            metadata={"status": request.status},
        )
        db.commit()
        db.refresh(report)
        return self._report_response(db, report)

    def list_appeals(
        self,
        db: Session,
        *,
        status_filter: str | None = "pending",
        user_id: uuid.UUID | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> PaginatedResponse[ModerationAppealResponse]:
        query = select(ModerationAppeal).order_by(ModerationAppeal.created_at.desc())
        if status_filter:
            query = query.where(ModerationAppeal.status == status_filter)
        if user_id:
            query = query.where(ModerationAppeal.user_id == user_id)
        appeals = db.scalars(query).all()
        items = [self._appeal_response(db, appeal) for appeal in appeals]
        total = len(items)
        page = items[offset : offset + limit]
        return PaginatedResponse(items=page, total=total, limit=limit, offset=offset)

    def resolve_appeal(
        self,
        db: Session,
        *,
        admin: User,
        appeal_id: uuid.UUID,
        request: ModerationAppealResolveRequest,
    ) -> ModerationAppealResponse:
        appeal = db.get(ModerationAppeal, appeal_id)
        if appeal is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Appeal {appeal_id} was not found.")
        if appeal.status != "pending":
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Appeal is already reviewed.")

        appeal.status = request.status
        appeal.admin_response = request.admin_response
        appeal.reviewed_by_user_id = admin.id
        appeal.reviewed_at = datetime.now(UTC)

        if request.status == "approved" and appeal.appeal_type == "account_suspension":
            user = db.get(User, appeal.user_id)
            if user is not None:
                user.is_active = True
                db.add(user)

        self.audit.log(
            db,
            admin=admin,
            action="moderation.appeal.resolve",
            target_type="moderation_appeal",
            target_id=appeal.id,
            metadata={"status": request.status},
        )
        db.commit()
        db.refresh(appeal)
        return self._appeal_response(db, appeal)

    def create_appeal(
        self,
        db: Session,
        *,
        user: User,
        appeal_type: str,
        reason: str,
        reference_type: str | None = None,
        reference_id: uuid.UUID | None = None,
    ) -> ModerationAppealResponse:
        from sqlalchemy import func

        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = int(
            db.scalar(
                select(func.count())
                .select_from(ModerationAppeal)
                .where(
                    ModerationAppeal.user_id == user.id,
                    ModerationAppeal.created_at >= today_start,
                )
            )
            or 0
        )
        if today_count >= 5:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail="You can submit at most 5 appeals per day.",
            )

        appeal = ModerationAppeal(
            user_id=user.id,
            appeal_type=appeal_type,
            reference_type=reference_type,
            reference_id=reference_id,
            reason=reason,
            status="pending",
        )
        db.add(appeal)
        db.commit()
        db.refresh(appeal)
        return self._appeal_response(db, appeal)

    def _report_response(self, db: Session, report: ContentReport) -> AdminContentReportResponse:
        reporter = db.get(User, report.reporter_id)
        return AdminContentReportResponse(
            id=report.id,
            reporter_id=report.reporter_id,
            reporter_email=reporter.email if reporter else None,
            target_type=report.target_type,
            target_id=report.target_id,
            reason=report.reason,
            details=report.details,
            status=report.status,
            created_at=report.created_at,
            reviewed_at=report.reviewed_at,
        )

    def _appeal_response(self, db: Session, appeal: ModerationAppeal) -> ModerationAppealResponse:
        user = db.get(User, appeal.user_id)
        return ModerationAppealResponse(
            id=appeal.id,
            user_id=appeal.user_id,
            user_email=user.email if user else None,
            user_name=user.name if user else None,
            appeal_type=appeal.appeal_type,
            reference_type=appeal.reference_type,
            reference_id=appeal.reference_id,
            reason=appeal.reason,
            status=appeal.status,
            reviewed_by_user_id=appeal.reviewed_by_user_id,
            admin_response=appeal.admin_response,
            reviewed_at=appeal.reviewed_at,
            created_at=appeal.created_at,
            updated_at=appeal.updated_at,
        )
