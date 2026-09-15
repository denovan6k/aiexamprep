# Knorvex

Knorvex is an agentic exam preparation application that turns student materials into personalized quizzes, flashcards, mock exams, oral exam practice, professor-style exam simulations, blog content, community study groups, and subscription-backed premium study workflows.

## Structure

```text
api/             FastAPI backend
client/          Next.js frontend
documentation/   Published Docusaurus docs (Guides + Developers)
docs/            Internal product/architecture plans and trackers
infra/           Local infrastructure setup
```

## Getting Started

1. Copy env templates and fill in secrets locally (never commit `.env` files):

   ```powershell
   copy .env.example .env
   copy api\.env.example api\.env
   copy client\.env.example client\.env.local
   ```

2. Fill in the required values in each env file (leave unused keys blank):

   **Root `.env`**

   ```env
   POSTGRES_DB=
   POSTGRES_USER=
   POSTGRES_PASSWORD=
   POSTGRES_HOST=
   POSTGRES_PORT=
   REDIS_URL=
   AUTH_SECRET=
   OPENROUTER_API_KEY=
   ```

   **`api/.env`**

   ```env
   DATABASE_URL=
   REDIS_URL=
   AUTH_SECRET=
   OPENROUTER_API_KEY=
   ```

   **`client/.env.local`**

   ```env
   NEXT_PUBLIC_API_BASE_URL=
   ```

3. Start Postgres and Redis:

   ```powershell
   docker compose up -d postgres redis
   ```

4. Run the API:

   ```powershell
   cd api
   uv sync
   uv run alembic upgrade head
   uv run uvicorn app.main:app --reload --port 8000
   ```

5. Run the client:

   ```powershell
   cd client
   pnpm install
   pnpm dev
   ```

## Documentation site

User guides and developer docs are a Docusaurus app in `documentation/` (not the internal `docs/` folder).

```powershell
cd documentation
pnpm install
pnpm start
```

Build static output with `pnpm build`. Keep pages under `documentation/docs/` in sync when you ship features — see `documentation/docs/developers/docs-workflow.md`.

