from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import ProductEvent, User
from app.schemas.core_study import ProductEventBatchRequest, ProductEventBatchResponse

router = APIRouter()


@router.post("/events/batch", response_model=ProductEventBatchResponse)
def ingest_event_batch(
    request: ProductEventBatchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProductEventBatchResponse:
    requested_ids = {event.event_id for event in request.events}
    existing_ids = set(
        db.scalars(
            select(ProductEvent.event_id).where(
                ProductEvent.user_id == user.id,
                ProductEvent.event_id.in_(requested_ids),
            )
        ).all()
    )
    seen = set(existing_ids)
    accepted = 0
    duplicates = 0
    for event in request.events:
        if event.event_id in seen:
            duplicates += 1
            continue
        seen.add(event.event_id)
        try:
            with db.begin_nested():
                db.add(
                    ProductEvent(
                        user_id=user.id,
                        event_id=event.event_id,
                        name=event.name,
                        properties=event.properties,
                        occurred_at=event.occurred_at,
                    )
                )
                db.flush()
        except IntegrityError:
            duplicates += 1
        else:
            accepted += 1
    db.commit()
    return ProductEventBatchResponse(accepted=accepted, duplicates=duplicates)
