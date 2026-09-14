import { apiRequest } from "@/lib/api";

export type GenerationOutputType = "quiz" | "flashcards" | "summary";

export type GenerationProfile = {
  id: string;
  name: string;
  prompt_template: string;
  apply_on_upload: boolean;
  output_type: GenerationOutputType;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type GenerationProfilePayload = {
  name: string;
  prompt_template: string;
  apply_on_upload: boolean;
  output_type: GenerationOutputType;
  metadata?: Record<string, unknown> | null;
};

export async function listGenerationProfiles(token: string) {
  return apiRequest<GenerationProfile[]>("/generation-profiles", { token });
}

export async function createGenerationProfile(token: string, payload: GenerationProfilePayload) {
  return apiRequest<GenerationProfile>("/generation-profiles", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateGenerationProfile(
  token: string,
  profileId: string,
  payload: Partial<GenerationProfilePayload>
) {
  return apiRequest<GenerationProfile>(`/generation-profiles/${profileId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload)
  });
}

export async function deleteGenerationProfile(token: string, profileId: string) {
  return apiRequest<void>(`/generation-profiles/${profileId}`, {
    method: "DELETE",
    token
  });
}
