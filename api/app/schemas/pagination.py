from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")

DEFAULT_PAGE_LIMIT = 12
MAX_PAGE_LIMIT = 100


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)
    meta: dict[str, Any] | None = None
