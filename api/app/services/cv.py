"""CV upload, tailoring, and export service."""
from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import CvDocument, CvTailoring
from app.schemas.cv import CvDocumentResponse, CvTailoringResponse, CvTailoredSections
from app.schemas.pagination import PaginatedResponse
from app.core.pagination import paginate
from app.services.cv_docx import build_tailored_cv_docx, sanitize_docx_filename
from app.services.cv_generation import generate_tailored_cv
from app.services.extraction import ExtractionError, extract_text, normalize_extracted_text
from app.services.api_keys import decrypt_api_key
from app.services.llm import LlmOverride, reset_platform_provider, set_platform_provider
from app.services.llm_providers import is_provider_configured
from app.services.materials import MAX_UPLOAD_BYTES
from app.services.storage import cv_storage_key, cv_tailoring_storage_key, get_storage

SUPPORTED_CV_EXTENSIONS = {".pdf", ".docx", ".txt"}
DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


class CvNotFoundError(Exception):
    pass


class CvProcessingError(Exception):
    pass


class UnsupportedCvFileTypeError(Exception):
    pass


class CvFileTooLargeError(Exception):
    pass


def _safe_filename(name: str) -> str:
    return re.sub(r"[^\w.\-]+", "_", name or "upload")


class CvService:
    def create_cv_document(
        self,
        db: Session,
        user_id: uuid.UUID,
        upload: UploadFile,
        title: str | None = None,
    ) -> CvDocumentResponse:
        file_name = _safe_filename(upload.filename or "cv.txt")
        suffix = Path(file_name).suffix.lower()
        if suffix not in SUPPORTED_CV_EXTENSIONS:
            raise UnsupportedCvFileTypeError(
                f"Unsupported CV file type {suffix or '(none)'}. Supported: {', '.join(sorted(SUPPORTED_CV_EXTENSIONS))}"
            )
        content = upload.file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise CvFileTooLargeError("File exceeds the 25 MB upload limit.")

        cv = CvDocument(
            user_id=user_id,
            title=title or Path(file_name).stem.replace("_", " "),
            file_name=file_name,
            file_type=upload.content_type or suffix.lstrip("."),
            storage_path="",
            status="uploaded",
        )
        db.add(cv)
        db.flush()

        storage = get_storage("private")
        key = cv_storage_key(user_id=str(user_id), cv_id=str(cv.id), file_name=file_name)
        storage.put(key, content, content_type=cv.file_type)
        cv.storage_path = key

        try:
            with storage.open_temp_file(key) as path:
                text = normalize_extracted_text(extract_text(path))
            if not text:
                raise ExtractionError("No text could be extracted from the file.")
            cv.extracted_text = text
            cv.status = "processed"
            cv.error_message = None
        except ExtractionError as exc:
            cv.status = "failed"
            cv.error_message = str(exc)
        db.flush()
        return self._document_response(cv)

    def list_cv_documents(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        q: str | None = None,
        limit: int = 12,
        offset: int = 0,
    ) -> PaginatedResponse[CvDocumentResponse]:
        query = select(CvDocument).where(CvDocument.user_id == user_id)
        if q and q.strip():
            pattern = f"%{q.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(CvDocument.title).like(pattern),
                    func.lower(CvDocument.file_name).like(pattern),
                )
            )
        query = query.order_by(CvDocument.created_at.desc())
        documents, total = paginate(db, query, limit=limit, offset=offset)
        return PaginatedResponse(
            items=[self._document_response(document) for document in documents],
            total=total,
            limit=limit,
            offset=offset,
        )

    def get_cv_document(self, db: Session, user_id: uuid.UUID, cv_document_id: uuid.UUID) -> CvDocumentResponse:
        return self._document_response(self._owned_document(db, user_id, cv_document_id))

    def delete_cv_document(self, db: Session, user_id: uuid.UUID, cv_document_id: uuid.UUID) -> None:
        cv = self._owned_document(db, user_id, cv_document_id)
        storage = get_storage("private")
        paths = [cv.storage_path] + [tailoring.storage_path for tailoring in cv.tailorings if tailoring.storage_path]
        db.delete(cv)
        for path in paths:
            if path:
                storage.delete(path)

    def create_tailoring(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        cv_document_id: uuid.UUID,
        job_description: str,
        job_title: str | None = None,
        company: str | None = None,
        model: str | None = None,
        llm_source: str = "platform",
        llm_provider: str | None = None,
    ) -> CvTailoringResponse:
        cv = self._owned_document(db, user_id, cv_document_id)
        if cv.status != "processed" or not cv.extracted_text:
            raise CvProcessingError("CV must be processed before tailoring.")

        tailoring = CvTailoring(
            user_id=user_id,
            cv_document_id=cv.id,
            job_title=job_title,
            company=company,
            job_description=job_description,
            status="queued",
            model=model,
        )
        db.add(tailoring)
        db.flush()
        override = self._resolve_llm_override(db, user_id, llm_source=llm_source, llm_provider=llm_provider)
        platform_token = None
        if override is None and llm_source == "platform" and llm_provider:
            if not is_provider_configured(llm_provider):
                raise CvProcessingError(
                    f"Platform provider '{llm_provider}' is not configured on the server."
                )
            platform_token = set_platform_provider(llm_provider)
        try:
            self.execute_tailoring(db, cv, tailoring, override=override)
        finally:
            if platform_token is not None:
                reset_platform_provider(platform_token)
        db.flush()
        return self._tailoring_response(tailoring)

    def execute_tailoring(
        self,
        db: Session,
        cv: CvDocument,
        tailoring: CvTailoring,
        *,
        override: LlmOverride | None = None,
    ) -> None:
        tailoring.status = "running"
        db.flush()
        try:
            sections = generate_tailored_cv(
                cv.extracted_text or "",
                tailoring.job_description,
                job_title=tailoring.job_title,
                company=tailoring.company,
                model=tailoring.model,
                override=override,
            )
            docx_bytes = build_tailored_cv_docx(sections)
            key = cv_tailoring_storage_key(user_id=str(cv.user_id), tailoring_id=str(tailoring.id))
            get_storage("private").put(key, docx_bytes, content_type=DOCX_MEDIA_TYPE)
            tailoring.tailored_sections = sections.model_dump()
            tailoring.storage_path = key
            tailoring.status = "completed"
            tailoring.error_message = None
        except Exception as exc:
            tailoring.status = "failed"
            tailoring.error_message = str(exc) or "CV tailoring failed."
        db.add(tailoring)

    def _resolve_llm_override(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        llm_source: str,
        llm_provider: str | None,
    ) -> LlmOverride | None:
        if llm_source != "byok":
            return None
        if not llm_provider:
            raise CvProcessingError("Choose a saved AI provider before generating with your own key.")
        from app.models import UserApiKey

        record = db.scalar(
            select(UserApiKey)
            .where(
                UserApiKey.user_id == user_id,
                UserApiKey.provider == llm_provider,
                UserApiKey.is_valid.is_(True),
            )
            .order_by(UserApiKey.created_at.desc())
        )
        if record is None:
            raise CvProcessingError(f"No valid saved {llm_provider} API key was found.")
        return LlmOverride(provider=record.provider, api_key=decrypt_api_key(record))

    def list_tailorings(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        cv_document_id: uuid.UUID | None = None,
        limit: int = 12,
        offset: int = 0,
    ) -> PaginatedResponse[CvTailoringResponse]:
        query = select(CvTailoring).where(CvTailoring.user_id == user_id)
        if cv_document_id is not None:
            query = query.where(CvTailoring.cv_document_id == cv_document_id)
        query = query.order_by(CvTailoring.created_at.desc())
        tailorings, total = paginate(db, query, limit=limit, offset=offset)
        return PaginatedResponse(
            items=[self._tailoring_response(tailoring) for tailoring in tailorings],
            total=total,
            limit=limit,
            offset=offset,
        )

    def get_tailoring(self, db: Session, user_id: uuid.UUID, tailoring_id: uuid.UUID) -> CvTailoringResponse:
        return self._tailoring_response(self._owned_tailoring(db, user_id, tailoring_id))

    def delete_tailoring(self, db: Session, user_id: uuid.UUID, tailoring_id: uuid.UUID) -> None:
        tailoring = self._owned_tailoring(db, user_id, tailoring_id)
        storage_path = tailoring.storage_path
        db.delete(tailoring)
        if storage_path:
            get_storage("private").delete(storage_path)

    def create_tailoring_download_url(self, db: Session, user_id: uuid.UUID, tailoring_id: uuid.UUID, *, expires: int) -> str:
        tailoring = self._owned_tailoring(db, user_id, tailoring_id)
        if not tailoring.storage_path:
            raise CvNotFoundError(f"Tailoring {tailoring_id} has no document.")
        url = get_storage("private").presigned_get_url(tailoring.storage_path, expires=expires)
        if not url:
            raise CvNotFoundError("Download is unavailable for this storage backend.")
        return url

    def read_tailored_docx(self, db: Session, user_id: uuid.UUID, tailoring_id: uuid.UUID) -> tuple[bytes, str, str]:
        tailoring = self._owned_tailoring(db, user_id, tailoring_id)
        if tailoring.status != "completed" or not tailoring.storage_path or not tailoring.tailored_sections:
            raise CvProcessingError("Tailored CV is not ready for download.")
        sections = CvTailoredSections.model_validate(tailoring.tailored_sections)
        file_name = sanitize_docx_filename(sections.contact.name or "tailored", tailoring.job_title)
        return get_storage("private").get(tailoring.storage_path), file_name, DOCX_MEDIA_TYPE

    def _owned_document(self, db: Session, user_id: uuid.UUID, cv_document_id: uuid.UUID) -> CvDocument:
        cv = db.scalar(select(CvDocument).where(CvDocument.id == cv_document_id, CvDocument.user_id == user_id))
        if cv is None:
            raise CvNotFoundError(f"CV {cv_document_id} was not found.")
        return cv

    def _owned_tailoring(self, db: Session, user_id: uuid.UUID, tailoring_id: uuid.UUID) -> CvTailoring:
        tailoring = db.scalar(select(CvTailoring).where(CvTailoring.id == tailoring_id, CvTailoring.user_id == user_id))
        if tailoring is None:
            raise CvNotFoundError(f"Tailoring {tailoring_id} was not found.")
        return tailoring

    def _document_response(self, cv: CvDocument) -> CvDocumentResponse:
        return CvDocumentResponse(
            id=cv.id,
            title=cv.title,
            file_name=cv.file_name,
            file_type=cv.file_type,
            status=cv.status,
            error_message=cv.error_message,
            extracted_text_preview=(cv.extracted_text or "")[:500] or None,
            created_at=cv.created_at,
            updated_at=cv.updated_at,
        )

    def _tailoring_response(self, tailoring: CvTailoring) -> CvTailoringResponse:
        sections = None
        if tailoring.tailored_sections:
            sections = CvTailoredSections.model_validate(tailoring.tailored_sections)
        return CvTailoringResponse(
            id=tailoring.id,
            cv_document_id=tailoring.cv_document_id,
            job_title=tailoring.job_title,
            company=tailoring.company,
            job_description=tailoring.job_description,
            tailored_sections=sections,
            status=tailoring.status,
            model=tailoring.model,
            error_message=tailoring.error_message,
            created_at=tailoring.created_at,
            updated_at=tailoring.updated_at,
        )


cv_service = CvService()
