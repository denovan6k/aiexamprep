from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.courses import CourseCreate, CourseResponse, CourseUpdate
from app.schemas.core_study import CourseWorkspaceResponse
from app.services.core_study import course_workspace
from app.services.courses import CourseNotFoundError, course_service
from app.services.usage import enforce_limit, record_usage

router = APIRouter()


@router.get("", response_model=list[CourseResponse])
def list_courses(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[CourseResponse]:
    return course_service.list_courses(db, user.id)


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    request: CourseCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CourseResponse:
    enforce_limit(db, user.id, "course_create")
    response = course_service.create_course(db, user.id, request)
    record_usage(db, user.id, "course_create")
    db.commit()
    return response


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CourseResponse:
    try:
        return course_service.get_course(db, user.id, course_id)
    except CourseNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{course_id}/workspace", response_model=CourseWorkspaceResponse)
def get_course_workspace(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CourseWorkspaceResponse:
    response = course_workspace(db, user.id, course_id)
    if response is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Course {course_id} was not found.")
    return response


@router.patch("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: uuid.UUID,
    request: CourseUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CourseResponse:
    try:
        response = course_service.update_course(db, user.id, course_id, request)
        db.commit()
        return response
    except CourseNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    try:
        course_service.delete_course(db, user.id, course_id)
        db.commit()
    except CourseNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
