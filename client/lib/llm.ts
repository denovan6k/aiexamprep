import type { ApiKeyProvider } from "@/lib/settings";

export type LlmSource = "platform" | "byok";

/** Platform providers (server keys) plus BYOK providers. */
export type PlatformLlmProvider = "openai" | "anthropic" | "gemini" | "openrouter";
export type LlmProvider = PlatformLlmProvider | ApiKeyProvider;

export type ByokModelOption = {
  id: string;
  name: string;
  description?: string;
  supports_reasoning?: boolean;
  supports_vision?: boolean;
};

export const BYOK_MODELS: Record<ApiKeyProvider, ByokModelOption[]> = {
  openai: [
    {
      id: "gpt-4o-mini",
      name: "GPT-4o mini",
      description: "Fast and cost-effective",
      supports_vision: true
    },
    {
      id: "gpt-4o",
      name: "GPT-4o",
      description: "Strong general-purpose model",
      supports_vision: true
    },
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo",
      description: "High capability with large context",
      supports_vision: true
    },
    {
      id: "o4-mini",
      name: "o4-mini",
      description: "Reasoning model with visible thinking",
      supports_reasoning: true
    },
    {
      id: "o3-mini",
      name: "o3-mini",
      description: "Compact reasoning model",
      supports_reasoning: true
    }
  ],
  anthropic: [
    {
      id: "claude-3-5-haiku-latest",
      name: "Claude 3.5 Haiku",
      description: "Fast responses",
      supports_vision: true
    },
    {
      id: "claude-3-5-sonnet-latest",
      name: "Claude 3.5 Sonnet",
      description: "Balanced quality and speed",
      supports_vision: true
    },
    {
      id: "claude-3-opus-latest",
      name: "Claude 3 Opus",
      description: "Highest capability",
      supports_vision: true
    },
    {
      id: "claude-sonnet-4-0",
      name: "Claude Sonnet 4",
      description: "Extended thinking enabled",
      supports_reasoning: true,
      supports_vision: true
    },
    {
      id: "claude-opus-4-0",
      name: "Claude Opus 4",
      description: "Highest capability with thinking",
      supports_reasoning: true,
      supports_vision: true
    }
  ]
};

export function encodeModelSelection(
  source: LlmSource,
  modelId: string,
  provider?: LlmProvider | null
): string {
  if (source === "byok" && provider) {
    return `byok:${provider}:${modelId}`;
  }
  if (source === "platform" && provider) {
    return `platform:${provider}:${modelId}`;
  }
  return `platform:${modelId}`;
}

export function decodeModelSelection(value: string): {
  source: LlmSource;
  modelId: string;
  provider: LlmProvider | null;
} {
  if (value.startsWith("byok:")) {
    const [, provider, ...rest] = value.split(":");
    return {
      source: "byok",
      provider: (provider as ApiKeyProvider) ?? null,
      modelId: rest.join(":")
    };
  }
  if (value.startsWith("platform:")) {
    const rest = value.slice("platform:".length);
    const known: PlatformLlmProvider[] = ["openai", "anthropic", "gemini", "openrouter"];
    for (const provider of known) {
      const prefix = `${provider}:`;
      if (rest.startsWith(prefix)) {
        return {
          source: "platform",
          provider,
          modelId: rest.slice(prefix.length)
        };
      }
    }
    return { source: "platform", provider: null, modelId: rest };
  }
  return { source: "platform", provider: null, modelId: value };
}

const REASONING_MODEL_HINTS = [
  ":thinking",
  "deepseek-r1",
  "deepseek-reasoner",
  "reasoner",
  "qwq",
  "o1-",
  "o1/",
  "o3-",
  "o3/",
  "o4-",
  "o4/",
  "gpt-5",
  "claude-opus-4",
  "claude-sonnet-4",
  "claude-3-7-sonnet",
  "flash-thinking"
] as const;

function modelIdLooksLikeReasoning(modelId: string): boolean {
  const normalized = modelId.toLowerCase();
  return REASONING_MODEL_HINTS.some((hint) => normalized.includes(hint));
}

export function modelSupportsReasoning(
  modelId: string,
  source: LlmSource,
  provider: LlmProvider | null | undefined,
  platformModels: Array<{ id: string; supports_reasoning?: boolean; provider?: string }> = []
): boolean {
  if (!modelId) return false;
  if (source === "byok" && provider && (provider === "openai" || provider === "anthropic")) {
    const byok = BYOK_MODELS[provider].find((item) => item.id === modelId);
    if (byok?.supports_reasoning) return true;
    return modelIdLooksLikeReasoning(modelId);
  }
  const platform = platformModels.find(
    (item) =>
      item.id === modelId && (!provider || !item.provider || item.provider === provider)
  );
  if (platform?.supports_reasoning) return true;
  return modelIdLooksLikeReasoning(modelId);
}

const VISION_MODEL_PREFIXES = [
  "gpt-4o",
  "gpt-4.1",
  "openai/gpt-4o",
  "openai/gpt-4.1",
  "claude-3",
  "gemini",
  "google/gemini",
  "llava",
  "qwen-vl",
  "pixtral"
] as const;

/** Default platform vision model when the user attaches an image in chat. */
export const PREFERRED_VISION_MODEL_IDS = [
  "gemini-3.6-flash",
  "google/gemini-3.6-flash",
  "gemini-3.5-flash",
  "google/gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "google/gemini-3.5-flash-lite"
] as const;

function modelIdLooksLikeVision(modelId: string): boolean {
  const normalized = modelId.toLowerCase();
  return VISION_MODEL_PREFIXES.some(
    (prefix) => normalized.startsWith(prefix) || normalized.includes(prefix)
  );
}

export function modelSupportsVision(
  modelId: string,
  source: LlmSource,
  provider: LlmProvider | null | undefined,
  platformModels: Array<{ id: string; supports_vision?: boolean; provider?: string }> = []
): boolean {
  if (!modelId) return false;
  if (source === "byok" && provider && (provider === "openai" || provider === "anthropic")) {
    const byok = BYOK_MODELS[provider].find((item) => item.id === modelId);
    if (byok?.supports_vision === true) return true;
    if (byok?.supports_vision === false) return false;
    return modelIdLooksLikeVision(modelId);
  }
  const platform = platformModels.find(
    (item) =>
      item.id === modelId && (!provider || !item.provider || item.provider === provider)
  );
  if (platform?.supports_vision === true) return true;
  // When API omits the flag, fall back to id heuristics (never hard-block on false from stale catalogs).
  if (platform?.supports_vision === false && platform.provider === "openrouter") {
    return false;
  }
  return modelIdLooksLikeVision(modelId);
}

function findPreferredVisionModel(
  candidates: Array<{ id: string; provider?: string }>
): { id: string; provider?: string } | null {
  for (const preferredId of PREFERRED_VISION_MODEL_IDS) {
    const match = candidates.find((model) => model.id === preferredId);
    if (match) return match;
  }

  const geminiFlash = candidates.find((model) => {
    const normalized = model.id.toLowerCase();
    return (
      (normalized.includes("gemini-3.6-flash") || normalized.includes("gemini-3.5-flash")) &&
      !normalized.includes("lite") &&
      !normalized.includes("thinking")
    );
  });
  return geminiFlash ?? null;
}

export function pickFirstVisionModel(
  models: Array<{ id: string; name?: string; supports_vision?: boolean; provider?: string }>,
  options?: {
    preferredProvider?: string | null;
    preferredModelId?: string | null;
    llmSource?: LlmSource;
  }
): { modelId: string; provider: string | null } | null {
  if (models.length === 0) return null;

  const source = options?.llmSource ?? "platform";
  const candidates = models.filter((model) =>
    modelSupportsVision(
      model.id,
      source,
      (model.provider as LlmProvider | undefined) ?? null,
      models
    )
  );
  if (candidates.length === 0) return null;

  const preferredProvider = options?.preferredProvider ?? null;
  const preferredModelId = options?.preferredModelId ?? null;

  if (preferredModelId) {
    const preferred = candidates.find(
      (model) =>
        model.id === preferredModelId &&
        (!preferredProvider || !model.provider || model.provider === preferredProvider)
    );
    if (preferred) {
      return { modelId: preferred.id, provider: preferred.provider ?? preferredProvider };
    }
  }

  const preferredVision = findPreferredVisionModel(candidates);
  if (preferredVision) {
    return {
      modelId: preferredVision.id,
      provider: preferredVision.provider ?? preferredProvider
    };
  }

  if (preferredProvider) {
    const sameProvider = candidates.find((model) => model.provider === preferredProvider);
    if (sameProvider) {
      return { modelId: sameProvider.id, provider: sameProvider.provider ?? preferredProvider };
    }
  }

  const first = candidates[0];
  return { modelId: first.id, provider: first.provider ?? null };
}
