"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getAdminAnalyticsGrowth,
  getAdminAnalyticsOverview,
  getAdminAnalyticsRevenue,
  getAdminAnalyticsUsage,
  getAdminUser,
  getAdminUserUsage,
  grantAdminUserSubscription,
  listAdminAppeals,
  listAdminReports,
  listAdminSubscriptions,
  listAdminSupportTickets,
  listAdminUserChatMessages,
  listAdminUserChatThreads,
  listAdminUsers,
  resolveAdminAppeal,
  resolveAdminReport,
  revokeAdminUserSessions,
  updateAdminSupportTicket,
  updateAdminUser,
  type AdminUserListParams
} from "@/lib/admin";
import { queryKeys } from "@/lib/query-keys";
import type { ListParams } from "@/lib/pagination";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useAdminOverviewQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.admin.analytics.overview(),
    queryFn: () => getAdminAnalyticsOverview(token!),
    enabled: isAuthenticated(token)
  });
}

export function useAdminGrowthQuery(days = 30) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.admin.analytics.growth(days),
    queryFn: () => getAdminAnalyticsGrowth(token!, days),
    enabled: isAuthenticated(token)
  });
}

export function useAdminRevenueQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.admin.analytics.revenue(),
    queryFn: () => getAdminAnalyticsRevenue(token!),
    enabled: isAuthenticated(token)
  });
}

export function useAdminUsageAggregateQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.admin.analytics.usage(),
    queryFn: () => getAdminAnalyticsUsage(token!),
    enabled: isAuthenticated(token)
  });
}

export function useAdminUsersQuery(params: AdminUserListParams = {}) {
  const token = useAuthToken();
  const normalized = { limit: 12, offset: 0, ...params };
  return useQuery({
    queryKey: queryKeys.admin.users.list(normalized),
    queryFn: () => listAdminUsers(token!, normalized),
    enabled: isAuthenticated(token)
  });
}

export function useAdminUserQuery(userId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.admin.users.detail(userId ?? ""),
    queryFn: () => getAdminUser(token!, userId!),
    enabled: isAuthenticated(token) && Boolean(userId)
  });
}

export function useAdminUserUsageQuery(userId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.admin.users.usage(userId ?? ""),
    queryFn: () => getAdminUserUsage(token!, userId!),
    enabled: isAuthenticated(token) && Boolean(userId)
  });
}

export function useAdminUserChatThreadsQuery(userId: string | null, params: ListParams = {}) {
  const token = useAuthToken();
  const normalized = { limit: 20, offset: 0, ...params };
  return useQuery({
    queryKey: queryKeys.admin.users.chatThreads(userId ?? "", normalized),
    queryFn: () => listAdminUserChatThreads(token!, userId!, normalized),
    enabled: isAuthenticated(token) && Boolean(userId)
  });
}

export function useAdminUserChatMessagesQuery(
  userId: string | null,
  threadId: string | null,
  params: ListParams = {}
) {
  const token = useAuthToken();
  const normalized = { limit: 50, offset: 0, ...params };
  return useQuery({
    queryKey: queryKeys.admin.users.chatMessages(userId ?? "", threadId ?? "", normalized),
    queryFn: () => listAdminUserChatMessages(token!, userId!, threadId!, normalized),
    enabled: isAuthenticated(token) && Boolean(userId && threadId)
  });
}

export function useAdminSubscriptionsQuery(params: ListParams & { plan?: string } = {}) {
  const token = useAuthToken();
  const normalized = { limit: 12, offset: 0, ...params };
  return useQuery({
    queryKey: queryKeys.admin.subscriptions.list(normalized),
    queryFn: () => listAdminSubscriptions(token!, normalized),
    enabled: isAuthenticated(token)
  });
}

export function useAdminReportsQuery(params: ListParams = {}) {
  const token = useAuthToken();
  const normalized = { limit: 20, offset: 0, status: "open", ...params };
  return useQuery({
    queryKey: queryKeys.admin.moderation.reports(normalized),
    queryFn: () => listAdminReports(token!, normalized),
    enabled: isAuthenticated(token)
  });
}

export function useAdminAppealsQuery(params: ListParams & { user_id?: string } = {}) {
  const token = useAuthToken();
  const normalized = { limit: 20, offset: 0, ...params };
  return useQuery({
    queryKey: queryKeys.admin.moderation.appeals(normalized),
    queryFn: () => listAdminAppeals(token!, normalized),
    enabled: isAuthenticated(token)
  });
}

export function useAdminSupportTicketsQuery(params: ListParams & { user_id?: string } = {}) {
  const token = useAuthToken();
  const normalized = { limit: 20, offset: 0, ...params };
  return useQuery({
    queryKey: queryKeys.admin.support.tickets(normalized),
    queryFn: () => listAdminSupportTickets(token!, normalized),
    enabled: isAuthenticated(token)
  });
}

export function useUpdateAdminUserMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      body
    }: {
      userId: string;
      body: { role?: "user" | "super_admin"; is_active?: boolean };
    }) => updateAdminUser(token!, userId, body),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.detail(variables.userId) });
    }
  });
}

export function useRevokeAdminUserSessionsMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => revokeAdminUserSessions(token!, userId),
    onSuccess: (_data, userId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.detail(userId) });
    }
  });
}

export function useGrantAdminSubscriptionMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      planCode
    }: {
      userId: string;
      planCode: "free" | "pro_monthly" | "pro_yearly" | "enterprise_monthly" | "enterprise_yearly";
    }) => grantAdminUserSubscription(token!, userId, { plan_code: planCode }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.detail(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.subscriptions.all });
    }
  });
}

export function useResolveAdminReportMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reportId,
      status,
      notes
    }: {
      reportId: string;
      status: "resolved" | "dismissed";
      notes?: string;
    }) => resolveAdminReport(token!, reportId, { status, notes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.moderation.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.analytics.all });
    }
  });
}

export function useResolveAdminAppealMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      appealId,
      status,
      adminResponse
    }: {
      appealId: string;
      status: "approved" | "rejected";
      adminResponse?: string;
    }) => resolveAdminAppeal(token!, appealId, { status, admin_response: adminResponse }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.moderation.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.analytics.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
    }
  });
}

export function useUpdateAdminSupportTicketMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ticketId,
      body
    }: {
      ticketId: string;
      body: {
        status?: "open" | "in_progress" | "resolved" | "closed";
        priority?: "low" | "normal" | "high";
        admin_notes?: string;
      };
    }) => updateAdminSupportTicket(token!, ticketId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.support.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.analytics.all });
    }
  });
}
