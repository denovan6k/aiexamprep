from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ChatMessage, ChatThread, User
from app.schemas.admin import AdminChatMessage, AdminChatThreadSummary
from app.schemas.pagination import PaginatedResponse
from app.services.admin.audit import AdminAuditService


class AdminChatService:
    def __init__(self) -> None:
        self.audit = AdminAuditService()

    def list_threads(
        self,
        db: Session,
        *,
        admin: User,
        user_id: uuid.UUID,
        offset: int = 0,
        limit: int = 20,
    ) -> PaginatedResponse[AdminChatThreadSummary]:
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"User {user_id} was not found.")

        threads = db.scalars(
            select(ChatThread)
            .where(ChatThread.user_id == user_id)
            .order_by(ChatThread.updated_at.desc())
        ).all()

        items: list[AdminChatThreadSummary] = []
        for thread in threads:
            message_count = int(
                db.scalar(
                    select(func.count()).select_from(ChatMessage).where(ChatMessage.thread_id == thread.id)
                )
                or 0
            )
            items.append(
                AdminChatThreadSummary(
                    id=thread.id,
                    title=thread.title,
                    message_count=message_count,
                    created_at=thread.created_at,
                    updated_at=thread.updated_at,
                )
            )

        self.audit.log(
            db,
            admin=admin,
            action="chat.threads.list",
            target_type="user",
            target_id=user_id,
            metadata={"thread_count": len(items)},
        )
        db.commit()

        total = len(items)
        page = items[offset : offset + limit]
        return PaginatedResponse(items=page, total=total, limit=limit, offset=offset)

    def list_messages(
        self,
        db: Session,
        *,
        admin: User,
        user_id: uuid.UUID,
        thread_id: uuid.UUID,
        offset: int = 0,
        limit: int = 50,
    ) -> PaginatedResponse[AdminChatMessage]:
        thread = db.get(ChatThread, thread_id)
        if thread is None or thread.user_id != user_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Thread {thread_id} was not found.")

        messages = db.scalars(
            select(ChatMessage)
            .where(ChatMessage.thread_id == thread_id)
            .order_by(ChatMessage.created_at.asc())
        ).all()

        self.audit.log(
            db,
            admin=admin,
            action="chat.messages.read",
            target_type="chat_thread",
            target_id=thread_id,
            metadata={"user_id": str(user_id), "message_count": len(messages)},
        )
        db.commit()

        items = [
            AdminChatMessage(
                id=message.id,
                role=message.role,
                content=message.content[:5000],
                created_at=message.created_at,
            )
            for message in messages
        ]
        total = len(items)
        page = items[offset : offset + limit]
        return PaginatedResponse(items=page, total=total, limit=limit, offset=offset)
