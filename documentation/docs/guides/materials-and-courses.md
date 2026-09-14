---
title: Materials & courses
description: Upload study materials and organise them into courses for practice.
---

# Materials & courses

Knorvex practice is built from the files you bring. Courses keep those files organised by subject or module.

## Courses

Create a course for each exam or module you care about. Attach materials to that course so quizzes, flashcards, and chat stay scoped to the right content.

## Supported uploads

You can bring in:

- PDF
- DOCX
- Plain text
- Markdown

In chat you can also attach common images and other documents; see [Media storage](../developers/media-storage) for provider details if you are deploying the app.

## Materials library

On **Courses**, the materials library lists uploads across courses **and chat attachments**. You can:

- Search by title or filename
- Filter by course, source (Courses / Chat), and processing status
- Page through results
- Preview a file (PDF, image, or extracted text)
- Download, rename, reprocess, or delete a course material
- Preview, open the related chat thread, or delete a chat attachment
- Open material-scoped chat or jump into hybrid search when a course material is processed

Inside a course workspace, the **Materials** tab offers the same search, status filters, pagination, and actions for files scoped to that course (including chat uploads linked to that course).

Deleting a course material removes the source file and extracted text. Deleting a chat attachment removes it from chat storage. Quizzes or decks already generated from a file are not deleted automatically.

## What happens after upload

1. The file is stored securely.
2. Text is extracted and chunked for retrieval in the API process by default (so Search works without a separate worker).
3. Embeddings support search and grounded generation.
4. The material becomes available for quizzes, flashcards, chat context, and **Search**.

Chat uploads (PDF/DOCX in a thread) are also searchable once text is extracted — Search ranks both course materials and chat attachments with parsed text.

Deployments that run Arq workers with shared storage can set `QUEUE_MATERIAL_PROCESSING=true` so parse / chunk / embed run on workers instead. Use **Reprocess** if extraction looked incomplete or the status shows failed.

## Best practices

- Prefer clean lecture slides and past papers over scanned photos when possible.
- Keep course names short and exam-oriented (e.g. “Organic Chem Midterm”).
- Rename materials so titles match how you study (lecture week, topic, paper code).
- Reprocess a material only if the source file changed or extraction looked incomplete.

## Privacy

Uploaded materials stay private to your account unless you explicitly share a derived resource (quiz, deck, or agent) with a [community](./community) group. Raw source files are not exposed by default.
