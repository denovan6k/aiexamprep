"""Material-scoped chat sessions and grounded replies."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ChatMessage, ChatThread, Material
from app.schemas.materials import (
    MaterialChatMessage,
    MaterialChatMessageResponse,
    MaterialChatSessionResponse,
)
from app.services.context_builder import ContextBuilder
from app.services.llm import (
    LlmAuthError,
    LlmCallError,
    LlmRateLimitError,
    is_llm_configured,
    llm_text,
)
from app.services.materials import materials_service


class MaterialChatSessionNotFoundError(Exception):
    pass


class MaterialChatUnavailableError(Exception):
    pass


class MaterialChatService:
    def create_session(
        self,
        db: Session,
        user_id: uuid.UUID,
        material_id: uuid.UUID,
        title: str | None = None,
    ) -> MaterialChatSessionResponse:
        material = materials_service._owned(db, user_id, material_id)  # noqa: SLF001
        session = ChatThread(
            user_id=user_id,
            title=title or f"Chat: {material.title}",
            title_source="user",
            course_id=material.course_id,
            material_ids=[str(material.id)],
        )
        db.add(session)
        db.flush()
        return self._session_response(session, material.id)

    def send_message(
        self,
        db: Session,
        user_id: uuid.UUID,
        material_id: uuid.UUID,
        session_id: uuid.UUID,
        content: str,
        model: str | None = None,
    ) -> MaterialChatMessageResponse:
        material = materials_service._owned(db, user_id, material_id)  # noqa: SLF001
        session = self._owned_session(db, user_id, material.id, session_id)
        chunks = materials_service.retrieve_chunks_semantic(
            db,
            user_id=user_id,
            query=content,
            material_ids=[material.id],
            limit=8,
            institution_id=None,
            course_id=None,
        )
        context = ContextBuilder(max_tokens=2400).build(chunks, query=content)
        if not context.chunks:
            raise MaterialChatUnavailableError(
                "This material does not have readable processed text yet."
            )

        user_message = ChatMessage(
            thread_id=session.id,
            role="user",
            content=content,
            material_id=material.id,
            message_metadata={"material_chat": True},
        )
        db.add(user_message)
        db.flush()

        answer = self._answer(material, content, context.prompt_text, model=model)
        metadata = {
            "material_chat": True,
            "material_id": str(material.id),
            "context_indicators": context.indicators,
            "token_estimate": context.token_estimate,
            "truncated": context.truncated,
        }
        assistant_message = ChatMessage(
            thread_id=session.id,
            role="assistant",
            content=answer,
            material_id=material.id,
            message_metadata=metadata,
        )
        db.add(assistant_message)
        db.flush()

        return MaterialChatMessageResponse(
            user_message=self._message_response(user_message),
            assistant_message=self._message_response(assistant_message),
            context_indicators=context.indicators,
            token_estimate=context.token_estimate,
            truncated=context.truncated,
        )

    def _answer(
        self,
        material: Material,
        content: str,
        context_text: str,
        *,
        model: str | None = None,
    ) -> str:
        if is_llm_configured():
            try:
                response = llm_text(
                    (
                        "You are Knorvex, a study assistant answering about exactly one uploaded "
                        "material. Use only the provided excerpts. If the excerpts do not contain "
                        "the answer, say the material does not include enough information."
                    ),
                    (
                        f"Material: {material.title}\n\n"
                        f"Allowed excerpts from this material only:\n{context_text}\n\n"
                        f"Student question:\n{content}"
                    ),
                    model=model,
                )
            except (LlmAuthError, LlmCallError, LlmRateLimitError):
                response = None
            if response:
                return response

        return (
            f"From {material.title}: "
            f"{context_text.splitlines()[-1][:900].strip()}"
        )

    def _owned_session(
        self,
        db: Session,
        user_id: uuid.UUID,
        material_id: uuid.UUID,
        session_id: uuid.UUID,
    ) -> ChatThread:
        session = db.scalar(
            select(ChatThread).where(ChatThread.id == session_id, ChatThread.user_id == user_id)
        )
        if session is None:
            raise MaterialChatSessionNotFoundError(
                f"Material chat session {session_id} was not found."
            )
        session_material_ids = [str(item) for item in (session.material_ids or [])]
        if [str(material_id)] != session_material_ids:
            raise MaterialChatSessionNotFoundError(
                f"Material chat session {session_id} was not found."
            )
        return session

    def _session_response(
        self, session: ChatThread, material_id: uuid.UUID
    ) -> MaterialChatSessionResponse:
        return MaterialChatSessionResponse(
            id=session.id,
            material_id=material_id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
        )

    def _message_response(self, message: ChatMessage) -> MaterialChatMessage:
        return MaterialChatMessage(
            id=message.id,
            session_id=message.thread_id,
            material_id=message.material_id,
            role=message.role,  # type: ignore[arg-type]
            content=message.content,
            metadata=message.message_metadata,
            created_at=message.created_at,
        )


material_chat_service = MaterialChatService()
