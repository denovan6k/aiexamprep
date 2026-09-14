---
title: Chat & generation
description: Use conversational chat to generate quizzes, flashcards, and study artifacts from your materials.
---

# Chat & generation

Chat is the primary surface in Knorvex. Ask for practice in natural language, attach materials, pick a model or agent, and generate study artifacts without leaving the thread.

## Thread titles

New chats start as **New chat**. After your first message, the sidebar title updates from a cleaned version of that message. Once the assistant replies, Knorvex may refine the title once into a short topic label (for example “Cell membrane transport”) so the inbox is easier to scan.

Titles you set yourself (or material chats that open with a preset name) are left alone. Renaming via the API also locks the title against further auto-updates.

## Chat Projects & Bulk Thread Management

Organize your chats into dedicated workspaces called **Projects**:
- **Projects (`/projects`)**: Custom workspaces with shared system instructions and linked background materials.
- **Bulk Multi-Select (`/chat/manage`)**: Select multiple chats from the sidebar or the Manage page to pin, archive, move to project, or delete in bulk.

See the dedicated [Chat Projects Guide](./chat-projects) for detailed instructions on managing projects and bulk actions.

## What chat can do

- Answer questions grounded in your uploaded materials
- Render study math with LaTeX (`$inline$` and `$$display$$`)
- Generate quizzes and flashcard decks from conversation
- Route clear study intents into structured generation jobs
- Accept media attachments (images and documents) for context
- When you attach an **image**, a short banner appears in the composer and the model picker switches to vision-capable models grouped by provider so the assistant can see the photo directly
- Image-backed **summary**, **study guide**, and **structured notes** appear as full markdown replies in the thread
- **Mind maps** from images open as an interactive SVG preview in chat, with a link to the full editor at `/mind-maps/[id]`
- Reuse files you already attached earlier in the same thread when you ask for a quiz or flashcards later

## Typical prompts

- “Generate 10 MCQs from my midterm notes, timed 20 minutes.”
- “Make flashcards from what I got wrong on my last quiz.”
- “Quiz me like my professor agent on chapter 4 only.”
- “What model are you using?” / “Explain section 2 from my upload.”

You can attach a PDF (or other notes) first, then send `/quiz` or “make a quiz” in a follow-up message — Knorvex keeps that material available for the rest of the thread. Uploaded materials do **not** force generation: meta questions, follow-ups, and plain explanations stay in chat unless you ask to generate something.

When Knorvex detects a generation intent, you may see settings or confirmation UI before a job runs. Progress for long jobs appears in the thread, and the quiz or flashcard card replaces the waiting message when the job finishes—no refresh needed. After a failed generation, asking to try again can reuse the same intent via the classifier.

Uploaded notes and chat history are treated as untrusted reference data for the model (instructions inside files are not followed as system commands).

If the AI provider is busy or returns an unusable response, chat explains what happened (for example rate limiting) and suggests trying again or switching model—rather than a generic failure.

If an attached file cannot be read, Knorvex says so and can offer a general quiz or flashcards on a topic you name (reply **yes** when a topic was already suggested).

## Artifacts in chat

Successful generation can surface cards for quizzes, flashcard decks, or other study artifacts so you can open them immediately. You can also manage the same items from the Quizzes and Flashcards pages.

### Mind maps

Mind maps are generated as markdown-backed study artifacts. In chat you see a compact SVG preview and an **Open mind map** button. The editor page supports pan and zoom, inline text edits (double-click a node), branch editing (right-click for add, collapse, or delete), undo/redo, and SVG export. Changes auto-save to your account.

## Models and agents

- The model picker lists **live models for each platform provider** whose API key is configured on the server (Gemini, OpenAI, Anthropic, OpenRouter), grouped by provider.
- With an image in the composer, only models that support vision (including Gemini and OpenRouter image models) appear in the picker, still grouped by provider; Knorvex may switch your selection automatically if the current model cannot read images.
- Study artifacts from images (summary, study guide, notes, mind map) are sent to a vision-capable model with your prompt—the image pixels are used directly, not only OCR text.
- OpenRouter entries may show a **free** label when the provider reports zero pricing; other providers do not expose free/paid in their model list APIs.
- You can also use a saved bring-your-own key (OpenAI or Anthropic) from **Settings → Models** (`/settings/models`) when available. Task model defaults live on the same page.
- Attach a [Professor Agent](./professor-agents) when you want examiner-style questions and feedback.
- Prefer attaching the relevant [course materials](./materials-and-courses) so answers stay grounded.

## Always verify

Practice is generated from your materials and may include explanations that point back to notes. Always check key facts against your course material before treating an answer as authoritative.
