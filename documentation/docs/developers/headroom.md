---
title: Headroom compression
description: Optional Headroom context compression for Knorvex LLM prompts.
---

# Headroom compression

Knorvex can optionally compress retrieved study material and tool outputs with [Headroom](https://docs.headroomlabs.ai/docs) before they reach the LLM. Compression is **off by default**, fail-open, and gated per flow.

Savings reduce **provider** token cost. User credit charges still use fixed estimates unless billing is updated separately.

## When to enable

Enable on staging first when chat RAG, quiz generation, or Professor Agent MCP tool results send large plain-text or JSON payloads. Skip if prompts are already small or you cannot add the `headroom-ai` dependency to the API image.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `HEADROOM_ENABLED` | `false` | Master kill switch |
| `HEADROOM_COMPRESS_CHAT` | `true` | Compress RAG excerpts in `ContextBuilder` and `<untrusted_material>` fences |
| `HEADROOM_COMPRESS_GENERATION` | `true` | Compress text inside `<source>` bodies for quiz / flashcard / study artifacts |
| `HEADROOM_COMPRESS_MCP_TOOLS` | `true` | Compress MCP tool result messages in the agent tool loop |
| `HEADROOM_COMPRESS_ATTACHMENTS` | `false` | Compress `<untrusted_attached_media>` (off initially) |
| `HEADROOM_EXTRA` | `core` | Install hint only: use `headroom-ai` core, or `[ml]` for Kompress text models |

All per-flow flags are ignored when `HEADROOM_ENABLED=false`.

## Integration points

- `api/app/services/headroom_compression.py` — wrapper around `headroom.compress()`
- `ContextBuilder.build()` — chat, material chat, search Ask
- `build_quiz_corpus()` — generation corpus; preserves `chunk_id` / `title` attributes
- `llm_json` / `llm_text` / `llm_text_stream` — second-pass compression of material fences
- `agent_mcp.run_tool_loop()` — tool result content

## Install notes

- Dependency: `headroom-ai>=0.21.0` in `api/pyproject.toml` (core only in v1).
- Prefer Docker for local API work on Windows (Headroom may need a native toolchain for sdist builds).
- Optional Phase 2: install `headroom-ai[ml]` and set `HEADROOM_EXTRA=ml` if plain-text savings are insufficient; expect a larger image and HuggingFace model download.

## Quality & ops

- Fail-open: import or runtime errors log a warning and pass the original text.
- Generation compresses only source **bodies**, never XML tags or `chunk_id` attributes.
- Benchmark locally:

```bash
cd api
python scripts/benchmark_headroom.py
```

Toggle `HEADROOM_ENABLED=true` in `api/.env` (or compose env) for staging smoke tests, then compare chat quality and quiz citation integrity before production.
