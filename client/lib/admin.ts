import { apiRequest } from "@/lib/api";
import { buildListQuery, type ListParams, type PaginatedResult } from "@/lib/pagination";

export type AdminUserListItem = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  plan_code: string;
  created_at: string;
  updated_at: string;
};

export type AdminUserDetail = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_email_verified: boolean;
  institution_id: string | null;
  institution_name: string | null;
  created_at: string;
  updated_at: string;
  active_sessions: number;
  subscription: {
    plan_code: string;
    plan_name: string | null;
    status: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  };
  activity: {
    courses: number;
    chat_threads: number;
    support_tickets: number;
    moderation_appeals: number;
    usage_events_this_month: number;
  };
};

export type AdminAnalyticsOverview = {
  total_users: number;
  active_users: number;
  active_subscribers: number;
  estimated_mrr_cents: number;
  open_support_tickets: number;
  open_appeals: number;
  open_reports: number;
  is_revenue_estimated: boolean;
};

export type AdminGrowthResponse = {
  days: number;
  points: { date: string; signups: number }[];
};

export type AdminRevenueBreakdown = {
  estimated_mrr_cents: number;
  estimated_arr_cents: number;
  active_subscribers: number;
  by_plan: {
    plan_code: string;
    plan_name: string;
    subscriber_count: number;
    mrr_contribution_cents: number;
  }[];
  is_estimated: boolean;
};

export type AdminUsageAggregateResponse = {
  items: { event_type: string; total_quantity: number }[];
};

export type AdminSubscriptionListItem = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  plan_code: string | null;
  plan_name: string | null;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
};

export type SupportTicket = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  category: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  assigned_admin_id: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ModerationAppeal = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  appeal_type: string;
  reference_type: string | null;
  reference_id: string | null;
  reason: string;
  status: string;
  reviewed_by_user_id: string | null;
  admin_response: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminContentReport = {
  id: string;
  reporter_id: string;
  reporter_email: string | null;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
};

export type AdminChatThreadSummary = {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminChatMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

export type AdminUserUsageSummary = {
  plan_code: string;
  courses_used: number;
  material_uploads_used: number;
  quiz_generations_used: number;
  flashcard_generations_used: number;
  agent_creates_used: number;
  chat_messages_used: number;
};

export type AdminUserListParams = ListParams & {
  role?: string;
  plan?: string;
  is_active?: boolean;
};

function buildAdminUserQuery(params?: AdminUserListParams): string {
  const base = buildListQuery(params);
  const search = new URLSearchParams(base.replace(/^\?/, ""));
  if (params?.role) search.set("role", params.role);
  if (params?.plan) search.set("plan", params.plan);
  if (typeof params?.is_active === "boolean") search.set("is_active", String(params.is_active));
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function listAdminUsers(token: string, params?: AdminUserListParams) {
  return apiRequest<PaginatedResult<AdminUserListItem>>(`/admin/users${buildAdminUserQuery(params)}`, { token });
}

export function getAdminUser(token: string, userId: string) {
  return apiRequest<AdminUserDetail>(`/admin/users/${userId}`, { token });
}

export function updateAdminUser(
  token: string,
  userId: string,
  body: { role?: "user" | "super_admin"; is_active?: boolean }
) {
  return apiRequest<AdminUserDetail>(`/admin/users/${userId}`, { token, method: "PATCH", body: JSON.stringify(body) });
}

export function revokeAdminUserSessions(token: string, userId: string) {
  return apiRequest<{ sessions_revoked: number }>(`/admin/users/${userId}/revoke-sessions`, {
    token,
    method: "POST"
  });
}

export function grantAdminUserSubscription(
  token: string,
  userId: string,
  body: {
    plan_code: "free" | "pro_monthly" | "pro_yearly" | "enterprise_monthly" | "enterprise_yearly";
    status?: "active" | "trialing";
  }
) {
  return apiRequest<AdminUserDetail>(`/admin/users/${userId}/grant-subscription`, {
    token,
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function getAdminUserUsage(token: string, userId: string) {
  return apiRequest<AdminUserUsageSummary>(`/admin/users/${userId}/usage`, { token });
}

export function listAdminUserChatThreads(token: string, userId: string, params?: ListParams) {
  return apiRequest<PaginatedResult<AdminChatThreadSummary>>(
    `/admin/users/${userId}/chat-threads${buildListQuery(params)}`,
    { token }
  );
}

export function listAdminUserChatMessages(
  token: string,
  userId: string,
  threadId: string,
  params?: ListParams
) {
  return apiRequest<PaginatedResult<AdminChatMessage>>(
    `/admin/users/${userId}/chat-threads/${threadId}/messages${buildListQuery(params)}`,
    { token }
  );
}

export function getAdminAnalyticsOverview(token: string) {
  return apiRequest<AdminAnalyticsOverview>("/admin/analytics/overview", { token });
}

export function getAdminAnalyticsGrowth(token: string, days = 30) {
  return apiRequest<AdminGrowthResponse>(`/admin/analytics/growth?days=${days}`, { token });
}

export function getAdminAnalyticsRevenue(token: string) {
  return apiRequest<AdminRevenueBreakdown>("/admin/analytics/revenue", { token });
}

export function getAdminAnalyticsUsage(token: string) {
  return apiRequest<AdminUsageAggregateResponse>("/admin/analytics/usage", { token });
}

export function listAdminSubscriptions(token: string, params?: ListParams & { plan?: string }) {
  const search = new URLSearchParams(buildListQuery(params).replace(/^\?/, ""));
  if (params?.plan) search.set("plan", params.plan);
  const query = search.toString();
  return apiRequest<PaginatedResult<AdminSubscriptionListItem>>(
    `/admin/subscriptions${query ? `?${query}` : ""}`,
    { token }
  );
}

export function listAdminReports(token: string, params?: ListParams) {
  return apiRequest<PaginatedResult<AdminContentReport>>(
    `/admin/moderation/reports${buildListQuery(params)}`,
    { token }
  );
}

export function resolveAdminReport(
  token: string,
  reportId: string,
  body: { status: "resolved" | "dismissed"; notes?: string }
) {
  return apiRequest<AdminContentReport>(`/admin/moderation/reports/${reportId}/resolve`, {
    token,
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function listAdminAppeals(token: string, params?: ListParams & { user_id?: string }) {
  const search = new URLSearchParams(buildListQuery(params).replace(/^\?/, ""));
  if (params?.user_id) search.set("user_id", params.user_id);
  const query = search.toString();
  return apiRequest<PaginatedResult<ModerationAppeal>>(
    `/admin/moderation/appeals${query ? `?${query}` : ""}`,
    { token }
  );
}

export function resolveAdminAppeal(
  token: string,
  appealId: string,
  body: { status: "approved" | "rejected"; admin_response?: string }
) {
  return apiRequest<ModerationAppeal>(`/admin/moderation/appeals/${appealId}/resolve`, {
    token,
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function listAdminSupportTickets(token: string, params?: ListParams & { user_id?: string }) {
  const search = new URLSearchParams(buildListQuery(params).replace(/^\?/, ""));
  if (params?.user_id) search.set("user_id", params.user_id);
  const query = search.toString();
  return apiRequest<PaginatedResult<SupportTicket>>(
    `/admin/support/tickets${query ? `?${query}` : ""}`,
    { token }
  );
}

export function updateAdminSupportTicket(
  token: string,
  ticketId: string,
  body: {
    status?: "open" | "in_progress" | "resolved" | "closed";
    priority?: "low" | "normal" | "high";
    admin_notes?: string;
  }
) {
  return apiRequest<SupportTicket>(`/admin/support/tickets/${ticketId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export function formatCents(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}
