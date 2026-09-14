from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.institutions import (
    BulkUploadResponse,
    InstitutionMaterialListResponse,
    InstitutionResponse,
    UpdateInstitutionRequest,
    UserInstitutionResponse,
)
from app.services.institutions import (
    InstitutionAccessError,
    InstitutionNotFoundError,
    institutions_service,
)
from app.services.materials import FileTooLargeError, UnsupportedFileTypeError

router = APIRouter()


@router.get("", response_model=list[InstitutionResponse])
def list_institutions(db: Session = Depends(get_db)) -> list[InstitutionResponse]:
    return institutions_service.list_institutions(db)


@router.get("/me", response_model=UserInstitutionResponse)
def get_my_institution(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserInstitutionResponse:
    return institutions_service.get_user_institution(db, user)


@router.patch("/me", response_model=UserInstitutionResponse)
def update_my_institution(
    request: UpdateInstitutionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserInstitutionResponse:
    try:
        response = institutions_service.update_user_institution(db, user, request)
        db.commit()
        return response
    except InstitutionNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{institution_id}/materials", response_model=InstitutionMaterialListResponse)
def list_institution_materials(
    institution_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstitutionMaterialListResponse:
    try:
        return institutions_service.list_institution_materials(db, user, institution_id)
    except InstitutionNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InstitutionAccessError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.post(
    "/{institution_id}/materials",
    response_model=BulkUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
def bulk_upload_institution_materials(
    institution_id: uuid.UUID,
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BulkUploadResponse:
    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="At least one file is required.")
    try:
        response = institutions_service.bulk_upload_materials(db, user, institution_id, files)
        db.commit()
        return response
    except InstitutionNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InstitutionAccessError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except UnsupportedFileTypeError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc)) from exc
    except FileTooLargeError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc
