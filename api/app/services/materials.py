"""Material upload, storage, extraction, and chunking."""
from __future__ import annotations

import re
import mimetypes
import uuid
import logging
from pathlib import Path
from typing import Any

from fastapi import UploadFile
from sqlalchemy import delete, func, or_, select, text as sql_text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.pagination import clamp_limit
from app.models import ChatMessage, ChatThread, Material, MaterialChunk, MediaAttachment
from app.schemas.materials import MaterialResponse, MaterialStatusResponse
from app.schemas.pagination import DEFAULT_PAGE_LIMIT, PaginatedResponse
from app.services.storage import get_storage
from app.services.embedding import embed_texts, cosine_similarity, embedding_min_similarity, rank_by_embedding
from app.services.extraction import (
    SUPPORTED_EXTENSIONS,
    ExtractionError,
    chunk_text,
    extract_text,
    normalize_extracted_text,
)

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
logger = logging.getLogger(__name__)


class MaterialNotFoundError(Exception):
    pass


class UnsupportedFileTypeError(Exception):
    pass


class FileTooLargeError(Exception):
    pass


def _safe_filename(name: str) -> str:
    return re.sub(r"[^\w.\-]+", "_", name or "upload")


class MaterialsService:
    def list_materials(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        course_id: uuid.UUID | None = None,
        q: str | None = None,
        status: str | None = None,
        source: str | None = None,
        limit: int = DEFAULT_PAGE_LIMIT,
        offset: int = 0,
    ) -> PaginatedResponse[MaterialResponse]:
        source_filter = (source or "").strip().lower()
        include_materials = source_filter in {"", "material", "all"}
        include_chat = source_filter in {"", "chat", "all"}
        if source_filter and source_filter not in {"material", "chat", "all"}:
            include_materials = True
            include_chat = True

        items: list[MaterialResponse] = []

        if include_materials:
            stmt = select(Material).where(Material.user_id == user_id)
            if course_id is not None:
                stmt = stmt.where(Material.course_id == course_id)
            if status and status.strip():
                stmt = stmt.where(Material.status == status.strip().lower())
            if q and q.strip():
                pattern = f"%{q.strip().lower()}%"
                stmt = stmt.where(
                    or_(
                        func.lower(Material.title).like(pattern),
                        func.lower(Material.file_name).like(pattern),
                    )
                )
            for material in db.scalars(stmt.order_by(Material.created_at.desc())).all():
                items.append(self._to_response(db, material))

        if include_chat:
            items.extend(
                self._list_chat_media_items(
                    db,
                    user_id,
                    course_id=course_id,
                    q=q,
                    status=status,
                )
            )

        items.sort(key=lambda item: item.created_at, reverse=True)
        safe_limit = clamp_limit(limit)
        safe_offset = max(0, offset)
        total = len(items)
        page = items[safe_offset : safe_offset + safe_limit]
        return PaginatedResponse(
            items=page,
            total=total,
            limit=safe_limit,
            offset=safe_offset,
        )

    def _list_chat_media_items(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        course_id: uuid.UUID | None = None,
        q: str | None = None,
        status: str | None = None,
    ) -> list[MaterialResponse]:
        stmt = (
            select(MediaAttachment, ChatThread.id, ChatThread.course_id)
            .outerjoin(ChatMessage, MediaAttachment.message_id == ChatMessage.id)
            .outerjoin(ChatThread, ChatMessage.thread_id == ChatThread.id)
            .where(MediaAttachment.user_id == user_id)
        )
        if course_id is not None:
            stmt = stmt.where(ChatThread.course_id == course_id)
        if q and q.strip():
            pattern = f"%{q.strip().lower()}%"
            stmt = stmt.where(func.lower(MediaAttachment.filename).like(pattern))
        rows = db.execute(stmt.order_by(MediaAttachment.created_at.desc())).all()

        items: list[MaterialResponse] = []
        status_filter = (status or "").strip().lower()
        for media, thread_id, thread_course_id in rows:
            item = self._media_to_response(
                media,
                course_id=thread_course_id,
                thread_id=thread_id,
            )
            if status_filter and item.status != status_filter:
                continue
            items.append(item)
        return items

    def _media_to_response(
        self,
        media: MediaAttachment,
        *,
        course_id: uuid.UUID | None,
        thread_id: uuid.UUID | None,
    ) -> MaterialResponse:
        title = Path(media.filename).stem.replace("_", " ") or media.filename
        preview = (media.parsed_content or "").strip()
        status = "processed" if preview else "uploaded"
        return MaterialResponse(
            id=media.id,
            course_id=course_id,
            institution_id=None,
            title=title,
            file_name=media.filename,
            file_type=media.file_type,
            status=status,
            extracted_text_preview=preview[:500] if preview else None,
            chunk_count=media.chunk_count or 0,
            created_at=media.created_at,
            source="chat",
            media_attachment_id=media.id,
            thread_id=thread_id,
            media_url=media.media_url or None,
        )

    def create_material(
        self,
        db: Session,
        user_id: uuid.UUID,
        upload: UploadFile,
        course_id: uuid.UUID | None,
        title: str | None,
        *,
        process_inline: bool = False,
    ) -> MaterialResponse:
        file_name = _safe_filename(upload.filename or "upload.txt")
        suffix = Path(file_name).suffix.lower()
        if suffix not in SUPPORTED_EXTENSIONS:
            raise UnsupportedFileTypeError(
                f"Unsupported file type {suffix or '(none)'}. "
                f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )

        content = upload.file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise FileTooLargeError("File exceeds the 25 MB upload limit.")

        material = Material(
            user_id=user_id,
            course_id=course_id,
            title=title or Path(file_name).stem.replace("_", " "),
            file_name=file_name,
            file_type=upload.content_type or suffix.lstrip("."),
            storage_path="",
            status="uploaded",
        )
        db.add(material)
        db.flush()

        storage_dir = UPLOAD_ROOT / str(material.id)
        storage_dir.mkdir(parents=True, exist_ok=True)
        storage_path = storage_dir / file_name
        storage_path.write_bytes(content)
        material.storage_path = str(storage_path)
        if process_inline:
            self._process_inline(db, material)
        else:
            self._queue_or_process(db, user_id, material)
        db.flush()
        return self._to_response(db, material)

    def create_institution_material(
        self,
        db: Session,
        user_id: uuid.UUID,
        institution_id: uuid.UUID,
        upload: UploadFile,
        title: str | None = None,
    ) -> MaterialResponse:
        file_name = _safe_filename(upload.filename or "upload.txt")
        suffix = Path(file_name).suffix.lower()
        if suffix not in SUPPORTED_EXTENSIONS:
            raise UnsupportedFileTypeError(
                f"Unsupported file type {suffix or '(none)'}. "
                f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )

        content = upload.file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise FileTooLargeError("File exceeds the 25 MB upload limit.")

        material = Material(
            user_id=user_id,
            institution_id=institution_id,
            course_id=None,
            title=title or Path(file_name).stem.replace("_", " "),
            file_name=file_name,
            file_type=upload.content_type or suffix.lstrip("."),
            storage_path="",
            status="uploaded",
        )
        db.add(material)
        db.flush()

        storage_dir = UPLOAD_ROOT / "institutions" / str(institution_id) / str(material.id)
        storage_dir.mkdir(parents=True, exist_ok=True)
        storage_path = storage_dir / file_name
        storage_path.write_bytes(content)
        material.storage_path = str(storage_path)
        self._queue_or_process(db, user_id, material)
        db.flush()
        return self._to_response(db, material)

    def get_material_status(
        self, db: Session, user_id: uuid.UUID, material_id: uuid.UUID
    ) -> MaterialStatusResponse:
        material = self._owned(db, user_id, material_id)
        chunk_count = int(
            db.scalar(
                select(func.count(MaterialChunk.id)).where(MaterialChunk.material_id == material.id)
            )
            or 0
        )
        embedded = False
        if chunk_count:
            embedded = (
                db.scalar(
                    select(func.count(MaterialChunk.id)).where(
                        MaterialChunk.material_id == material.id,
                        MaterialChunk.embedding.is_not(None),
                    )
                )
                or 0
            ) > 0

        error_message = None
        if material.status == "failed":
            preview = material.extracted_text_preview or ""
            error_message = preview.removeprefix("Extraction failed: ").strip() or preview or None

        processing_job_id = None
        from app.models import GenerationJob

        job = db.scalar(
            select(GenerationJob)
            .where(
                GenerationJob.material_id == material.id,
                GenerationJob.job_type == "material_processing",
                GenerationJob.status.in_(("queued", "running")),
            )
            .order_by(GenerationJob.created_at.desc())
        )
        if job is not None:
            processing_job_id = job.id

        return MaterialStatusResponse(
            id=material.id,
            status=material.status,  # type: ignore[arg-type]
            chunk_count=chunk_count,
            embedded=embedded,
            error_message=error_message,
            processing_job_id=processing_job_id,
        )

    def retrieve_blended_chunks(
        self,
        db: Session,
        user_id: uuid.UUID,
        institution_id: uuid.UUID | None,
        course_id: uuid.UUID | None,
        material_ids: list[uuid.UUID],
        count: int,
        query: str | None = None,
    ) -> list[dict[str, Any]]:
        limit = max(8, count * 2)
        if query:
            return self.retrieve_chunks_semantic(
                db,
                user_id=user_id,
                query=query,
                material_ids=material_ids,
                limit=limit,
                institution_id=institution_id,
                course_id=course_id,
            )

        personal_limit = limit // 2 if institution_id else limit
        institutional_limit = limit - personal_limit

        personal_query = (
            select(MaterialChunk)
            .join(MaterialChunk.material)
            .where(
                Material.user_id == user_id,
                Material.institution_id.is_(None),
                Material.status == "processed",
            )
            .order_by(MaterialChunk.chunk_index.asc())
            .limit(personal_limit)
        )
        if course_id:
            personal_query = personal_query.where(Material.course_id == course_id)
        if material_ids:
            personal_query = personal_query.where(MaterialChunk.material_id.in_(material_ids))

        personal_chunks = db.scalars(personal_query).all()
        personal = [
            {
                "id": chunk.id,
                "text": chunk.text,
                "material_title": chunk.material.title,
                "source": "personal",
                "_embedding": chunk.embedding,
            }
            for chunk in personal_chunks
        ]

        institutional: list[dict[str, Any]] = []
        if institution_id and institutional_limit > 0:
            institutional_query = (
                select(MaterialChunk)
                .join(MaterialChunk.material)
                .where(
                    Material.institution_id == institution_id,
                    Material.status == "processed",
                )
                .order_by(MaterialChunk.chunk_index.asc())
                .limit(institutional_limit)
            )
            institutional_chunks = db.scalars(institutional_query).all()
            institutional = [
                {
                    "id": chunk.id,
                    "text": chunk.text,
                    "material_title": chunk.material.title,
                    "source": "institution",
                    "_embedding": chunk.embedding,
                }
                for chunk in institutional_chunks
            ]

        blended: list[dict[str, Any]] = []
        max_len = max(len(personal), len(institutional))
        for index in range(max_len):
            if index < len(personal):
                blended.append(personal[index])
            if index < len(institutional):
                blended.append(institutional[index])
        return [self._public_chunk_payload(chunk) for chunk in blended[:limit]]

    def retrieve_chunks_semantic(
        self,
        db: Session,
        user_id: uuid.UUID,
        query: str | None,
        material_ids: list[uuid.UUID] | None,
        limit: int,
        institution_id: uuid.UUID | None = None,
        course_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        material_ids = material_ids or []
        safe_limit = max(1, limit)
        if not query or not query.strip():
            return self.retrieve_blended_chunks(
                db,
                user_id,
                institution_id=uuid.UUID(str(institution_id)) if institution_id else None,
                course_id=course_id,
                material_ids=material_ids,
                count=safe_limit,
            )[:safe_limit]

        material_chunks: list[dict[str, Any]] = []
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            material_chunks = self._retrieve_chunks_pgvector(
                db,
                user_id=user_id,
                institution_id=institution_id,
                course_id=course_id,
                material_ids=material_ids,
                query=query,
                limit=safe_limit,
            )

        if not material_chunks:
            candidates = self._retrieve_semantic_candidates(
                db,
                user_id=user_id,
                institution_id=institution_id,
                course_id=course_id,
                material_ids=material_ids,
                limit=max(safe_limit * 4, 16),
            )
            material_chunks = [
                self._public_chunk_payload(chunk)
                for chunk in rank_by_embedding(candidates, query, limit=safe_limit)
            ]

        media_chunks = self._retrieve_media_attachment_chunks(
            db,
            user_id=user_id,
            query=query,
            course_id=course_id,
            material_ids=material_ids,
            limit=safe_limit,
        )
        if not media_chunks:
            return material_chunks[:safe_limit]

        merged = self._merge_ranked_chunks(material_chunks, media_chunks, query=query, limit=safe_limit)
        return merged

    def _retrieve_media_attachment_chunks(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        query: str,
        course_id: uuid.UUID | None,
        material_ids: list[uuid.UUID],
        limit: int,
    ) -> list[dict[str, Any]]:
        """Rank chat-upload MediaAttachment text so Search can use the same library as Courses."""
        from app.services.embedding import keyword_score, rank_by_embedding

        stmt = select(MediaAttachment).where(
            MediaAttachment.user_id == user_id,
            MediaAttachment.parsed_content.is_not(None),
            MediaAttachment.chunk_count > 0,
        )
        if material_ids:
            stmt = stmt.where(MediaAttachment.id.in_(material_ids))
        if course_id is not None:
            stmt = (
                stmt.outerjoin(ChatMessage, MediaAttachment.message_id == ChatMessage.id)
                .outerjoin(ChatThread, ChatMessage.thread_id == ChatThread.id)
                .where(ChatThread.course_id == course_id)
            )

        attachments = db.scalars(stmt.order_by(MediaAttachment.created_at.desc()).limit(40)).all()
        if not attachments:
            return []

        candidates: list[dict[str, Any]] = []
        for attachment in attachments:
            text = (attachment.parsed_content or "").strip()
            if not text:
                continue
            pieces = chunk_text(
                text,
                max_chars=settings.material_chunk_size,
                overlap=settings.material_chunk_overlap,
                min_chars=getattr(settings, "material_min_chunk_size", 220),
            ) or [text[:6000]]
            title = Path(attachment.filename).stem.replace("_", " ") or attachment.filename
            for index, piece in enumerate(pieces):
                score = keyword_score(query, piece)
                candidates.append(
                    {
                        "id": f"media:{attachment.id}:{index}",
                        "chunk_id": f"media:{attachment.id}:{index}",
                        "text": piece,
                        "material_title": title,
                        "source": "chat",
                        "score": score,
                        "_embedding": None,
                    }
                )

        if not candidates:
            return []

        ranked = rank_by_embedding(candidates, query, limit=max(limit * 2, 8))
        # Prefer keyword hits when embeddings are weak/offline.
        ranked.sort(
            key=lambda item: max(
                float(item.get("semantic_score") or 0),
                float(item.get("score") or keyword_score(query, str(item.get("text") or ""))),
            ),
            reverse=True,
        )
        return [self._public_chunk_payload(chunk) for chunk in ranked[:limit]]

    @staticmethod
    def _merge_ranked_chunks(
        material_chunks: list[dict[str, Any]],
        media_chunks: list[dict[str, Any]],
        *,
        query: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        from app.services.embedding import keyword_score

        def _score(chunk: dict[str, Any]) -> float:
            return max(
                float(chunk.get("semantic_score") or 0),
                float(chunk.get("score") or 0),
                keyword_score(query, str(chunk.get("text") or "")),
            )

        merged = [{**chunk, "score": _score(chunk)} for chunk in [*material_chunks, *media_chunks]]
        merged.sort(key=lambda item: float(item.get("score") or 0), reverse=True)
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for chunk in merged:
            key = str(chunk.get("id") or chunk.get("chunk_id") or "")
            if not key or key in seen:
                continue
            seen.add(key)
            unique.append(chunk)
            if len(unique) >= limit:
                break
        return unique

    def _retrieve_chunks_pgvector(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        institution_id: uuid.UUID | None,
        course_id: uuid.UUID | None,
        material_ids: list[uuid.UUID],
        query: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        query_embedding = embed_texts([query])[0]
        vector = "[" + ",".join(str(value) for value in query_embedding) + "]"
        distance = MaterialChunk.embedding.op("<=>")(sql_text(f"'{vector}'::vector"))
        min_similarity = embedding_min_similarity()
        stmt = (
            select(MaterialChunk)
            .join(MaterialChunk.material)
            .where(Material.status == "processed", MaterialChunk.embedding.is_not(None))
            .order_by(distance.asc(), MaterialChunk.chunk_index.asc())
            .limit(max(limit * 4, 16))
        )
        if institution_id:
            stmt = stmt.where(
                (
                    (Material.user_id == user_id)
                    & Material.institution_id.is_(None)
                )
                | (Material.institution_id == institution_id)
            )
        else:
            stmt = stmt.where(Material.user_id == user_id, Material.institution_id.is_(None))
        if course_id:
            stmt = stmt.where(Material.course_id == course_id)
        if material_ids:
            stmt = stmt.where(MaterialChunk.material_id.in_(material_ids))

        try:
            chunks = db.scalars(stmt).all()
        except Exception:
            return []

        ranked: list[dict[str, Any]] = []
        for chunk in chunks:
            payload = self._chunk_payload(chunk)
            similarity = cosine_similarity(query_embedding, chunk.embedding or [])
            if similarity < min_similarity:
                continue
            payload["semantic_score"] = similarity
            ranked.append(payload)
            if len(ranked) >= limit:
                break
        return ranked

    def _retrieve_semantic_candidates(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        institution_id: uuid.UUID | None,
        course_id: uuid.UUID | None,
        material_ids: list[uuid.UUID],
        limit: int,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(MaterialChunk)
            .join(MaterialChunk.material)
            .where(Material.status == "processed")
            .order_by(MaterialChunk.chunk_index.asc())
            .limit(limit)
        )
        if institution_id:
            stmt = stmt.where(
                (
                    (Material.user_id == user_id)
                    & Material.institution_id.is_(None)
                )
                | (Material.institution_id == institution_id)
            )
        else:
            stmt = stmt.where(Material.user_id == user_id, Material.institution_id.is_(None))
        if course_id:
            stmt = stmt.where(Material.course_id == course_id)
        if material_ids:
            stmt = stmt.where(MaterialChunk.material_id.in_(material_ids))

        return [self._chunk_payload(chunk) for chunk in db.scalars(stmt).all()]

    def get_material(self, db: Session, user_id: uuid.UUID, material_id: uuid.UUID) -> MaterialResponse:
        return self._to_response(db, self._owned(db, user_id, material_id))

    def read_material_file(
        self, db: Session, user_id: uuid.UUID, material_id: uuid.UUID
    ) -> tuple[bytes, str, str]:
        material = self._owned(db, user_id, material_id)
        if not material.storage_path:
            raise MaterialNotFoundError(f"Material {material_id} was not found.")

        storage = get_storage("private")
        key = material.storage_path
        if storage.exists(key):
            content = storage.get(key)
        else:
            legacy_path = Path(key)
            if legacy_path.is_file():
                content = legacy_path.read_bytes()
            else:
                raise MaterialNotFoundError(f"Material {material_id} was not found.")

        media_type = mimetypes.guess_type(material.file_name)[0] or "application/octet-stream"
        return content, material.file_name, media_type

    def create_material_download_url(
        self,
        db: Session,
        user_id: uuid.UUID,
        material_id: uuid.UUID,
        *,
        expires: int = 300,
    ) -> str:
        material = self._owned(db, user_id, material_id)
        if not material.storage_path:
            raise MaterialNotFoundError(f"Material {material_id} was not found.")

        storage = get_storage("private")
        url = storage.presigned_get_url(material.storage_path, expires=expires)
        if not url:
            raise MaterialNotFoundError(f"Material {material_id} was not found.")
        return url

    def delete_material(self, db: Session, user_id: uuid.UUID, material_id: uuid.UUID) -> None:
        material = self._owned(db, user_id, material_id)
        storage = Path(material.storage_path) if material.storage_path else None
        db.delete(material)
        if storage and storage.exists():
            try:
                storage.unlink()
                storage.parent.rmdir()
            except OSError:
                pass

    def update_material_title(
        self, db: Session, user_id: uuid.UUID, material_id: uuid.UUID, title: str
    ) -> MaterialResponse:
        material = self._owned(db, user_id, material_id)
        material.title = title.strip()
        db.add(material)
        db.flush()
        return self._to_response(db, material)

    def reprocess_material(
        self, db: Session, user_id: uuid.UUID, material_id: uuid.UUID
    ) -> MaterialResponse:
        material = self._owned(db, user_id, material_id)
        db.execute(delete(MaterialChunk).where(MaterialChunk.material_id == material.id))
        db.flush()
        self._queue_or_process(db, user_id, material)
        db.flush()
        return self._to_response(db, material)

    def _process_inline(self, db: Session, material: Material) -> None:
        # Keep the whole parse → chunk → embed pipeline in-process so Search
        # works without a separate Arq worker (and avoid orphan stage jobs).
        self._process_parse(db, material, enqueue_next=False)
        if material.status == "parsed":
            self._process_chunk(db, material, enqueue_next=False)
        if material.status == "chunked":
            self._process_embed(db, material, enqueue_next=False)

    def _queue_or_process(self, db: Session, user_id: uuid.UUID, material: Material) -> None:
        material.status = "pending"
        db.add(material)
        db.flush()

        from app.services.jobs import jobs_service, redis_available

        should_queue = bool(settings.queue_material_processing) and redis_available()
        if should_queue:
            job = jobs_service.enqueue_parse_job(db, user_id, material.id)
            db.flush()
            try:
                jobs_service.dispatch_parse_job(job.id)
            except Exception as exc:
                jobs_service.mark_dispatch_failed(db, job.id, str(exc))
                logger.warning(
                    "material_parse_dispatch_failed material_id=%s; falling back to inline",
                    material.id,
                )
                self._process_inline(db, material)
        else:
            self._process_inline(db, material)

    def _process_parse(self, db: Session, material: Material, *, enqueue_next: bool = True) -> None:
        material.status = "processing"
        try:
            text = normalize_extracted_text(extract_text(Path(material.storage_path)))
            material.extracted_text_preview = text[:500]
            raw_path = Path(material.storage_path).with_suffix(".extracted.txt")
            raw_path.write_text(text, encoding="utf-8")

            material.status = "parsed"

            if enqueue_next:
                from app.services.jobs import jobs_service, redis_available

                if redis_available():
                    job = jobs_service.enqueue_chunk_job(db, material.user_id, material.id)
                    db.flush()
                    try:
                        jobs_service.dispatch_chunk_job(job.id)
                    except Exception as exc:
                        jobs_service.mark_dispatch_failed(db, job.id, str(exc))
        except ExtractionError as exc:
            material.status = "parse_failed"
            material.extracted_text_preview = f"Extraction failed: {exc}"
        db.add(material)

    def _process_chunk(self, db: Session, material: Material, *, enqueue_next: bool = True) -> None:
        try:
            raw_path = Path(material.storage_path).with_suffix(".extracted.txt")
            if raw_path.exists():
                text = raw_path.read_text(encoding="utf-8")
            else:
                text = normalize_extracted_text(extract_text(Path(material.storage_path)))

            chunks = chunk_text(
                text,
                max_chars=settings.material_chunk_size,
                overlap=settings.material_chunk_overlap,
                min_chars=getattr(settings, "material_min_chunk_size", 220),
            )
            if not chunks:
                material.status = "failed"
                material.extracted_text_preview = "No text could be chunked."
                db.add(material)
                return

            db.execute(delete(MaterialChunk).where(MaterialChunk.material_id == material.id))
            for index, chunk in enumerate(chunks):
                db.add(
                    MaterialChunk(
                        material_id=material.id,
                        chunk_index=index,
                        text=chunk,
                        token_count=max(1, len(chunk) // 4),
                        embedding=None,
                    )
                )
            material.status = "chunked"
            db.flush()

            if enqueue_next:
                from app.services.jobs import jobs_service, redis_available

                if redis_available():
                    job = jobs_service.enqueue_embed_job(db, material.user_id, material.id)
                    db.flush()
                    try:
                        jobs_service.dispatch_embed_job(job.id)
                    except Exception as exc:
                        jobs_service.mark_dispatch_failed(db, job.id, str(exc))
        except Exception as exc:
            material.status = "failed"
            material.extracted_text_preview = f"Chunking failed: {exc}"
        db.add(material)

    def _process_embed(self, db: Session, material: Material, *, enqueue_next: bool = True) -> None:
        try:
            chunks_records = db.scalars(
                select(MaterialChunk)
                .where(MaterialChunk.material_id == material.id)
                .order_by(MaterialChunk.chunk_index.asc())
            ).all()
            texts = [c.text for c in chunks_records]
            if texts:
                embeddings = embed_texts(texts)
                for index, c in enumerate(chunks_records):
                    if index < len(embeddings):
                        c.embedding = embeddings[index]
                        db.add(c)

            material.status = "processed"
            material.extracted_text_preview = (material.extracted_text_preview or "")[:500]

            try:
                from app.services.generation_profiles import apply_upload_profiles
                from app.services.jobs import jobs_service, redis_available
                from app.services.material_insights import ensure_material_insights

                if enqueue_next and redis_available():
                    job = jobs_service.enqueue_generation_profiles(db, material.user_id, material.id)
                    db.flush()
                    try:
                        jobs_service.dispatch_generation_profiles(job.id)
                    except Exception as exc:
                        jobs_service.mark_dispatch_failed(db, job.id, str(exc))
                        logger.exception("generation_profile_dispatch_failed material_id=%s", material.id)
                        ensure_material_insights(db, material)
                        apply_upload_profiles(db, material)
                else:
                    ensure_material_insights(db, material)
                    apply_upload_profiles(db, material)
            except Exception:
                logger.exception("generation_profile_upload_hook_failed material_id=%s", material.id)
        except Exception as exc:
            material.status = "failed"
            material.extracted_text_preview = f"Embedding failed: {exc}"
        db.add(material)

    def _public_chunk_payload(self, chunk: dict[str, Any]) -> dict[str, Any]:
        payload = dict(chunk)
        payload.pop("_embedding", None)
        return payload

    def _chunk_payload(self, chunk: MaterialChunk) -> dict[str, Any]:
        source = "institution" if chunk.material.institution_id else "personal"
        return {
            "id": chunk.id,
            "text": chunk.text,
            "material_title": chunk.material.title,
            "source": source,
            "_embedding": chunk.embedding,
        }

    def _owned(self, db: Session, user_id: uuid.UUID, material_id: uuid.UUID) -> Material:
        material = db.scalar(
            select(Material).where(Material.id == material_id, Material.user_id == user_id)
        )
        if material is None:
            raise MaterialNotFoundError(f"Material {material_id} was not found.")
        return material

    def _to_response(self, db: Session, material: Material) -> MaterialResponse:
        chunk_count = int(
            db.scalar(
                select(func.count(MaterialChunk.id)).where(MaterialChunk.material_id == material.id)
            )
            or 0
        )
        return MaterialResponse(
            id=material.id,
            course_id=material.course_id,
            institution_id=material.institution_id,
            title=material.title,
            file_name=material.file_name,
            file_type=material.file_type,
            status=material.status,
            extracted_text_preview=material.extracted_text_preview,
            chunk_count=chunk_count,
            created_at=material.created_at,
            source="material",
        )


materials_service = MaterialsService()
