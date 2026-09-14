from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.core_study import (
    OnboardingCourseCreate,
    OnboardingResponse,
    StudyProfilePatch,
)
from app.schemas.courses import CourseResponse
from app.services.core_study import (
    OnboardingStepError,
    create_onboarding_course,
    onboarding_response,
    patch_onboarding,
)

router = APIRouter()


@router.get("", response_model=OnboardingResponse)
def get_onboarding(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> OnboardingResponse:
    return onboarding_response(db, user.id)


@router.patch("", response_model=OnboardingResponse)
def update_onboarding(
    request: StudyProfilePatch,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OnboardingResponse:
    try:
        return patch_onboarding(db, user.id, request)
    except OnboardingStepError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/course", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def add_onboarding_course(
    request: OnboardingCourseCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CourseResponse:
    try:
        course = create_onboarding_course(db, user.id, request)
    except OnboardingStepError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return CourseResponse(
        id=course.id,
        title=course.title,
        description=course.description,
        exam_date=course.exam_date,
        confidence_level=course.confidence_level,
        created_at=course.created_at,
        updated_at=course.updated_at,
    )
