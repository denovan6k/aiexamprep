# Developer Overview: Chat Projects & Bulk API

This document describes the API endpoints and architecture for Chat Projects and Bulk Thread Operations.

---

## Data Model

- **Table**: `chat_projects`
  - `id`: UUID Primary Key
  - `user_id`: UUID Foreign Key -> `users.id`
  - `name`: String(255)
  - `description`: Text (nullable)
  - `instructions`: Text (nullable)
  - `material_ids`: JSONB list of material UUID strings
  - `starred`: Boolean (default `False`)
  - `archived`: Boolean (default `False`)
  - Indexes: `(user_id, archived)`

- **Table**: `chat_threads`
  - `project_id`: UUID Foreign Key -> `chat_projects.id` `ON DELETE SET NULL`
  - Indexes: `(user_id, project_id)`

---

## API Endpoints

### Projects Endpoints

- `GET /chat/projects` - List projects for current user (optional `include_archived=true`).
- `POST /chat/projects` - Create project (`name`, `description`, `instructions`, `material_ids`).
- `GET /chat/projects/{project_id}` - Get project detail.
- `PATCH /chat/projects/{project_id}` - Update project properties (`name`, `description`, `instructions`, `material_ids`, `starred`, `archived`).
- `DELETE /chat/projects/{project_id}` - Delete project (unassigns threads to `project_id = NULL`).

### Bulk Threads Endpoint

- `POST /chat/threads/bulk`
  ```json
  {
    "thread_ids": ["uuid1", "uuid2"],
    "action": "archive|unarchive|delete|pin|unpin|move_to_project|remove_from_project",
    "project_id": "uuid-or-null"
  }
  ```
  - Batch size capped at 100 threads per call.
  - Ownership validated for all target threads and destination project.
  - Returns `{"updated": count, "failed": count}`.

---

## Generation Context Integration

- **Custom Instructions**: Appended to system prompt via `chat_system.jinja` template block `project_instructions`.
- **Knowledge RAG**: `_effective_material_ids()` merges project `material_ids` with thread `material_ids` (deduplicated, project materials prioritized).
