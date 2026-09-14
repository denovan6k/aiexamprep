"use client";

export type ApiUser = {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  institution?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  is_institution_admin?: boolean;
  role?: string;
};

export function isSuperAdmin(user: ApiUser | null | undefined): boolean {
  return user?.role === "super_admin";
}

export type AuthResponse = {
  user: ApiUser;
  token_type: "bearer";
  expires_in: number;
};

export const API_BASE_URL = "/api/backend";

export class ApiError extends Error {
  status: number;
  code?: string;
  requestId?: string;
  fieldErrors: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    options: {
      code?: string;
      requestId?: string;
      fieldErrors?: Record<string, string[]>;
    } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

type ApiErrorBody = {
  detail?: unknown;
  message?: unknown;
  error?: {
    message?: unknown;
    code?: unknown;
    fields?: unknown;
    request_id?: unknown;
  };
};

function toFieldErrors(fields: unknown): Record<string, string[]> {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return {};
  return Object.fromEntries(
    Object.entries(fields).flatMap(([field, messages]) => {
      if (!Array.isArray(messages)) return [];
      const safeMessages = messages.filter((message): message is string => typeof message === "string");
      return safeMessages.length ? [[field, safeMessages]] : [];
    })
  );
}

function messageFromDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const message = "msg" in item ? item.msg : null;
        const location = "loc" in item && Array.isArray(item.loc) ? item.loc.filter(Boolean).join(".") : null;
        if (typeof message !== "string") return null;
        return location ? `${location}: ${message}` : message;
      })
      .filter((message): message is string => Boolean(message));
    return messages.length ? messages.join(" ") : null;
  }
  return null;
}

const GENERIC_UNAVAILABLE = "The service is temporarily unavailable. Please try again shortly.";

function isInfrastructureErrorMessage(message: string): boolean {
  return (
    /https?:\/\//i.test(message) ||
    /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1)\b/i.test(message) ||
    /\b(?:uvicorn|fastapi|ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN)\b/i.test(message) ||
    /\bfetch failed\b/i.test(message) ||
    /\bfailed to fetch\b/i.test(message) ||
    /\bnetworkerror\b/i.test(message)
  );
}

function toClientSafeMessage(message: string, code?: string): string {
  if (code === "backend_unreachable" || isInfrastructureErrorMessage(message)) {
    return GENERIC_UNAVAILABLE;
  }
  return message;
}

export function parseApiError(body: unknown, status: number, statusText: string): ApiError {
  const fallback = statusText || "Request failed";
  if (!body || typeof body !== "object") {
    return new ApiError(toClientSafeMessage(fallback), status);
  }

  const payload = body as ApiErrorBody;
  const error = payload.error;
  const code = typeof error?.code === "string" ? error.code : undefined;
  const message =
    (typeof error?.message === "string" && error.message) ||
    messageFromDetail(payload.detail) ||
    (typeof payload.message === "string" && payload.message) ||
    fallback;

  return new ApiError(toClientSafeMessage(message, code), status, {
    code,
    requestId: typeof error?.request_id === "string" ? error.request_id : undefined,
    fieldErrors: toFieldErrors(error?.fields)
  });
}

export function getClientErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error == null) return "";
  if (error instanceof ApiError) {
    return toClientSafeMessage(error.message || fallback, error.code);
  }
  if (error instanceof Error) {
    return toClientSafeMessage(error.message || fallback);
  }
  return fallback;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw parseApiError(body, response.status, response.statusText);
  }
  return body as T;
}
