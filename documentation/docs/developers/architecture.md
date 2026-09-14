---
title: Architecture
description: High-level Knorvex system architecture for the FastAPI and Next.js monorepo.
---

# Architecture

Knorvex is an agentic exam-prep SaaS: students upload materials, chat with grounded AI, use Professor Agents, and generate quizzes, flashcards, and mocks — with Stripe billing and community features.

## Runtime shape

```text
Browser → Next.js (client/) → FastAPI (api/)
                            → Postgres + pgvector
                            → Redis + Arq workers
                            → Gemini / OpenAI / Anthropic / OpenRouter
                            → Stripe
                            → Media (local / Cloudinary / S3)
```

## Frontend (`client/`)

- Next.js App Router, React, TypeScript
- Tailwind + shadcn/Radix UI
- TanStack Query for server state
- AI SDK for streaming chat
- Public marketing pages + private workspace (chat, quizzes, flashcards, agents, community, billing, admin)

## Backend (`api/`)

- FastAPI + Pydantic Settings
- SQLAlchemy 2 + Alembic migrations
- PostgreSQL with **pgvector** for embeddings / RAG
- Redis + **Arq** for async jobs (ingest, generation)
- Jinja prompt templates
- Stripe for subscriptions and webhooks

## AI layer

- Multi-provider platform LLM registry (Gemini, OpenAI, Anthropic, OpenRouter) gated by env API keys
- Live model catalogs from each provider; OpenRouter alone exposes free/paid pricing metadata
- Retrieval-augmented generation from material chunks
- Optional **Headroom** context compression on RAG excerpts, generation corpora, and MCP tool results (`HEADROOM_ENABLED`; see [Headroom compression](./headroom))
- Professor Agent context injected into generation prompts
- Structured generation for quizzes / flashcards with validation and retries
- Chat streaming to the client; long work offloaded to workers
- Optional interactive chat visualizations via `render_visualization` (see [Chat visualizations](./chat-visualizations))
- Optional bring-your-own-key (BYOK) for user-saved OpenAI / Anthropic keys

## Major product domains

| Domain | Responsibility |
|--------|----------------|
| Auth / sessions | Register, login, email verification, password reset |
| Courses & materials | Upload, parse, chunk, embed |
| Chat & media | Threads, streaming, attachments |
| Agents | Professor-style profiles |
| Quizzes & flashcards | Generate, play, review, edit |
| Progress / study | Weak topics and plans |
| Billing | Plans, credits, Stripe |
| Community / blog | Groups, threads, content |
| Admin | Users, moderation, subscriptions, support |

## Repository layout

```text
api/app/
  core/          # config, database, security, rate limits
  models/        # SQLAlchemy entities
  schemas/       # Pydantic request/response models
  routes/        # HTTP routers
  services/      # business logic
  workers/       # Arq tasks
  prompts/       # Jinja LLM prompts
  emails/        # Transactional Jinja HTML/text templates (OTP, welcome, login alert, contact)
client/          # Next.js app
documentation/   # Published Docusaurus docs
docs/            # Internal planning / ops notes only
```

Transactional email templates live under `api/app/emails/templates/` with brand tokens in `renderer.py` (purple/teal/mint). Keep table-based inline CSS for inbox clients.

## Design philosophy (product)

1. Material-first practice from the user’s notes
2. Professor-style agents, not a generic chatbot playground
3. Progress that drives the next practice block
4. Calm, deliberate exam prep
5. Privacy-aware sharing of derived study artifacts
