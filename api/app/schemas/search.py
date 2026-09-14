from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    course_id: UUID | None = None
    material_ids: list[UUID] = Field(default_factory=list, max_length=25)
    limit: int = Field(default=8, ge=1, le=20)


class SearchCitation(BaseModel):
    index: int
    chunk_id: str
    material_title: str
    source: str
    excerpt: str


class SearchResult(BaseModel):
    chunk_id: str
    material_title: str
    source: str
    excerpt: str
    score: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]


class AskSearchRequest(SearchRequest):
    max_subqueries: int = Field(default=3, ge=1, le=3)


class RetrievalPlanStep(BaseModel):
    query: str
    reason: str


class AskSearchResponse(BaseModel):
    query: str
    plan: list[RetrievalPlanStep]
    answer: str
    citations: list[SearchCitation]
    token_estimate: int
    truncated: bool
    used_fallback: bool = False
