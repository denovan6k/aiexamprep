from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

CvDocumentStatus = Literal["uploaded", "processed", "failed"]
CvTailoringStatus = Literal["queued", "running", "completed", "failed"]


class CvContact(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""


class CvExperienceItem(BaseModel):
    title: str = ""
    company: str = ""
    dates: str = ""
    bullets: list[str] = Field(default_factory=list)


class CvEducationItem(BaseModel):
    degree: str = ""
    institution: str = ""
    dates: str = ""
    details: str = ""


class CvTailoredSections(BaseModel):
    contact: CvContact = Field(default_factory=CvContact)
    summary: str = ""
    skills: list[str] = Field(default_factory=list)
    experience: list[CvExperienceItem] = Field(default_factory=list)
    education: list[CvEducationItem] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    ats_keywords_matched: list[str] = Field(default_factory=list)


class CvDocumentResponse(BaseModel):
    id: UUID
    title: str
    file_name: str
    file_type: str | None
    status: str
    error_message: str | None = None
    extracted_text_preview: str | None = None
    created_at: datetime
    updated_at: datetime


class CvTailoringCreateRequest(BaseModel):
    cv_document_id: UUID
    job_description: str = Field(min_length=40, max_length=30000)
    job_title: str | None = Field(default=None, max_length=255)
    company: str | None = Field(default=None, max_length=255)
    model: str | None = Field(default=None, max_length=255)
    llm_source: Literal["platform", "byok"] = "platform"
    llm_provider: str | None = Field(default=None, max_length=50)


class CvTailoringResponse(BaseModel):
    id: UUID
    cv_document_id: UUID
    job_title: str | None
    company: str | None
    job_description: str
    tailored_sections: CvTailoredSections | dict[str, Any] | None
    status: str
    model: str | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime
