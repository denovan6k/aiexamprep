"""Database-backed course CRUD scoped to the authenticated user."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Course
from app.schemas.courses import CourseCreate, CourseResponse, CourseUpdate


class CourseNotFoundError(Exception):
    pass


class CourseService:
    def list_courses(self, db: Session, user_id: uuid.UUID) -> list[CourseResponse]:
        courses = db.scalars(
            select(Course).where(Course.user_id == user_id).order_by(Course.created_at.desc())
        ).all()
        return [self._to_response(course) for course in courses]

    def create_course(self, db: Session, user_id: uuid.UUID, request: CourseCreate) -> CourseResponse:
        course = Course(
            user_id=user_id,
            title=request.title,
            description=request.description,
            exam_date=request.exam_date,
        )
        db.add(course)
        db.flush()
        return self._to_response(course)

    def get_course(self, db: Session, user_id: uuid.UUID, course_id: uuid.UUID) -> CourseResponse:
        return self._to_response(self._owned_course(db, user_id, course_id))

    def update_course(
        self, db: Session, user_id: uuid.UUID, course_id: uuid.UUID, request: CourseUpdate
    ) -> CourseResponse:
        course = self._owned_course(db, user_id, course_id)
        update_data = request.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(course, field, value)
        db.add(course)
        db.flush()
        return self._to_response(course)

    def delete_course(self, db: Session, user_id: uuid.UUID, course_id: uuid.UUID) -> None:
        course = self._owned_course(db, user_id, course_id)
        db.delete(course)

    def _owned_course(self, db: Session, user_id: uuid.UUID, course_id: uuid.UUID) -> Course:
        course = db.scalar(
            select(Course).where(Course.id == course_id, Course.user_id == user_id)
        )
        if course is None:
            raise CourseNotFoundError(f"Course {course_id} was not found.")
        return course

    def _to_response(self, course: Course) -> CourseResponse:
        return CourseResponse(
            id=course.id,
            title=course.title,
            description=course.description,
            exam_date=course.exam_date,
            created_at=course.created_at,
            updated_at=course.updated_at,
        )


course_service = CourseService()
