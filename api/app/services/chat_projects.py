"""Chat project CRUD and helpers."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ChatProject, ChatThread, Material, User
from app.schemas.chat import ChatProjectResponse


class ChatProjectNotFoundError(Exception):
    pass


class ChatProjectError(Exception):
    pass


def _project_material_ids(project: ChatProject) -> list[uuid.UUID]:
    return [uuid.UUID(item) for item in (project.material_ids or [])]


def _validate_material_ids(db: Session, user_id: uuid.UUID, material_ids: list[uuid.UUID]) -> list[str]:
    if not material_ids:
        return []
    owned = set(
        db.scalars(
            select(Material.id).where(
                Material.user_id == user_id,
                Material.id.in_(material_ids),
            )
        ).all()
    )
    missing = [mid for mid in material_ids if mid not in owned]
    if missing:
        raise ChatProjectError("One or more materials were not found.")
    # Preserve caller order, dedupe
    seen: set[uuid.UUID] = set()
    ordered: list[str] = []
    for mid in material_ids:
        if mid in seen:
            continue
        seen.add(mid)
        ordered.append(str(mid))
    return ordered


def _thread_count(db: Session, project_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count(ChatThread.id)).where(ChatThread.project_id == project_id)
        )
        or 0
    )


def project_response(db: Session, project: ChatProject) -> ChatProjectResponse:
    return ChatProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        instructions=project.instructions,
        material_ids=_project_material_ids(project),
        starred=project.starred,
        archived=project.archived,
        thread_count=_thread_count(db, project.id),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def owned_project(db: Session, user_id: uuid.UUID, project_id: uuid.UUID) -> ChatProject:
    project = db.scalar(
        select(ChatProject).where(ChatProject.id == project_id, ChatProject.user_id == user_id)
    )
    if project is None:
        raise ChatProjectNotFoundError(f"Project {project_id} was not found.")
    return project


class ChatProjectsService:
    def list_projects(
        self, db: Session, user_id: uuid.UUID, *, include_archived: bool = False
    ) -> list[ChatProjectResponse]:
        query = select(ChatProject).where(ChatProject.user_id == user_id)
        if not include_archived:
            query = query.where(ChatProject.archived.is_(False))
        projects = db.scalars(
            query.order_by(ChatProject.starred.desc(), ChatProject.updated_at.desc())
        ).all()
        return [project_response(db, project) for project in projects]

    def get_project(
        self, db: Session, user_id: uuid.UUID, project_id: uuid.UUID
    ) -> ChatProjectResponse:
        return project_response(db, owned_project(db, user_id, project_id))

    def create_project(
        self,
        db: Session,
        user: User,
        *,
        name: str,
        description: str | None = None,
        instructions: str | None = None,
        material_ids: list[uuid.UUID] | None = None,
    ) -> ChatProjectResponse:
        cleaned_name = name.strip()
        if not cleaned_name:
            raise ChatProjectError("Project name is required.")
        stored_materials = _validate_material_ids(db, user.id, material_ids or [])
        project = ChatProject(
            user_id=user.id,
            name=cleaned_name[:255],
            description=(description.strip() if description else None) or None,
            instructions=(instructions.strip() if instructions else None) or None,
            material_ids=stored_materials,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project_response(db, project)

    def update_project(
        self,
        db: Session,
        user_id: uuid.UUID,
        project_id: uuid.UUID,
        *,
        name: str | None = None,
        description: str | None = None,
        instructions: str | None = None,
        material_ids: list[uuid.UUID] | None = None,
        starred: bool | None = None,
        archived: bool | None = None,
        unset_description: bool = False,
        unset_instructions: bool = False,
    ) -> ChatProjectResponse:
        project = owned_project(db, user_id, project_id)
        if name is not None:
            cleaned = name.strip()
            if not cleaned:
                raise ChatProjectError("Project name is required.")
            project.name = cleaned[:255]
        if unset_description:
            project.description = None
        elif description is not None:
            project.description = description.strip() or None
        if unset_instructions:
            project.instructions = None
        elif instructions is not None:
            project.instructions = instructions.strip() or None
        if material_ids is not None:
            project.material_ids = _validate_material_ids(db, user_id, material_ids)
        if starred is not None:
            project.starred = starred
        if archived is not None:
            project.archived = archived
            if archived:
                project.starred = False
        db.commit()
        db.refresh(project)
        return project_response(db, project)

    def delete_project(self, db: Session, user_id: uuid.UUID, project_id: uuid.UUID) -> None:
        project = owned_project(db, user_id, project_id)
        # ON DELETE SET NULL unassigns threads; explicit clear keeps behavior clear.
        threads = db.scalars(
            select(ChatThread).where(
                ChatThread.user_id == user_id,
                ChatThread.project_id == project_id,
            )
        ).all()
        for thread in threads:
            thread.project_id = None
        db.delete(project)
        db.commit()


chat_projects_service = ChatProjectsService()
