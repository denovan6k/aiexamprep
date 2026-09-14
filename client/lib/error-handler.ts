"use client";

export type FriendlyErrorInput = {
  code?: string | null;
  status?: number | null;
  message?: string | null;
  requestId?: string | null;
};

export type FriendlyError = {
  title: string;
  message: string;
  retryable: boolean;
  requestId?: string;
};

const CODE_MESSAGES: Record<string, FriendlyError> = {
  auth: {
    title: "Sign in again",
    message: "Your session expired. Sign in again to continue.",
    retryable: false
  },
  authorization_failed: {
    title: "Sign in again",
    message: "Your session expired. Sign in again to continue.",
    retryable: false
  },
  invalid_token: {
    title: "Sign in again",
    message: "Your session expired. Sign in again to continue.",
    retryable: false
  },
  forbidden: {
    title: "Access unavailable",
    message: "You do not have permission to use this workspace item.",
    retryable: false
  },
  not_found: {
    title: "Not found",
    message: "This item may have been deleted or moved.",
    retryable: false
  },
  validation_error: {
    title: "Check the details",
    message: "Some information needs to be corrected before this can continue.",
    retryable: false
  },
  rate_limit: {
    title: "Rate limit reached",
    message: "The AI provider is receiving too many requests. Wait a moment, then try again.",
    retryable: true
  },
  provider_rate_limit: {
    title: "Rate limit reached",
    message: "The AI provider is receiving too many requests. Wait a moment, then try again.",
    retryable: true
  },
  context_length: {
    title: "Material is too large",
    message: "The selected material is too large for this request. Try a narrower topic or fewer files.",
    retryable: false
  },
  timeout: {
    title: "Request timed out",
    message: "The request took too long. Try again with a smaller prompt or fewer materials.",
    retryable: true
  },
  backend_unreachable: {
    title: "Service unavailable",
    message: "The service is temporarily unavailable. Please try again shortly.",
    retryable: true
  },
  provider_error: {
    title: "AI provider unavailable",
    message: "The AI provider could not complete the request. Try again in a moment.",
    retryable: true
  },
  invalid_api_key: {
    title: "API key needs attention",
    message: "Your AI key was rejected. Update it in Settings or switch back to the platform model.",
    retryable: false
  },
  api_key_invalid: {
    title: "API key needs attention",
    message: "Your AI key was rejected. Update it in Settings or switch back to the platform model.",
    retryable: false
  }
};

const STATUS_MESSAGES: Record<number, FriendlyError> = {
  400: {
    title: "Request could not be sent",
    message: "Check the request details and try again.",
    retryable: false
  },
  401: {
    title: "Sign in again",
    message: "Your session expired. Sign in again to continue.",
    retryable: false
  },
  403: {
    title: "Access unavailable",
    message: "You do not have permission to use this workspace item.",
    retryable: false
  },
  404: {
    title: "Not found",
    message: "This item may have been deleted or moved.",
    retryable: false
  },
  409: {
    title: "Already updated",
    message: "This item changed somewhere else. Refresh and try again.",
    retryable: true
  },
  413: {
    title: "File is too large",
    message: "Upload a smaller file or split the material into sections.",
    retryable: false
  },
  422: {
    title: "Check the details",
    message: "Some information needs to be corrected before this can continue.",
    retryable: false
  },
  429: {
    title: "Rate limit reached",
    message: "The service is receiving too many requests. Wait a moment, then try again.",
    retryable: true
  },
  500: {
    title: "Server problem",
    message: "Something failed on the server. Try again in a moment.",
    retryable: true
  },
  502: {
    title: "Service unavailable",
    message: "A connected service is unavailable. Try again in a moment.",
    retryable: true
  },
  503: {
    title: "Service unavailable",
    message: "The service is temporarily unavailable. Try again in a moment.",
    retryable: true
  },
  504: {
    title: "Request timed out",
    message: "The request took too long. Try again with a smaller prompt or fewer materials.",
    retryable: true
  }
};

function getObjectString(error: unknown, key: "code" | "message" | "requestId") {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  const value = key in record ? record[key] : undefined;
  return typeof value === "string" ? value : undefined;
}

function getObjectStatus(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const status = "status" in error ? error.status : undefined;
  return typeof status === "number" ? status : undefined;
}

export function getFriendlyError(error: unknown, fallback?: Partial<FriendlyError>): FriendlyError {
  const input = error as FriendlyErrorInput | null | undefined;
  const code = input?.code ?? getObjectString(error, "code");
  const status = input?.status ?? getObjectStatus(error);
  const requestId = input?.requestId ?? getObjectString(error, "requestId");
  const mapped =
    (code ? CODE_MESSAGES[code] : undefined) ||
    (typeof status === "number" ? STATUS_MESSAGES[status] : undefined) ||
    undefined;
  const rawMessage = input?.message ?? (error instanceof Error ? error.message : getObjectString(error, "message"));

  return {
    title: fallback?.title ?? mapped?.title ?? "Something went wrong",
    message:
      fallback?.message ??
      mapped?.message ??
      rawMessage ??
      "Try again. If the problem keeps happening, refresh the page.",
    retryable: fallback?.retryable ?? mapped?.retryable ?? true,
    requestId: requestId ?? fallback?.requestId
  };
}

export function getFriendlyErrorMessage(error: unknown, fallback?: string): string {
  return getFriendlyError(error, fallback ? { message: fallback } : undefined).message;
}
