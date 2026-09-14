import { apiRequest } from "@/lib/api";
import { siteConfig } from "@/lib/site";
import type { QuizGenerationSettings } from "@/lib/study";

export const QUEUED_GENERATION_MESSAGE = "Your quiz will appear here shortly.";

export function queuedGenerationMessage(
  generationType?: string | null,
  fallbackText?: string | null
): string {
  const trimmed = fallbackText?.trim();
  if (trimmed) return trimmed;
  if (generationType === "flashcard") {
    return "Your flashcards will appear here shortly.";
  }
  if (generationType === "artifact") {
    return "Your study material will appear here shortly.";
  }
  return QUEUED_GENERATION_MESSAGE;
}

export type ChatThread = {
  id: string;
  title: string;
  course_id: string | null;
  project_id: string | null;
  professor_agent_id: string | null;
  material_ids: string[];
  llm_source: "platform" | "byok";
  llm_provider: "openai" | "anthropic" | "gemini" | "openrouter" | null;
  user_api_key_id: string | null;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_CHAT_THREAD_TITLE = "New chat";

const SLASH_COMMAND_LABELS: Record<string, string> = {
  quiz: "Quiz",
  flashcards: "Flashcards",
  flashcard: "Flashcards",
  commands: "Commands",
  help: "Help"
};

export function sanitizeThreadTitle(
  title: string,
  maxLength = 60,
  fallback = DEFAULT_CHAT_THREAD_TITLE
): string {
  const collapsed = title.replace(/\s+/g, " ").trim();
  if (!collapsed) return fallback;

  let text = collapsed;
  if (text.startsWith("/")) {
    const match = text.match(/^\/(\w+)\s*(.*)$/);
    if (match) {
      const [, command, args] = match;
      const label =
        SLASH_COMMAND_LABELS[command.toLowerCase()] ??
        command.charAt(0).toUpperCase() + command.slice(1);
      text = args.trim() ? `${label}: ${args.trim()}` : label;
    }
  }

  text = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return fallback;
  if (text.length > maxLength) {
    return `${text.slice(0, maxLength - 3).trimEnd()}...`;
  }
  return text;
}

export type CreateThreadInput = {
  title?: string;
  course_id?: string | null;
  professor_agent_id?: string | null;
  project_id?: string | null;
};

export function normalizeProfessorAgentId(agentId?: string | null): string | null {
  const trimmed = agentId?.trim();
  return trimmed ? trimmed : null;
}

export function findReusableEmptyThread(
  threads: ChatThread[],
  courseId?: string | null
): ChatThread | null {
  return (
    threads.find(
      (thread) =>
        thread.title === DEFAULT_CHAT_THREAD_TITLE &&
        (courseId ? thread.course_id === courseId : thread.course_id == null)
    ) ?? null
  );
}

export function findCourseThread(threads: ChatThread[], courseId: string): ChatThread | null {
  const courseThreads = threads.filter((thread) => thread.course_id === courseId);
  return findReusableEmptyThread(courseThreads, courseId) ?? courseThreads[0] ?? null;
}

export function visibleChatThreads(threads: ChatThread[]): ChatThread[] {
  return threads;
}

export type QuizQuestion = {
  id: string;
  type: string;
  prompt: string;
  options: Array<{ id?: string; label?: string; text?: string }> | null;
  correct_answers: unknown[] | null;
  explanation: string | null;
  topic: string | null;
  difficulty: string | null;
};

export type QuizPreview = {
  id: string;
  title: string;
  status: string;
  questions: QuizQuestion[];
};

export type MediaAttachment = {
  id: string;
  filename: string;
  file_name?: string;
  content_type: string;
  file_size: number;
  url?: string;
  download_url?: string;
  attachment_type?: "image" | "document" | string;
  parsed_with?: string | null;
  created_at?: string;
};

export type MediaUploadResponse = {
  id: string;
  filename: string;
  file_name?: string;
  content_type: string;
  file_size: number;
  url?: string;
  download_url?: string;
  attachment_type?: "image" | "document" | string;
  parsed_with?: string | null;
  attachment?: MediaAttachment;
};

export type StorageCapabilities = {
  max_file_size_bytes: number;
  allowed_mime_types: string[];
  allowed_extensions: string[];
  storage_provider?: string;
  cloudinary_enabled?: boolean;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  quiz_id: string | null;
  material_id: string | null;
  media_attachment_ids?: string[];
  attachments?: MediaAttachment[];
  media_attachments?: MediaAttachment[];
  metadata: {
    event?: string;
    job_id?: string;
    status?: string;
    progress_stage?: string;
    progress_label?: string;
    generation_type?: string;
    deck_id?: string;
    artifact_id?: string;
    quiz_preview?: QuizPreview;
    question_count?: number;
    material?: {
      title?: string;
      status?: string;
      chunk_count?: number;
      file_name?: string;
    };
    attachments?: MediaAttachment[];
    error?: string;
    suggestions?: string[];
    reasoning?: string;
    reasoning_duration_ms?: number;
  } | null;
  quiz: QuizPreview | null;
  created_at: string;
};

export type SendMessageResult = {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
};

export const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"] as const;
export const SUPPORTED_DOC_EXTENSIONS = [".pdf", ".docx", ".pptx", ".xlsx", ".txt", ".md", ".csv"] as const;
export const MEDIA_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

export const CHAT_ATTACHMENT_EXTENSIONS = [
  ...SUPPORTED_IMAGE_EXTENSIONS,
  ...SUPPORTED_DOC_EXTENSIONS,
  ".markdown"
] as const;

export const CHAT_ATTACHMENT_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/csv"
].join(",");

export const CHAT_ATTACHMENT_MAX_BYTES = MEDIA_UPLOAD_MAX_BYTES;

export type ChatAttachmentExtension = (typeof CHAT_ATTACHMENT_EXTENSIONS)[number];

export type ValidatedChatAttachment = {
  file: File;
  extension: string;
  kind: "image" | "document";
};

export function validateMediaUpload(file: File): ValidatedChatAttachment {
  const fileNameLower = file.name.toLowerCase();
  const isImageMime = file.type.startsWith("image/");
  const imgExtMatch = SUPPORTED_IMAGE_EXTENSIONS.find((ext) => fileNameLower.endsWith(ext));
  const docExtMatch = SUPPORTED_DOC_EXTENSIONS.find((ext) => fileNameLower.endsWith(ext));

  if (file.size > MEDIA_UPLOAD_MAX_BYTES) {
    throw new Error(`"${file.name}" exceeds the 25 MB upload limit.`);
  }

  if (imgExtMatch || isImageMime) {
    return { file, kind: "image", extension: imgExtMatch || ".png" };
  }

  if (docExtMatch) {
    return { file, kind: "document", extension: docExtMatch };
  }

  throw new Error(
    `"${file.name}" is not supported. Upload an image (JPG, PNG, WebP, GIF, SVG) or document (PDF, DOCX, PPTX, XLSX, TXT, MD, CSV).`
  );
}

export async function uploadChatMedia(
  token: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<MediaUploadResponse> {
  const { API_BASE_URL, parseApiError } = await import("@/lib/api");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    const uploadUrl = `${API_BASE_URL}/chat/media/upload`;
    xhr.open("POST", uploadUrl);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resData = JSON.parse(xhr.responseText);
          const normalized: MediaUploadResponse = {
            id: resData.id || resData.attachment?.id || crypto.randomUUID(),
            filename: resData.filename || resData.file_name || resData.attachment?.filename || file.name,
            file_name: resData.file_name || resData.filename || file.name,
            content_type: resData.content_type || resData.file_type || resData.attachment?.content_type || file.type || "application/octet-stream",
            file_size: resData.file_size ?? resData.size ?? resData.attachment?.file_size ?? file.size,
            url: resData.url || resData.media_url || resData.download_url || resData.attachment?.url,
            download_url: resData.download_url || resData.url || resData.media_url || resData.attachment?.download_url,
            attachment_type: resData.attachment_type || resData.attachment?.attachment_type || (file.type.startsWith("image/") ? "image" : "document"),
            parsed_with: resData.parsed_with || resData.parsing_method || resData.attachment?.parsed_with || null,
            attachment: resData.attachment
          };
          resolve(normalized);
        } catch {
          reject(new Error("Invalid JSON response from server"));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(parseApiError(errData, xhr.status, xhr.statusText));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error during file upload"));
    xhr.send(formData);
  });
}

export async function getStorageCapabilities(token?: string): Promise<StorageCapabilities> {
  return apiRequest<StorageCapabilities>("/chat/media/capabilities", { token });
}

function extensionFromName(fileName: string) {
  const lower = fileName.toLowerCase();
  return CHAT_ATTACHMENT_EXTENSIONS.find((extension) => lower.endsWith(extension)) ?? null;
}

const MIME_TO_EXTENSION: Record<string, ChatAttachmentExtension> = {
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx"
};

function normalizePastedAttachment(file: File): File {
  const extension = extensionFromName(file.name) ?? MIME_TO_EXTENSION[file.type];
  if (!extension || extensionFromName(file.name)) {
    return file;
  }

  const baseName =
    file.name && !["blob", "file"].includes(file.name.toLowerCase())
      ? file.name.replace(/\.[^.]+$/, "")
      : "pasted-document";
  return new File([file], `${baseName}${extension}`, { type: file.type || undefined });
}

export function validateChatAttachment(file: File): ValidatedChatAttachment {
  const normalized = normalizePastedAttachment(file);
  if (normalized.type.startsWith("image/")) {
    throw new Error(
      `Images are not AI-readable in this chat yet. Upload a PDF, TXT, Markdown, or DOCX file instead of "${normalized.name}".`
    );
  }

  const extension = extensionFromName(normalized.name) ?? MIME_TO_EXTENSION[normalized.type];
  if (!extension) {
    throw new Error(
      `${siteConfig.name} can read PDF, TXT, Markdown, and DOCX files. "${normalized.name}" is not supported yet.`
    );
  }
  if (normalized.size > CHAT_ATTACHMENT_MAX_BYTES) {
    throw new Error(`"${normalized.name}" exceeds the 25 MB upload limit.`);
  }
  return { file: normalized, extension, kind: "document" };
}

export type AttachMaterialResult = {
  material: {
    id: string;
    title: string;
    status: string;
    chunk_count: number;
  };
  assistant_message: ChatMessage;
};

export async function createThread(token: string, input?: CreateThreadInput) {
  const payload: CreateThreadInput = {};
  if (input?.title) payload.title = input.title;
  if (input?.course_id) payload.course_id = input.course_id;
  if (input?.professor_agent_id) payload.professor_agent_id = normalizeProfessorAgentId(input.professor_agent_id);
  if (input?.project_id) payload.project_id = input.project_id;
  return apiRequest<ChatThread>("/chat/threads", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function listThreads(token: string, options?: { includeArchived?: boolean }) {
  const query = options?.includeArchived ? "?include_archived=true" : "";
  return apiRequest<ChatThread[]>(`/chat/threads${query}`, { token });
}

export async function listMessages(token: string, threadId: string) {
  return apiRequest<ChatMessage[]>(`/chat/threads/${threadId}/messages`, { token });
}

export async function sendMessage(
  token: string,
  threadId: string,
  content: string,
  professorAgentId?: string | null,
  generationSettings?: QuizGenerationSettings,
  model?: string | null,
  mediaAttachmentIds?: string[]
) {
  return apiRequest<SendMessageResult>(`/chat/threads/${threadId}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify({
      content,
      professor_agent_id: normalizeProfessorAgentId(professorAgentId),
      generation_settings: generationSettings ?? null,
      model: model ?? generationSettings?.model ?? null,
      media_attachment_ids: mediaAttachmentIds ?? []
    })
  });
}

export async function undoLastTurn(token: string, threadId: string) {
  return apiRequest<{ prompt: string }>(`/chat/threads/${threadId}/messages/last-turn`, {
    method: "DELETE",
    token
  });
}

export async function deleteLastUserPrompt(token: string, threadId: string) {
  return apiRequest<{ prompt: string }>(`/chat/threads/${threadId}/messages/last-user`, {
    method: "DELETE",
    token
  });
}

export async function attachMaterial(token: string, threadId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<AttachMaterialResult>(`/chat/threads/${threadId}/attach`, {
    method: "POST",
    token,
    body: form
  });
}

export type ChatAgentSummary = {
  id: string;
  name: string;
  subject_area: string | null;
  difficulty: string | null;
  avatar_url: string | null;
};

export async function listChatAgents(token: string) {
  return apiRequest<ChatAgentSummary[]>("/chat/agents", { token });
}

export async function updateThreadAgent(
  token: string,
  threadId: string,
  professorAgentId: string | null
) {
  return apiRequest<ChatThread>(`/chat/threads/${threadId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({
      professor_agent_id: normalizeProfessorAgentId(professorAgentId)
    })
  });
}

export async function updateThreadLlmSource(
  token: string,
  threadId: string,
  llmSource: "platform" | "byok",
  llmProvider?: "openai" | "anthropic" | "gemini" | "openrouter" | null
) {
  return apiRequest<ChatThread>(`/chat/threads/${threadId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({
      llm_source: llmSource,
      llm_provider: llmProvider ?? null
    })
  });
}

export type UpdateThreadInput = {
  pinned?: boolean;
  archived?: boolean;
  title?: string;
  project_id?: string | null;
};

export async function updateThread(token: string, threadId: string, input: UpdateThreadInput) {
  return apiRequest<ChatThread>(`/chat/threads/${threadId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input)
  });
}

export async function deleteThread(token: string, threadId: string) {
  return apiRequest<void>(`/chat/threads/${threadId}`, {
    method: "DELETE",
    token
  });
}

export function groupChatThreads(threads: ChatThread[]) {
  const active = threads.filter((thread) => !thread.archived);
  const archived = threads.filter((thread) => thread.archived);
  return {
    pinned: active.filter((thread) => thread.pinned),
    recent: active.filter((thread) => !thread.pinned),
    archived
  };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export type ChatProject = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  material_ids: string[];
  starred: boolean;
  archived: boolean;
  thread_count: number;
  created_at: string;
  updated_at: string;
};

export type CreateProjectInput = {
  name: string;
  description?: string | null;
  instructions?: string | null;
  material_ids?: string[];
};

export type UpdateProjectInput = {
  name?: string | null;
  description?: string | null;
  instructions?: string | null;
  material_ids?: string[];
  starred?: boolean;
  archived?: boolean;
};

export type BulkThreadAction =
  | "archive"
  | "unarchive"
  | "delete"
  | "pin"
  | "unpin"
  | "move_to_project"
  | "remove_from_project";

export type BulkThreadInput = {
  thread_ids: string[];
  action: BulkThreadAction;
  project_id?: string | null;
};

export type BulkThreadResult = {
  updated: number;
  failed: number;
};

export async function listProjects(
  token: string,
  options?: { includeArchived?: boolean }
): Promise<ChatProject[]> {
  const query = options?.includeArchived ? "?include_archived=true" : "";
  return apiRequest<ChatProject[]>(`/chat/projects${query}`, { token });
}

export async function createProject(
  token: string,
  input: CreateProjectInput
): Promise<ChatProject> {
  return apiRequest<ChatProject>("/chat/projects", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function getProject(token: string, projectId: string): Promise<ChatProject> {
  return apiRequest<ChatProject>(`/chat/projects/${projectId}`, { token });
}

export async function updateProject(
  token: string,
  projectId: string,
  input: UpdateProjectInput
): Promise<ChatProject> {
  return apiRequest<ChatProject>(`/chat/projects/${projectId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
}

export async function deleteProject(token: string, projectId: string): Promise<void> {
  return apiRequest<void>(`/chat/projects/${projectId}`, {
    method: "DELETE",
    token,
  });
}

export async function bulkThreadAction(
  token: string,
  input: BulkThreadInput
): Promise<BulkThreadResult> {
  return apiRequest<BulkThreadResult>("/chat/threads/bulk", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

/** Group threads by project for sidebar rendering. */
export function groupThreadsByProject(
  threads: (ChatThread & { project_id?: string | null })[],
  projects: ChatProject[]
): {
  projectGroups: Array<{ project: ChatProject; threads: ChatThread[] }>;
  unpinned: ChatThread[];
  pinned: ChatThread[];
  archived: ChatThread[];
} {
  const unassignedActive = threads.filter((t) => !t.archived && !t.project_id);
  const assignedActive = threads.filter((t) => !t.archived && t.project_id);

  // Only show non-archived, starred (pinned) projects in the sidebar
  const pinnedProjects = projects.filter((p) => !p.archived && p.starred);

  const projectGroups = pinnedProjects.map((project) => ({
    project,
    threads: assignedActive.filter((t) => t.project_id === project.id),
  }));

  return {
    projectGroups,
    pinned: unassignedActive.filter((t) => t.pinned),
    unpinned: unassignedActive.filter((t) => !t.pinned),
    archived: threads.filter((t) => t.archived),
  };
}

export type TimeGroupedThreads = {
  today: ChatThread[];
  yesterday: ChatThread[];
  previous7Days: ChatThread[];
  older: ChatThread[];
};

export function groupThreadsByTimePeriod(threads: ChatThread[]): TimeGroupedThreads {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOf7DaysAgo = startOfToday - 6 * 86400000;

  const today: ChatThread[] = [];
  const yesterday: ChatThread[] = [];
  const previous7Days: ChatThread[] = [];
  const older: ChatThread[] = [];

  for (const t of threads) {
    const updatedTime = new Date(t.updated_at).getTime();
    if (updatedTime >= startOfToday) {
      today.push(t);
    } else if (updatedTime >= startOfYesterday) {
      yesterday.push(t);
    } else if (updatedTime >= startOf7DaysAgo) {
      previous7Days.push(t);
    } else {
      older.push(t);
    }
  }

  return { today, yesterday, previous7Days, older };
}
