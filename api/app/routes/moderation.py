from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_allow_inactive
from app.models import (
    CommunityGroup,
    CommunityMembership,
    CommunityReply,
    CommunityThread,
    ContentReport,
    SharedResource,
    User,
)
from app.schemas.admin import ModerationAppealCreateRequest, ModerationAppealResponse
from app.schemas.integration import (
    ContentReportCreateRequest,
    ContentReportResolveRequest,
    ContentReportResponse,
)
from app.services.admin.moderation import AdminModerationService

router = APIRouter()

MODERATOR_ROLES = frozenset({"owner", "moderator"})
moderation_service = AdminModerationService()


@router.get("/reports", response_model=list[ContentReportResponse])
def list_reports(
    status_filter: str | None = Query(default="open", alias="status"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ContentReportResponse]:
    moderated_group_ids = _moderated_group_ids(db, user.id)
    if not moderated_group_ids:
        return []

    reports = db.scalars(
        select(ContentReport)
        .where(ContentReport.status == status_filter)
        .order_by(ContentReport.created_at.desc())
    ).all()
    return [
        _report_response(report)
        for report in reports
        if _report_group_id(db, report) in moderated_group_ids
    ]


@router.post("/reports", response_model=ContentReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    request: ContentReportCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContentReportResponse:
    report = ContentReport(
        reporter_id=user.id,
        target_type=request.target_type,
        target_id=request.target_id,
        reason=request.reason,
        details=request.details,
        status="open",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _report_response(report)


@router.post("/appeals", response_model=ModerationAppealResponse, status_code=status.HTTP_201_CREATED)
def create_appeal(
    request: ModerationAppealCreateRequest,
    user: User = Depends(get_current_user_allow_inactive),
    db: Session = Depends(get_db),
) -> ModerationAppealResponse:
    return moderation_service.create_appeal(
        db,
        user=user,
        appeal_type=request.appeal_type,
        reason=request.reason,
        reference_type=request.reference_type,
        reference_id=request.reference_id,
    )


@router.post("/reports/{report_id}/resolve", response_model=ContentReportResponse)
def resolve_report(
    report_id: uuid.UUID,
    request: ContentReportResolveRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContentReportResponse:
    report = db.get(ContentReport, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Report {report_id} was not found.")

    group_id = _report_group_id(db, report)
    if group_id is None or not _can_moderate_group(db, group_id, user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You cannot resolve this report.")

    if report.status != "open":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Report is already resolved.")

    if request.notes:
        report.details = (
            f"{report.details}\n\nModerator notes: {request.notes}".strip()
            if report.details
            else f"Moderator notes: {request.notes}"
        )
    report.status = request.status
    report.reviewed_by_user_id = user.id
    report.reviewed_at = datetime.now(UTC)
    db.commit()
    db.refresh(report)
    return _report_response(report)


def _moderated_group_ids(db: Session, user_id: uuid.UUID) -> set[uuid.UUID]:
    memberships = db.scalars(
        select(CommunityMembership).where(
            CommunityMembership.user_id == user_id,
            CommunityMembership.status == "active",
            CommunityMembership.role.in_(tuple(MODERATOR_ROLES)),
        )
    ).all()
    owned_groups = db.scalars(select(CommunityGroup.id).where(CommunityGroup.owner_id == user_id)).all()
    return {membership.group_id for membership in memberships} | set(owned_groups)


def _can_moderate_group(db: Session, group_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    group = db.get(CommunityGroup, group_id)
    if group is not None and group.owner_id == user_id:
        return True
    membership = db.scalar(
        select(CommunityMembership).where(
            CommunityMembership.group_id == group_id,
            CommunityMembership.user_id == user_id,
            CommunityMembership.status == "active",
            CommunityMembership.role.in_(tuple(MODERATOR_ROLES)),
        )
    )
    return membership is not None


def _report_group_id(db: Session, report: ContentReport) -> uuid.UUID | None:
    if report.target_type == "group":
        return report.target_id
    if report.target_type == "thread":
        thread = db.get(CommunityThread, report.target_id)
        return thread.group_id if thread is not None else None
    if report.target_type == "reply":
        reply = db.get(CommunityReply, report.target_id)
        if reply is None:
            return None
        thread = db.get(CommunityThread, reply.thread_id)
        return thread.group_id if thread is not None else None
    if report.target_type == "shared_resource":
        resource = db.get(SharedResource, report.target_id)
        return resource.group_id if resource is not None else None
    return None


def _report_response(report: ContentReport) -> ContentReportResponse:
    return ContentReportResponse(
        id=report.id,
        target_type=report.target_type,
        target_id=report.target_id,
        reason=report.reason,
        details=report.details,
        status=report.status,
        created_at=report.created_at,
        reviewed_at=report.reviewed_at,
    )
