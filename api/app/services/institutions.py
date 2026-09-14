from __future__ import annotations

import re
import uuid

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Institution, InstitutionMembership, Material, User
from app.schemas.institutions import (
    BulkUploadResponse,
    InstitutionMaterialListResponse,
    InstitutionResponse,
    UpdateInstitutionRequest,
    UserInstitutionResponse,
)
from app.schemas.materials import MaterialResponse
from app.services.materials import (
    FileTooLargeError,
    MaterialsService,
    UnsupportedFileTypeError,
    materials_service,
)


class InstitutionNotFoundError(Exception):
    pass


class InstitutionAccessError(Exception):
    pass


def _slugify(value: str) -> str:
    slug = re.sub(r"[^\w\s-]+", "", value.strip().lower())
    slug = re.sub(r"[\s_-]+", "-", slug).strip("-")
    return slug or "institution"


class InstitutionsService:
    def list_institutions(self, db: Session) -> list[InstitutionResponse]:
        institutions = db.scalars(select(Institution).order_by(Institution.name.asc())).all()
        return [self._to_response(institution) for institution in institutions]

    def get_user_institution(self, db: Session, user: User) -> UserInstitutionResponse:
        institution = user.institution
        if institution is None and user.institution_id is not None:
            institution = db.get(Institution, user.institution_id)
        return UserInstitutionResponse(
            institution=self._to_response(institution) if institution else None,
            is_institution_admin=self._is_institution_admin(db, user.id, user.institution_id),
        )

    def update_user_institution(
        self, db: Session, user: User, request: UpdateInstitutionRequest
    ) -> UserInstitutionResponse:
        if request.institution_slug is None:
            user.institution_id = None
            db.add(user)
            db.flush()
            return self.get_user_institution(db, user)

        institution = db.scalar(
            select(Institution).where(Institution.slug == request.institution_slug)
        )
        if institution is None:
            raise InstitutionNotFoundError(
                f"Institution '{request.institution_slug}' was not found."
            )

        user.institution_id = institution.id
        db.add(user)
        self._ensure_membership(db, user.id, institution.id, role="member")
        db.flush()
        return self.get_user_institution(db, user)

    def assign_institution_by_slug(
        self, db: Session, user: User, institution_slug: str | None
    ) -> None:
        if not institution_slug:
            return
        institution = db.scalar(
            select(Institution).where(Institution.slug == institution_slug.strip().lower())
        )
        if institution is None:
            raise InstitutionNotFoundError(f"Institution '{institution_slug}' was not found.")
        user.institution_id = institution.id
        db.add(user)
        self._ensure_membership(db, user.id, institution.id, role="member")

    def bulk_upload_materials(
        self,
        db: Session,
        user: User,
        institution_id: uuid.UUID,
        uploads: list[UploadFile],
    ) -> BulkUploadResponse:
        institution = db.get(Institution, institution_id)
        if institution is None:
            raise InstitutionNotFoundError(f"Institution {institution_id} was not found.")
        if not self._is_institution_admin(db, user.id, institution_id):
            raise InstitutionAccessError("Institution admin access is required.")

        uploaded: list[MaterialResponse] = []
        for upload in uploads:
            uploaded.append(
                self._create_institution_material(db, user.id, institution_id, upload)
            )
        db.flush()
        return BulkUploadResponse(
            uploaded=uploaded,
            message=f"Uploaded {len(uploaded)} institution material(s).",
        )

    def list_institution_materials(
        self, db: Session, user: User, institution_id: uuid.UUID
    ) -> InstitutionMaterialListResponse:
        institution = db.get(Institution, institution_id)
        if institution is None:
            raise InstitutionNotFoundError(f"Institution {institution_id} was not found.")
        if user.institution_id != institution_id and not self._is_institution_admin(
            db, user.id, institution_id
        ):
            raise InstitutionAccessError("You do not have access to this institution.")

        materials = db.scalars(
            select(Material)
            .where(Material.institution_id == institution_id)
            .order_by(Material.created_at.desc())
        ).all()
        return InstitutionMaterialListResponse(
            institution=self._to_response(institution),
            materials=[materials_service._to_response(db, material) for material in materials],
        )

    def create_institution(
        self, db: Session, name: str, slug: str | None = None
    ) -> InstitutionResponse:
        normalized_slug = _slugify(slug or name)
        existing = db.scalar(select(Institution).where(Institution.slug == normalized_slug))
        if existing is not None:
            return self._to_response(existing)
        institution = Institution(name=name.strip(), slug=normalized_slug)
        db.add(institution)
        db.flush()
        return self._to_response(institution)

    def grant_institution_admin(
        self, db: Session, user_id: uuid.UUID, institution_id: uuid.UUID
    ) -> None:
        self._ensure_membership(db, user_id, institution_id, role="institution_admin")

    def _create_institution_material(
        self,
        db: Session,
        user_id: uuid.UUID,
        institution_id: uuid.UUID,
        upload: UploadFile,
    ) -> MaterialResponse:
        return self._materials_helper().create_institution_material(
            db, user_id, institution_id, upload
        )

    def _materials_helper(self) -> MaterialsService:
        return materials_service

    def _ensure_membership(
        self,
        db: Session,
        user_id: uuid.UUID,
        institution_id: uuid.UUID,
        *,
        role: str,
    ) -> InstitutionMembership:
        membership = db.scalar(
            select(InstitutionMembership).where(
                InstitutionMembership.user_id == user_id,
                InstitutionMembership.institution_id == institution_id,
            )
        )
        if membership is None:
            membership = InstitutionMembership(
                user_id=user_id,
                institution_id=institution_id,
                role=role,
            )
            db.add(membership)
            return membership
        membership.role = role
        db.add(membership)
        return membership

    def _is_institution_admin(
        self, db: Session, user_id: uuid.UUID, institution_id: uuid.UUID | None
    ) -> bool:
        if institution_id is None:
            return False
        membership = db.scalar(
            select(InstitutionMembership).where(
                InstitutionMembership.user_id == user_id,
                InstitutionMembership.institution_id == institution_id,
                InstitutionMembership.role == "institution_admin",
            )
        )
        return membership is not None

    def _to_response(self, institution: Institution) -> InstitutionResponse:
        return InstitutionResponse(
            id=institution.id,
            name=institution.name,
            slug=institution.slug,
        )


institutions_service = InstitutionsService()
