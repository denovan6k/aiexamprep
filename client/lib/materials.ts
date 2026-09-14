import { API_BASE_URL, apiRequest, parseApiError } from "@/lib/api";
import { buildListQuery, type ListParams, type PaginatedResult } from "@/lib/pagination";

export type MaterialSummary = {
  id: string;
  course_id: string | null;
  institution_id: string | null;
  title: string;
  file_name: string;
  file_type: string | null;
  status: "uploaded" | "processing" | "processed" | "failed";
  extracted_text_preview: string | null;
  chunk_count: number;
  created_at: string;
  source?: "material" | "chat";
  media_attachment_id?: string | null;
  thread_id?: string | null;
  media_url?: string | null;
};

export type MaterialStatus = {
  id: string;
  status: "uploaded" | "processing" | "processed" | "failed";
  chunk_count: number;
  embedded: boolean;
  error_message: string | null;
  processing_job_id: string | null;
};

export type MaterialChatSession = {
  id: string;
  material_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type MaterialChatMessage = {
  id: string;
  session_id: string;
  material_id: string | null;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type MaterialChatContextIndicator = {
  chunk_id: string;
  material_title: string;
  source: string;
  token_count: number;
};

export type MaterialChatResponse = {
  user_message: MaterialChatMessage;
  assistant_message: MaterialChatMessage;
  context_indicators: MaterialChatContextIndicator[];
  token_estimate: number;
  truncated: boolean;
};

export type MaterialReprocessResult = {
  material: MaterialSummary;
  message: string;
};

export function materialDownloadUrl(materialId: string) {
  return `${API_BASE_URL}/materials/${materialId}/download`;
}

export function materialFileTypeLabel(material: Pick<MaterialSummary, "file_name" | "file_type">) {
  const type = material.file_type?.split("/").pop()?.toUpperCase();
  if (type) return type;
  const ext = material.file_name.split(".").pop()?.toUpperCase();
  return ext ?? "FILE";
}

export function isMaterialPreviewable(material: Pick<MaterialSummary, "file_name" | "file_type">) {
  const name = material.file_name.toLowerCase();
  const type = material.file_type?.toLowerCase() ?? "";
  return (
    type.includes("pdf") ||
    name.endsWith(".pdf") ||
    type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md")
  );
}

export async function listMaterials(token: string, params?: ListParams & { courseId?: string }) {
  const queryParams: ListParams = {
    ...params,
    course_id: params?.courseId ?? params?.course_id
  };
  return apiRequest<PaginatedResult<MaterialSummary>>(`/materials${buildListQuery(queryParams)}`, {
    token
  });
}

export async function listAllMaterials(token: string, courseId?: string) {
  const result = await listMaterials(token, { courseId, limit: 100, offset: 0 });
  return result.items;
}

export async function uploadMaterial(
  token: string,
  file: File,
  options: { courseId?: string; title?: string } = {}
) {
  const form = new FormData();
  form.set("file", file);
  if (options.courseId) form.set("course_id", options.courseId);
  if (options.title?.trim()) form.set("title", options.title.trim());
  return apiRequest<MaterialSummary>("/materials", {
    method: "POST",
    token,
    body: form
  });
}

export async function deleteMaterial(token: string, materialId: string) {
  await apiRequest<void>(`/materials/${materialId}`, {
    method: "DELETE",
    token
  });
}

export async function deleteChatMedia(token: string, mediaId: string) {
  await apiRequest<void>(`/chat/media/${mediaId}`, {
    method: "DELETE",
    token
  });
}

export function isChatLibraryItem(material: Pick<MaterialSummary, "source">) {
  return material.source === "chat";
}

export function materialOpenUrl(material: MaterialSummary) {
  if (isChatLibraryItem(material) && material.media_url) {
    return material.media_url;
  }
  return materialDownloadUrl(material.id);
}

export async function updateMaterialTitle(token: string, materialId: string, title: string) {
  return apiRequest<MaterialSummary>(`/materials/${materialId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ title })
  });
}

export async function reprocessMaterial(token: string, materialId: string) {
  return apiRequest<MaterialReprocessResult>(`/materials/${materialId}/reprocess`, {
    method: "POST",
    token
  });
}

export async function downloadMaterial(materialId: string, fileName: string) {
  const response = await fetch(materialDownloadUrl(materialId));
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw parseApiError(body, response.status, response.statusText);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = filenameMatch?.[1] ?? fileName;

  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export async function getMaterialStatus(token: string, materialId: string) {
  return apiRequest<MaterialStatus>(`/materials/${materialId}/status`, { token });
}

export async function createMaterialChatSession(token: string, materialId: string, title?: string) {
  return apiRequest<MaterialChatSession>(`/materials/${materialId}/chat/sessions`, {
    method: "POST",
    token,
    body: JSON.stringify({ title })
  });
}

export async function sendMaterialChatMessage(
  token: string,
  materialId: string,
  sessionId: string,
  content: string,
  model?: string | null
) {
  return apiRequest<MaterialChatResponse>(`/materials/${materialId}/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify({ content, model: model ?? null })
  });
}
