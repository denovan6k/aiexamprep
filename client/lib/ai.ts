import { apiRequest } from "@/lib/api";

export type AiModelPricing = {
  prompt: string | null;
  completion: string | null;
};

export type AiModel = {
  id: string;
  name: string;
  description: string | null;
  context_length: number | null;
  is_free?: boolean | null;
  pricing?: AiModelPricing | null;
  supports_reasoning?: boolean;
  supports_vision?: boolean;
  provider?: string;
};

export type AiProviderModels = {
  id: string;
  name: string;
  models: AiModel[];
};

export type AiModelsResponse = {
  configured: boolean;
  default_provider: string | null;
  default_model: string | null;
  providers: AiProviderModels[];
  /** Legacy flat fields */
  provider?: string | null;
  models?: AiModel[];
};

export function flattenProviderModels(response: AiModelsResponse): AiModel[] {
  if (response.providers?.length) {
    return response.providers.flatMap((provider) =>
      provider.models.map((model) => ({ ...model, provider: provider.id }))
    );
  }
  return (response.models ?? []).map((model) => ({
    ...model,
    provider: response.default_provider ?? response.provider ?? undefined
  }));
}

export function pickDefaultModel(
  response: AiModelsResponse | null | undefined
): { provider: string | null; modelId: string } {
  if (!response) {
    return { provider: null, modelId: "" };
  }
  const flat = flattenProviderModels(response);
  if (
    response.default_provider &&
    response.default_model &&
    flat.some(
      (model) =>
        model.id === response.default_model &&
        (!model.provider || model.provider === response.default_provider)
    )
  ) {
    return { provider: response.default_provider, modelId: response.default_model };
  }
  if (response.default_model && flat.some((model) => model.id === response.default_model)) {
    const match = flat.find((model) => model.id === response.default_model);
    return {
      provider: match?.provider ?? response.default_provider,
      modelId: response.default_model
    };
  }
  const first = flat[0];
  return { provider: first?.provider ?? null, modelId: first?.id ?? "" };
}

export async function listAiModels(token: string) {
  return apiRequest<AiModelsResponse>("/ai/models", { token });
}
