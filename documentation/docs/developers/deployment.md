---
title: Deployment
description: Deploy Knorvex API, workers, Next.js client, and docs with Docker Compose on Dokploy.
---

# Deployment

Production Knorvex assumes Postgres with pgvector, Redis, a FastAPI API, an Arq worker, a Next.js frontend, and the Docusaurus docs site.

## Architecture

```text
Browser → Next.js (client/) → FastAPI (api/) → Postgres + Redis
                            → Gemini / OpenAI / Anthropic / OpenRouter
                            → Stripe (billing webhooks)
                            → Media provider (Cloudinary / S3)
Browser → Docusaurus (documentation/)
```

## Prerequisites

- Postgres 16+ with the `vector` extension
- Redis 7+
- Domain and TLS termination (Dokploy / Traefik)
- At least one platform LLM API key (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and/or `OPENROUTER_API_KEY`)
- Stripe account when billing is enabled
- Cloudinary **or** S3-compatible object storage for media (do not use VPS disk in production)

## Dokploy (Docker Compose)

Use the production Compose file at the repo root: `docker-compose.prod.yml`.

Services: `postgres`, `redis`, `api`, `worker`, `client`, `docs`.

### Operator steps

1. Point DNS A records for your app, API, and docs hostnames at the Dokploy VPS (docs config uses `https://docs.knorvex.com`).
2. In Dokploy, create a **Compose** application from this Git repo and set the compose path to `docker-compose.prod.yml`.
3. Paste production variables into the **Environment** tab (Dokploy writes `.env`). Use the repo root `.env.example` and `api/.env.example` as checklists — do not hardcode secrets in the compose file.
4. Attach domains: app → `client` port `3000`, API → `api` port `8000`, docs → `docs` port `3000`. Enable HTTPS.
5. Deploy. Confirm `GET /health` on the API origin, the app loads, and the docs home renders. Smoke-test a chat upload against Cloudinary or S3.
6. Point Stripe webhooks at `https://<api-host>/billing/webhook`.
7. Back up the Postgres and Redis volumes. Media lives in the object store — configure retention there.

If browser POSTs to `/api/backend/...` return `403` with `Cross-site request rejected` while `Origin` is your HTTPS app domain, redeploy a client build that trusts `Sec-Fetch-Site: same-origin` and `X-Forwarded-Proto` / `X-Forwarded-Host` (Dokploy/Traefik). Match `API_CORS_ORIGINS` and `APP_PUBLIC_URL` to the exact frontend origin (including `https://`, no accidental `www` mismatch).

Compose rewrites `DATABASE_URL` to the internal `postgres` hostname and forces `REDIS_URL=redis://redis:6379/0` for `api` / `worker` (so a localhost Redis URL from local `.env` cannot break the containers). The `api` service hardcodes `RUN_MIGRATIONS=true`; `worker` hardcodes it off.

Local dry-run:

```bash
docker compose -f docker-compose.prod.yml --env-file .env config
docker compose -f docker-compose.prod.yml --env-file .env up --build
```

### Local per-service checks

With a filled `.env` (including `POSTGRES_PASSWORD` and media credentials as needed):

1. `docker compose -f docker-compose.prod.yml up -d postgres` — wait until healthy (`pg_isready`).
2. `docker compose -f docker-compose.prod.yml up -d redis` — `redis-cli ping` → `PONG` inside the container.
3. `docker compose -f docker-compose.prod.yml up --build -d api` — `curl http://127.0.0.1:8000/health`.
4. `docker compose -f docker-compose.prod.yml up --build -d worker` — logs show Arq started; no crash loop.
5. `docker compose -f docker-compose.prod.yml up --build -d client` — HTTP 200 on port `3000`.
6. `docker compose -f docker-compose.prod.yml up --build -d docs` — HTTP 200 on port `3001` (maps to container `3000`).

## Environment (API)

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes* | Postgres URL (`postgresql+psycopg://…`); Compose can assemble from `POSTGRES_*` |
| `REDIS_URL` | Yes | Redis for rate limits and job queues |
| `AUTH_SECRET` | Yes | Long random secret for sessions |
| `API_CORS_ORIGINS` | Yes | Comma-separated frontend origins |
| `MEDIA_STORAGE_PROVIDER` | Yes (prod) | `cloudinary` or `s3` (not `local`) |
| `GEMINI_API_KEY` | Optional | Google AI Studio key |
| `OPENAI_API_KEY` | Optional | OpenAI platform key (also used for embeddings) |
| `ANTHROPIC_API_KEY` | Optional | Anthropic platform key |
| `OPENROUTER_API_KEY` | Optional | OpenRouter platform key |
| `DEFAULT_PLATFORM_PROVIDER` | Optional | Preferred provider when multiple keys are set |
| `PLATFORM_PROVIDER_PRIORITY` | Optional | Comma-ordered fallback |
| `*_DEFAULT_MODEL` | Optional | Per-provider default model id |
| `OPENROUTER_MODEL_FILTER` | Optional | `all` (default), `free`, or `paid` |
| `THREAD_TITLE_MODEL` | Optional | Cheap model id for chat thread titles. When unset: OpenRouter/OpenAI mini models, else `GEMINI_DEFAULT_MODEL` / `gemini-2.5-flash`, else Anthropic haiku. |
| `HEADROOM_ENABLED` | Optional | Context compression master switch (`false` by default); see [Headroom](./headroom) |
| `STRIPE_SECRET_KEY` | Optional | Stripe secret |
| `STRIPE_WEBHOOK_SECRET` | Optional | Webhook signing secret |

\*On Dokploy Compose, `POSTGRES_PASSWORD` (and optional `POSTGRES_USER` / `POSTGRES_DB`) are enough; the compose file builds `DATABASE_URL` for `api` and `worker`.

Provider base URLs are hardcoded public endpoints; only API keys and default model ids belong in env. Never commit real secrets. Media credentials: see [Media storage](./media-storage).

## Environment (client)

| Variable | Required | Description |
|----------|----------|-------------|
| `API_BASE_URL` | Yes (server) | Backend URL for the Next.js proxy / RSC (e.g. `http://api:8000` on Compose) |
| `NEXT_PUBLIC_API_BASE_URL` | Optional | Fallback / site config; browser API calls use same-origin `/api/backend` |

Set these in the Dokploy Environment UI (or local `.env`), not in the image.

## Database migrations

On Compose, the API entrypoint runs `alembic upgrade head` on start (`RUN_MIGRATIONS=true` in `docker-compose.prod.yml`).

Manual:

```bash
cd api
uv sync
uv run alembic upgrade head
```

Ensure `CREATE EXTENSION IF NOT EXISTS vector;` is available on Postgres (`infra/postgres/init.sql` on first volume init).

## API and worker

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

Run at least one Arq worker alongside the API for queued study generation. Material parse/chunk/embed runs **inline in the API** unless `QUEUE_MATERIAL_PROCESSING=true` (then workers must share upload storage with the API). Point health checks at `GET /health`. Terminate TLS at the edge.

## Frontend

```bash
cd client
pnpm install
pnpm build
pnpm start
```

Production images use Next.js `output: "standalone"`.

## Documentation site

```bash
cd documentation
pnpm install
pnpm build
pnpm serve
```

Static output lands in `documentation/build`. The Compose `docs` service builds that output and serves it with nginx on port `3000`.

## Related

- [Media storage](./media-storage)
- [Architecture](./architecture)
