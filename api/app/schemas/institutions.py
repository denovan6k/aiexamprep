from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.materials import MaterialResponse


class InstitutionResponse(BaseModel):
    id: UUID
    name: str
    slug: str


class UserInstitutionResponse(BaseModel):
    institution: InstitutionResponse | None = None
    is_institution_admin: bool = False


class UpdateInstitutionRequest(BaseModel):
    institution_slug: str | None = Field(default=None, max_length=255)

    @field_validator("institution_slug")
    @classmethod
    def normalize_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        slug = value.strip().lower()
        return slug or None


class BulkUploadResponse(BaseModel):
    uploaded: list[MaterialResponse]
    message: str


class InstitutionMaterialListResponse(BaseModel):
    materials: list[MaterialResponse]
    institution: InstitutionResponse
