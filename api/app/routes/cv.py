from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.cv import CvDocumentResponse, CvTailoringCreateRequest, CvTailoringResponse
from app.schemas.pagination import DEFAULT_PAGE_LIMIT, PaginatedResponse
from app.services.cv import (
    CvFileTooLargeError,
    CvNotFoundError,
    CvProcessingError,
    UnsupportedCvFileTypeError,
    cv_service,
)
from app.services.usage import enforce_limit, record_usage

router = APIRouter()


@router.post("/documents", response_model=CvDocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_cv_document(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CvDocumentResponse:
    enforce_limit(db, user.id, "cv_upload")
    try:
        response = cv_service.create_cv_document(db, user.id, file, title)
        record_usage(db, user.id, "cv_upload")
        db.commit()
        return response
    except UnsupportedCvFileTypeError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc)) from exc
    except CvFileTooLargeError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc


@router.get("/documents", response_model=PaginatedResponse[CvDocumentResponse])
def list_cv_documents(
    q: str | None = None,
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[CvDocumentResponse]:
    return cv_service.list_cv_documents(db, user.id, q=q, limit=limit, offset=offset)


@router.get("/documents/{cv_document_id}", response_model=CvDocumentResponse)
def get_cv_document(
    cv_document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CvDocumentResponse:
    try:
        return cv_service.get_cv_document(db, user.id, cv_document_id)
    except CvNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/documents/{cv_document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cv_document(
    cv_document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    try:
        cv_service.delete_cv_document(db, user.id, cv_document_id)
        db.commit()
    except CvNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/tailorings", response_model=CvTailoringResponse, status_code=status.HTTP_201_CREATED)
def create_tailoring(
    request: CvTailoringCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CvTailoringResponse:
    enforce_limit(db, user.id, "cv_tailoring")
    try:
        response = cv_service.create_tailoring(
            db,
            user.id,
            cv_document_id=request.cv_document_id,
            job_description=request.job_description,
            job_title=request.job_title,
            company=request.company,
            model=request.model,
            llm_source=request.llm_source,
            llm_provider=request.llm_provider,
        )
        if response.status == "completed":
            record_usage(db, user.id, "cv_tailoring")
        db.commit()
        return response
    except CvNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CvProcessingError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/tailorings", response_model=PaginatedResponse[CvTailoringResponse])
def list_tailorings(
    cv_document_id: uuid.UUID | None = None,
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[CvTailoringResponse]:
    return cv_service.list_tailorings(
        db, user.id, cv_document_id=cv_document_id, limit=limit, offset=offset
    )


@router.get("/tailorings/{tailoring_id}", response_model=CvTailoringResponse)
def get_tailoring(
    tailoring_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CvTailoringResponse:
    try:
        return cv_service.get_tailoring(db, user.id, tailoring_id)
    except CvNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/tailorings/{tailoring_id}/download")
def download_tailoring(
    tailoring_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        if settings.storage_backend.strip().lower() == "s3":
            url = cv_service.create_tailoring_download_url(
                db, user.id, tailoring_id, expires=settings.material_download_url_expires
            )
            return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)
        content, file_name, media_type = cv_service.read_tailored_docx(db, user.id, tailoring_id)
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
        )
    except CvNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CvProcessingError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.delete("/tailorings/{tailoring_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tailoring(
    tailoring_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    try:
        cv_service.delete_tailoring(db, user.id, tailoring_id)
        db.commit()
    except CvNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
