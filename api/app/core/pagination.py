from __future__ import annotations

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.schemas.pagination import DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT


def clamp_limit(limit: int) -> int:
    return max(1, min(limit, MAX_PAGE_LIMIT))


def paginate(
    db: Session,
    stmt: Select,
    *,
    limit: int = DEFAULT_PAGE_LIMIT,
    offset: int = 0,
) -> tuple[list, int]:
    safe_limit = clamp_limit(limit)
    safe_offset = max(0, offset)
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = int(db.scalar(count_stmt) or 0)
    rows = db.execute(stmt.limit(safe_limit).offset(safe_offset)).all()
    if rows and len(rows[0]) == 1:
        items = [row[0] for row in rows]
    else:
        items = rows
    return items, total
