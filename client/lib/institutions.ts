"use client";

import { apiRequest } from "@/lib/api";

export type Institution = {
  id: string;
  name: string;
  slug: string;
};

export type UserInstitution = {
  institution: Institution | null;
  is_institution_admin: boolean;
};

export type BulkUploadResult = {
  uploaded: Array<{
    id: string;
    title: string;
    file_name: string;
    institution_id: string | null;
    status: string;
  }>;
  message: string;
};

export async function listInstitutions(): Promise<Institution[]> {
  return apiRequest<Institution[]>("/institutions");
}

export async function getMyInstitution(token: string): Promise<UserInstitution> {
  return apiRequest<UserInstitution>("/institutions/me", { token });
}

export async function updateMyInstitution(
  token: string,
  institutionSlug: string | null
): Promise<UserInstitution> {
  return apiRequest<UserInstitution>("/institutions/me", {
    method: "PATCH",
    token,
    body: JSON.stringify({ institution_slug: institutionSlug })
  });
}

export async function bulkUploadInstitutionMaterials(
  token: string,
  institutionId: string,
  files: File[]
): Promise<BulkUploadResult> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  return apiRequest<BulkUploadResult>(`/institutions/${institutionId}/materials`, {
    method: "POST",
    token,
    body: formData
  });
}
