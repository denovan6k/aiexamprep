from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.search import AskSearchRequest, SearchRequest, SearchResponse
from app.services.search import search_service

router = APIRouter()


@router.post("", response_model=SearchResponse)
def search_study_materials(
    request: SearchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SearchResponse:
    return search_service.search(db, user, request)


@router.post("/ask")
def ask_study_materials(
    request: AskSearchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    return StreamingResponse(
        search_service.ask_events(db, user, request),
        media_type="application/x-ndjson",
    )
