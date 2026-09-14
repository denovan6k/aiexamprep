import { apiRequest } from "@/lib/api";

export const ANALYTICS_OPT_IN_KEY = "prepwise_product_analytics_opt_in";

export type ProductEventName =
  | "onboarding_started"
  | "onboarding_completed"
  | "course_created"
  | "material_uploaded"
  | "quiz_started"
  | "quiz_submitted"
  | "flashcard_reviewed"
  | "course_workspace_viewed"
  | "course_workspace_tab_changed"
  | "study_plan_viewed"
  | "study_plan_refreshed"
  | "study_plan_item_started"
  | "study_plan_item_completed"
  | "study_plan_item_dismissed"
  | "remediation_created";

export type ProductEvent = {
  event_id: string;
  name: ProductEventName;
  properties: Record<string, string | number | boolean>;
  occurred_at: string;
};

const SESSION_KEY = "prepwise_analytics_session";
const QUEUE_KEY = "prepwise_analytics_queue";
const BLOCKED_PROPERTY = /email|name|title|text|content|prompt|answer|token|file|topic|description|id/i;

export function isProductAnalyticsEnabled(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(ANALYTICS_OPT_IN_KEY) === "true";
}

export function setProductAnalyticsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANALYTICS_OPT_IN_KEY, String(enabled));
  if (!enabled) window.sessionStorage.removeItem(QUEUE_KEY);
}

function sessionId(): string {
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const value = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, value);
  return value;
}

function safeProperties(properties: Record<string, unknown>) {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (BLOCKED_PROPERTY.test(key)) continue;
    if (typeof value === "string") safe[key] = value.slice(0, 80);
    if (typeof value === "number" || typeof value === "boolean") safe[key] = value;
  }
  return safe;
}

function readQueue(): ProductEvent[] {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(value) ? (value as ProductEvent[]).slice(-99) : [];
  } catch {
    return [];
  }
}

export async function sendProductEventBatch(token: string, events: ProductEvent[]) {
  return apiRequest<{ accepted: number; duplicates: number }>("/analytics/events/batch", {
    method: "POST",
    token,
    body: JSON.stringify({ events })
  });
}

/**
 * Queues and sends an opted-in event. Rejected requests remain in sessionStorage
 * with the same event IDs so retries are safe; analytics never blocks the caller.
 */
export async function trackProductEvent(
  token: string | null | undefined,
  name: ProductEventName,
  properties: Record<string, unknown> = {}
): Promise<void> {
  if (!token || typeof window === "undefined" || !isProductAnalyticsEnabled()) return;
  const queued = readQueue();
  queued.push({
    event_id: `${sessionId()}:${crypto.randomUUID()}`,
    name,
    properties: safeProperties(properties),
    occurred_at: new Date().toISOString()
  });
  window.sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queued));
  try {
    await sendProductEventBatch(token, queued);
    window.sessionStorage.removeItem(QUEUE_KEY);
  } catch {
    // Product analytics is intentionally best-effort.
  }
}
