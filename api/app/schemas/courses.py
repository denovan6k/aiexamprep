from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class CourseBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    exam_date: datetime | None = None
    confidence_level: str | None = Field(default=None, pattern="^(low|medium|high)$")


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    exam_date: datetime | None = None
    confidence_level: str | None = Field(default=None, pattern="^(low|medium|high)$")

    @model_validator(mode="after")
    def require_update_field(self) -> "CourseUpdate":
        if self.model_fields_set:
            return self
        raise ValueError("At least one course field must be provided.")


class CourseResponse(CourseBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
