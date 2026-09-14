---
title: API overview
description: High-level map of Knorvex FastAPI route groups.
---

# API overview

The FastAPI app mounts routers under the API prefix used by the client proxy. This page is a **map**, not a full OpenAPI dump — prefer the live OpenAPI UI (`/docs` on the API) when implementing clients.

## Health

- `GET /health` — liveness for deploy health checks

## Auth

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/email-verification/request
POST /auth/email-verification/confirm
```

## Chat & media

```text
/chat/...                 # threads, messages, streaming
/chat/media/...           # upload capabilities and media objects
```

Chat accepts generation intents (quizzes, flashcards, study artifacts) and may enqueue worker jobs. Attachments go through the media storage provider. Natural-language turns are classified by an LLM intent router (Jinja prompts under `api/app/prompts/`); empty upload-only messages may show an artifact choice card, but materials already in a thread do not force generation. User text and material excerpts are passed as fenced untrusted data in the user role, not as system instructions.

Interactive diagrams and step demos use the `render_visualization` chat tool and a `data-visualization` stream part — see [Chat visualizations](./chat-visualizations.md).

## Courses & materials

```text
/courses/...
GET  /materials?q=&status=&course_id=&limit=&offset=
POST /materials
GET  /materials/{id}
PATCH /materials/{id}          # rename title
DELETE /materials/{id}
POST /materials/{id}/reprocess
```

`GET /materials` returns a paginated `{ items, total, limit, offset }` payload and includes course materials plus chat media attachments (`source`: `material` | `chat`). Filter with `q`, `status`, `course_id`, and `source`. Uploads process parse / chunk / embed **inline in the API** by default. Set `QUEUE_MATERIAL_PROCESSING=true` (with Redis and an Arq worker sharing storage) to enqueue those stages instead.

## Agents

```text
/agents/...
```

Professor Agent CRUD and related MCP/agent tooling routes.

## Quizzes & flashcards

```text
/quizzes/...
/flashcard-decks/...
```

Generation, attempts, review, and editing flows.

## Jobs

```text
/jobs/...
```

Poll or inspect background job status for long-running generation and ingest.

## Billing & settings

```text
/billing/...
/settings/api-keys
/settings/model-defaults
GET /ai/models
```

Plans, checkout, webhooks, credits/usage (`GET /billing/usage`, `GET /billing/usage/history`), BYOK API keys, and per-user model defaults. The client Settings → Models page consumes these plus the live model catalog; the Usage page charts consume the history endpoint.

## Public contact

```text
POST /contact
```

Unauthenticated contact form. Rate-limited by email and client IP (`RATE_LIMIT_CONTACT_PER_HOUR`). Delivers via the configured email provider to `CONTACT_INBOX` (falls back to reply-to / support address). HTML/text bodies render from `api/app/emails/templates/contact.html` (+ `.txt`).

## Community, blog, progress, study, search, CV

```text
/community/...
/blog/...
/progress/...
/study/...
/search/...
/cv/...
```

## Admin, moderation, support

```text
/admin/...
/moderation/...
/support/...
```

Super-admin and trust & safety surfaces.

## Auth and errors

Most private routes require a session. Rate limits apply to chat and generation endpoints. Credit / plan checks may return structured entitlement errors when usage is exhausted.

## Related

- [Media storage](./media-storage)
- [Architecture](./architecture)
