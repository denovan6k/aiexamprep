from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.core_study import (
    StudyPlanItemCreate,
    StudyPlanItemPatch,
    StudyPlanItemResponse,
    StudyFeedResponse,
    TodayStudyPlanResponse,
)
from app.services.core_study import (
    OnboardingStepError,
    build_study_feed,
    create_plan_item,
    plan_item_response,
    today_plan,
    update_plan_item,
)

router = APIRouter()


@router.get("/feed", response_model=StudyFeedResponse)
def get_study_feed(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> StudyFeedResponse:
    return build_study_feed(db, user.id)


@router.get("/today", response_model=TodayStudyPlanResponse)
def get_today_plan(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> TodayStudyPlanResponse:
    return today_plan(db, user.id)


@router.post("/today/refresh", response_model=TodayStudyPlanResponse)
def refresh_today_plan(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> TodayStudyPlanResponse:
    return today_plan(db, user.id, refresh=True)


@router.post("/plan-items", response_model=StudyPlanItemResponse, status_code=status.HTTP_201_CREATED)
def create_plan_item_route(
    request: StudyPlanItemCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudyPlanItemResponse:
    try:
        return plan_item_response(create_plan_item(db, user.id, request))
    except OnboardingStepError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/plan-items/{item_id}", response_model=StudyPlanItemResponse)
def act_on_plan_item(
    item_id: uuid.UUID,
    request: StudyPlanItemPatch,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudyPlanItemResponse:
    item = update_plan_item(db, user.id, item_id, request.action)
    if item is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=f"Study plan item {item_id} was not found."
        )
    return plan_item_response(item)
