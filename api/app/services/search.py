"""Hybrid study search and grounded Ask retrieval."""
from __future__ import annotations

import re
import uuid
import json
from typing import Any

from sqlalchemy.orm import Session

from app.models import User
from app.schemas.search import (
    AskSearchResponse,
    RetrievalPlanStep,
    SearchCitation,
    SearchRequest,
    SearchResponse,
    SearchResult,
)
from app.services.context_builder import ContextBuilder
from app.services.embedding import MIN_RELEVANCE_SCORE, keyword_score, rank_by_keyword
from app.services.llm import LlmCallError, llm_json, llm_text
from app.services.materials import materials_service

MAX_SUBQUERIES = 3


def _clean_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _excerpt(text: str, *, query: str | None = None, max_chars: int = 420) -> str:
    cleaned = _clean_space(text)
    if len(cleaned) <= max_chars:
        return cleaned
    if query:
        terms = [re.escape(term) for term in re.findall(r"[A-Za-z][A-Za-z0-9_-]{3,}", query)]
        if terms:
            match = re.search("|".join(terms), cleaned, flags=re.IGNORECASE)
            if match:
                start = max(0, match.start() - max_chars // 3)
                end = min(len(cleaned), start + max_chars)
                prefix = "..." if start > 0 else ""
                suffix = "..." if end < len(cleaned) else ""
                return f"{prefix}{cleaned[start:end].strip()}{suffix}"
    return f"{cleaned[:max_chars].strip()}..."


def _dedupe_chunks(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for chunk in chunks:
        chunk_id = str(chunk.get("id") or chunk.get("chunk_id") or "")
        if not chunk_id or chunk_id in seen:
            continue
        seen.add(chunk_id)
        unique.append(chunk)
    return unique


def _fallback_subqueries(query: str, max_subqueries: int) -> list[str]:
    parts = [
        _clean_space(part)
        for part in re.split(r"\b(?:and|or|versus|vs\.?|compare|contrast)\b|[?;]", query, flags=re.IGNORECASE)
        if _clean_space(part)
    ]
    queries = [query]
    for part in parts:
        if part.lower() != query.lower() and part not in queries:
            queries.append(part)
    return queries[:max_subqueries]


class SearchService:
    def __init__(self, *, context_builder: ContextBuilder | None = None) -> None:
        self.context_builder = context_builder or ContextBuilder(max_tokens=2600)

    def search(self, db: Session, user: User, request: SearchRequest) -> SearchResponse:
        chunks = self._retrieve(
            db,
            user,
            query=request.query,
            course_id=request.course_id,
            material_ids=request.material_ids,
            limit=request.limit,
        )
        results = [
            SearchResult(
                chunk_id=str(chunk.get("id") or chunk.get("chunk_id")),
                material_title=str(chunk.get("material_title") or "Material"),
                source=str(chunk.get("source") or "personal"),
                excerpt=_excerpt(str(chunk.get("text") or ""), query=request.query),
                score=float(chunk.get("score") or keyword_score(request.query, str(chunk.get("text") or ""))),
            )
            for chunk in chunks[: request.limit]
        ]
        return SearchResponse(query=request.query, results=results)

    def ask(self, db: Session, user: User, request) -> AskSearchResponse:
        plan, context, citations = self._retrieve_for_ask(db, user, request)
        answer, used_fallback = self._synthesize(request.query, context.prompt_text, citations)
        return AskSearchResponse(
            query=request.query,
            plan=plan,
            answer=answer,
            citations=citations,
            token_estimate=context.token_estimate,
            truncated=context.truncated,
            used_fallback=used_fallback,
        )

    def ask_events(self, db: Session, user: User, request):
        plan, context, citations = self._retrieve_for_ask(db, user, request)
        yield _event("retrieval_plan", {"query": request.query, "plan": [step.model_dump(mode="json") for step in plan]})
        answer, used_fallback = self._synthesize(request.query, context.prompt_text, citations)
        yield _event("answer", {"answer": answer, "used_fallback": used_fallback})
        yield _event(
            "citations",
            {
                "citations": [citation.model_dump(mode="json") for citation in citations],
                "token_estimate": context.token_estimate,
                "truncated": context.truncated,
            },
        )
        yield _event("done", {})

    def _retrieve_for_ask(self, db: Session, user: User, request):
        plan = self._plan_queries(request.query, request.max_subqueries)
        all_chunks: list[dict[str, Any]] = []
        for step in plan:
            all_chunks.extend(
                self._retrieve(
                    db,
                    user,
                    query=step.query,
                    course_id=request.course_id,
                    material_ids=request.material_ids,
                    limit=max(4, request.limit),
                )
            )

        ranked = rank_by_keyword(_dedupe_chunks(all_chunks), _plan_query_text(plan), limit=request.limit)
        context = self.context_builder.build(ranked, query=request.query, inclusion_level="chunks")
        citations = [
            SearchCitation(
                index=index,
                chunk_id=str(chunk.get("id") or chunk.get("chunk_id")),
                material_title=str(chunk.get("material_title") or "Material"),
                source=str(chunk.get("source") or "personal"),
                excerpt=_excerpt(str(chunk.get("text") or ""), query=request.query, max_chars=320),
            )
            for index, chunk in enumerate(context.chunks, start=1)
        ]
        return plan, context, citations

    def _retrieve(
        self,
        db: Session,
        user: User,
        *,
        query: str,
        course_id: uuid.UUID | None,
        material_ids: list[uuid.UUID],
        limit: int,
    ) -> list[dict[str, Any]]:
        chunks = materials_service.retrieve_chunks_semantic(
            db,
            user_id=user.id,
            query=query,
            material_ids=material_ids,
            limit=max(1, limit),
            institution_id=user.institution_id,
            course_id=course_id,
        )
        scored: list[dict[str, Any]] = []
        for chunk in chunks:
            text = str(chunk.get("text") or "")
            keyword = keyword_score(query, text)
            semantic = float(chunk.get("semantic_score") or 0)
            score = max(keyword, semantic)
            if score < MIN_RELEVANCE_SCORE:
                continue
            enriched = dict(chunk)
            enriched["score"] = score
            scored.append(enriched)
        scored.sort(key=lambda item: float(item.get("score") or 0), reverse=True)
        return scored[:limit]

    def _plan_queries(self, query: str, max_subqueries: int) -> list[RetrievalPlanStep]:
        safe_max = min(MAX_SUBQUERIES, max(1, max_subqueries))
        planned = llm_json(
            "Create concise study-search retrieval subqueries. Return JSON with a 'queries' array of strings.",
            (
                f"Question: {query}\n"
                f"Return at most {safe_max} search queries. Keep them exam-focused and do not answer."
            ),
        )
        raw_queries = planned.get("queries") if isinstance(planned, dict) else None
        queries = [str(item).strip() for item in raw_queries or [] if str(item).strip()]
        if not queries:
            queries = _fallback_subqueries(query, safe_max)
        queries = queries[:safe_max]
        if not queries:
            queries = [query]
        return [
            RetrievalPlanStep(
                query=item,
                reason="Retrieve material passages that can support the final answer.",
            )
            for item in queries
        ]

    def _synthesize(
        self,
        query: str,
        context_text: str,
        citations: list[SearchCitation],
    ) -> tuple[str, bool]:
        if not citations:
            return (
                "I could not find matching material in your uploaded study sources yet. Upload or process relevant notes, then try again.",
                True,
            )

        citation_hint = ", ".join(f"[{citation.index}]" for citation in citations)
        prompt = (
            "Use only the cited study context to answer. Cite each key claim using bracketed citation numbers.\n\n"
            f"Question: {query}\n\n"
            f"Context:\n{context_text}\n\n"
            f"Available citations: {citation_hint}"
        )
        try:
            answer = llm_text(
                "You are a precise exam-prep tutor. If the context is insufficient, say what is missing.",
                prompt,
            )
        except LlmCallError:
            answer = None
        if answer:
            return answer, False

        lead = citations[0]
        supporting = " ".join(f"[{citation.index}] {citation.excerpt}" for citation in citations[:3])
        return (
            f"Based on your materials, the strongest matching source is {lead.material_title} [{lead.index}]. "
            f"Relevant evidence: {supporting}",
            True,
        )


def _plan_query_text(plan: list[RetrievalPlanStep]) -> str:
    return " ".join(step.query for step in plan)


def _event(event_type: str, payload: dict[str, Any]) -> str:
    return json.dumps({"type": event_type, **payload}, default=str) + "\n"


search_service = SearchService()
