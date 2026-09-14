"""Arq task entrypoints."""

from __future__ import annotations

import asyncio

from app.services.jobs import (
    execute_flashcard_generation_job,
    execute_generation_profiles_job,
    execute_parse_job,
    execute_chunk_job,
    execute_embed_job,
    execute_quiz_generation_job,
    execute_study_artifact_generation_job,
)


async def process_quiz_generation(ctx: dict, job_id: str) -> None:
    await asyncio.to_thread(execute_quiz_generation_job, job_id)


async def process_flashcard_generation(ctx: dict, job_id: str) -> None:
    await asyncio.to_thread(execute_flashcard_generation_job, job_id)


async def process_parse(ctx: dict, job_id: str) -> None:
    await asyncio.to_thread(execute_parse_job, job_id)


async def process_chunk(ctx: dict, job_id: str) -> None:
    await asyncio.to_thread(execute_chunk_job, job_id)


async def process_embed(ctx: dict, job_id: str) -> None:
    await asyncio.to_thread(execute_embed_job, job_id)


async def process_generation_profiles(ctx: dict, job_id: str) -> None:
    await asyncio.to_thread(execute_generation_profiles_job, job_id)


async def process_study_artifact_generation(ctx: dict, job_id: str) -> None:
    await asyncio.to_thread(execute_study_artifact_generation_job, job_id)
