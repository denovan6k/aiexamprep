/*
import type {ReactNode} from 'react';
import Heading from '@theme/Heading';
*/

/**
 * This guide is intentionally not mounted on a page.
 *
 * To publish it again:
 *
 * 1. Create `documentation/docs/developers/local-development.mdx`.
 * 2. Add this frontmatter:
 *      ---
 *      title: Local development
 *      description: Run Knorvex locally with Postgres, Redis, FastAPI, and Next.js.
 *      ---
 * 3. Import and render the component:
 *      import LocalDevelopmentGuide from '@site/src/components/LocalDevelopmentGuide';
 *
 *      <LocalDevelopmentGuide />
 * 4. Add `'developers/local-development'` to `developersSidebar.items` in
 *    `documentation/sidebars.ts`.
 * 5. Run `pnpm build` from `documentation/`.
 */
/*
export default function LocalDevelopmentGuide(): ReactNode {
  return (
    <>
      <Heading as="h1">Local development</Heading>

      <p>Knorvex is organised around three runtime areas:</p>

      <pre>
        <code>{`api/     FastAPI backend and Arq workers
client/  Next.js frontend
infra/   Local infrastructure helpers`}</code>
      </pre>

      <Heading as="h2">Environment files</Heading>

      <p>
        Use the tracked example files to create local environment files. Keep
        all credentials and provider keys outside version control.
      </p>

      <pre>
        <code>{`copy .env.example .env
copy api\\.env.example api\\.env
copy client\\.env.example client\\.env.local`}</code>
      </pre>

      <p>
        Refer to each example file for required variable names. Never publish
        real values in documentation, screenshots, logs, or commits.
      </p>

      <Heading as="h2">Database and cache</Heading>

      <pre>
        <code>{`docker compose up -d postgres redis
docker compose ps`}</code>
      </pre>

      <p>
        Postgres includes pgvector. Redis supports queues, rate limits, and
        workers.
      </p>

      <Heading as="h2">API</Heading>

      <pre>
        <code>{`cd api
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000`}</code>
      </pre>

      <p>
        Run the Arq worker in a second terminal when testing background work:
      </p>

      <pre>
        <code>{`cd api
uv run arq app.workers.settings.WorkerSettings`}</code>
      </pre>

      <Heading as="h2">Client</Heading>

      <pre>
        <code>{`cd client
pnpm install
pnpm dev`}</code>
      </pre>

      <Heading as="h2">Requirements</Heading>

      <ul>
        <li>Python 3.11 or newer</li>
        <li>Node 20 or newer</li>
        <li>pnpm</li>
        <li>Docker for Postgres and Redis</li>
      </ul>
    </>
  );
}
*/
