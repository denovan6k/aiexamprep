import { apiRequest } from "@/lib/api";

export type ApiKeyProvider = "openai" | "anthropic";

export type UserApiKey = {
  id: string;
  provider: ApiKeyProvider;
  label: string | null;
  key_last4: string;
  is_valid: boolean;
  last_validated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiKeyCreatePayload = {
  provider: ApiKeyProvider;
  api_key: string;
  label?: string;
};

export type ModelDefaults = {
  default_chat_model: string | null;
  default_generation_model: string | null;
  default_embedding_model: string | null;
};

export async function listApiKeys(token: string) {
  return apiRequest<UserApiKey[]>("/settings/api-keys", { token });
}

export async function createApiKey(token: string, payload: ApiKeyCreatePayload) {
  return apiRequest<UserApiKey>("/settings/api-keys", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function deleteApiKey(token: string, keyId: string) {
  return apiRequest<void>(`/settings/api-keys/${keyId}`, {
    method: "DELETE",
    token
  });
}

export async function getModelDefaults(token: string) {
  return apiRequest<ModelDefaults>("/settings/model-defaults", { token });
}

export async function updateModelDefaults(token: string, payload: ModelDefaults) {
  return apiRequest<ModelDefaults>("/settings/model-defaults", {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}
