import { API_BASE_URL, apiRequest, parseApiError } from "@/lib/api";
import { buildListQuery, type ListParams, type PaginatedResult } from "@/lib/pagination";
import type { LlmSource } from "@/lib/llm";

export type CvDocumentStatus = "uploaded" | "processing" | "processed" | "failed";
export type CvTailoringStatus = "queued" | "running" | "completed" | "failed";

export type CvDocument = {
  id: string;
  user_id?: string;
  title: string;
  file_name: string;
  file_type: string | null;
  status: CvDocumentStatus;
  error_message: string | null;
  extracted_text_preview?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type TailoredContact = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
};

export type TailoredExperience = {
  title?: string;
  company?: string;
  dates?: string;
  bullets?: string[];
};

export type TailoredEducation = {
  degree?: string;
  institution?: string;
  dates?: string;
  details?: string;
};

export type TailoredSections = {
  contact?: TailoredContact;
  summary?: string;
  skills?: string[];
  experience?: TailoredExperience[];
  education?: TailoredEducation[];
  certifications?: string[];
  ats_keywords_matched?: string[];
};

export type CvTailoring = {
  id: string;
  user_id?: string;
  cv_document_id: string;
  job_title: string | null;
  company: string | null;
  job_description?: string;
  tailored_sections: TailoredSections | null;
  status: CvTailoringStatus;
  error_message: string | null;
  model?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type CreateTailoringInput = {
  cv_document_id: string;
  job_description: string;
  job_title?: string;
  company?: string;
  model?: string | null;
  llm_source?: LlmSource;
  llm_provider?: "openai" | "anthropic" | "gemini" | "openrouter" | null;
};

function buildCvListQuery(params?: ListParams & { cvDocumentId?: string }) {
  const search = new URLSearchParams(buildListQuery(params).replace(/^\?/, ""));
  if (params?.cvDocumentId) search.set("cv_document_id", params.cvDocumentId);
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function uploadCvDocument(token: string, file: File, title?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (title?.trim()) formData.append("title", title.trim());

  return apiRequest<CvDocument>("/cv/documents", {
    method: "POST",
    token,
    body: formData
  });
}

export async function listCvDocuments(token: string, params?: ListParams) {
  return apiRequest<PaginatedResult<CvDocument>>(`/cv/documents${buildListQuery(params)}`, { token });
}

export async function getCvDocument(token: string, documentId: string) {
  return apiRequest<CvDocument>(`/cv/documents/${documentId}`, { token });
}

export async function deleteCvDocument(token: string, documentId: string) {
  return apiRequest<void>(`/cv/documents/${documentId}`, {
    method: "DELETE",
    token
  });
}

export async function createCvTailoring(token: string, input: CreateTailoringInput) {
  return apiRequest<CvTailoring>("/cv/tailorings", {
    method: "POST",
    token,
    body: JSON.stringify(input)
  });
}

export async function listCvTailorings(token: string, params?: ListParams & { cvDocumentId?: string }) {
  return apiRequest<PaginatedResult<CvTailoring>>(`/cv/tailorings${buildCvListQuery(params)}`, { token });
}

export async function getCvTailoring(token: string, tailoringId: string) {
  return apiRequest<CvTailoring>(`/cv/tailorings/${tailoringId}`, { token });
}

export async function deleteCvTailoring(token: string, tailoringId: string) {
  return apiRequest<void>(`/cv/tailorings/${tailoringId}`, {
    method: "DELETE",
    token
  });
}

export async function downloadTailoredCv(token: string, tailoringId: string) {
  const response = await fetch(`${API_BASE_URL}/cv/tailorings/${tailoringId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw parseApiError(body, response.status, response.statusText);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = /filename="?([^"]+)"?/i.exec(disposition);
  return {
    blob,
    filename: filenameMatch?.[1] ?? "tailored-cv.docx"
  };
}

export function tailoredSectionsToPlainText(sections: TailoredSections | null | undefined) {
  if (!sections) return "";
  const parts: string[] = [];
  const contact = sections.contact;
  const contactLine = [contact?.email, contact?.phone, contact?.location, contact?.linkedin].filter(Boolean).join(" | ");

  if (contact?.name) parts.push(contact.name);
  if (contactLine) parts.push(contactLine);
  if (sections.summary) parts.push(`Professional Summary\n${sections.summary}`);
  if (sections.skills?.length) parts.push(`Skills\n${sections.skills.join(", ")}`);
  if (sections.experience?.length) {
    parts.push(
      `Experience\n${sections.experience
        .map((role) => {
          const heading = [role.title, role.company, role.dates].filter(Boolean).join(" | ");
          const bullets = role.bullets?.map((bullet) => `- ${bullet}`).join("\n");
          return [heading, bullets].filter(Boolean).join("\n");
        })
        .join("\n\n")}`
    );
  }
  if (sections.education?.length) {
    parts.push(
      `Education\n${sections.education
        .map((item) => [item.degree, item.institution, item.dates, item.details].filter(Boolean).join(" | "))
        .join("\n")}`
    );
  }
  if (sections.certifications?.length) parts.push(`Certifications\n${sections.certifications.join("\n")}`);
  if (sections.ats_keywords_matched?.length) {
    parts.push(`Matched Keywords\n${sections.ats_keywords_matched.join(", ")}`);
  }

  return parts.filter(Boolean).join("\n\n");
}
