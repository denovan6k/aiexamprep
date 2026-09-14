# Chat Projects & Bulk Multi-Select

Chat Projects allow you to group conversation threads into dedicated workspaces (inspired by Claude and ChatGPT). Each project provides a shared context with custom instructions and linked background materials.

---

## Key Features

- **Workspaces (Projects)**: Private workspaces that bundle multiple chats with shared project settings.
- **Custom Instructions**: Define system-level instructions automatically applied to every chat generation within the project.
- **Project Knowledge**: Link study materials to a project so retrieval-augmented generation (RAG) searches project materials alongside chat attachments.
- **Bulk Multi-Select**: Select multiple chats in the sidebar or via the Manage page to pin, unpin, archive, restore, move to a project, or delete in bulk.

---

## Creating & Managing Projects

1. Navigate to **Projects** (`/projects`) from the main sidebar.
2. Click **New Project**, provide a name and an optional description.
3. In the project workspace (`/projects/[projectId]`):
   - **Edit Instructions**: Add custom prompts (e.g., "You are an expert tutor in organic chemistry...").
   - **Link Materials**: Click **Add** to attach processed study materials from your library.
   - **New Chat in Project**: Create conversation threads pre-assigned to this project.

---

## Organizing Chats & Bulk Actions

### Sidebar Select Mode
- In the chat sidebar, click **Select** next to the inbox header.
- Use checkboxes to select threads.
- A sticky action bar appears allowing you to **Pin**, **Archive**, **Move to Project**, or **Delete** selected chats.

### Manage Page (`/chat/manage`)
- Access **Manage** (`/chat/manage`) for a dense, searchable table of all your chats.
- Filter by **All**, **Unassigned**, **In Project**, or **Archived**.
- Perform single or batch operations with select-all capabilities.

---

## Differences Between Projects & Courses

- **Courses**: Focus on organizing study materials, decks, and quizzes.
- **Projects**: Focus on organizing interactive chat threads with custom instructions and project knowledge.
