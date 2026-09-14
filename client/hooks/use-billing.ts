"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  createBillingCheckout,
  createBillingPortal,
  getBillingUsage,
  getBillingUsageHistory,
  getFlashcardStudyStats,
  getProgressOverview,
  listBillingPlans,
  purchaseCredits,
  type BillingPlan
} from "@/lib/study";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export const UPLOAD_LIMIT_MESSAGE =
  "You reached your upload limit for this period and have no credits left. Upgrade your plan or buy credits to upload more.";

export const CHAT_COMPLETION_LIMIT_MESSAGE =
  "You reached your chat completion limit for this period and have no credits left. Upgrade your plan or buy credits to continue chatting.";

/** @deprecated Use CHAT_COMPLETION_LIMIT_MESSAGE */
export const GENERATION_LIMIT_MESSAGE = CHAT_COMPLETION_LIMIT_MESSAGE;

export type PlanQuotaUsageStats = {
  generationsUsed: number;
  generationLimit: number | null;
  uploadsUsed: number;
  uploadLimit: number | null;
};

export function usePlanQuota() {
  const query = useBillingUsageQuery();
  const usage = query.data;

  const generationLimit = usage?.generation_limit ?? null;
  const generationsUsed = usage?.generations_used ?? 0;
  const uploadLimit = usage?.upload_limit ?? null;
  const uploadUsed = usage?.material_uploads_used ?? 0;
  const creditsBalance = usage?.credits_balance ?? 0;

  const chatCompletionBlocked =
    generationLimit !== null && generationsUsed >= generationLimit && creditsBalance <= 0;
  const uploadBlocked = uploadLimit !== null && uploadUsed >= uploadLimit && creditsBalance <= 0;

  const usageStats: PlanQuotaUsageStats | null = usage
    ? {
        generationsUsed,
        generationLimit,
        uploadsUsed: uploadUsed,
        uploadLimit
      }
    : null;

  return {
    ...query,
    usage,
    chatCompletionBlocked,
    uploadBlocked,
    chatCompletionBlockedReason: chatCompletionBlocked ? CHAT_COMPLETION_LIMIT_MESSAGE : null,
    uploadBlockedReason: uploadBlocked ? UPLOAD_LIMIT_MESSAGE : null,
    /** @deprecated Use chatCompletionBlocked */
    generationBlocked: chatCompletionBlocked,
    /** @deprecated Use chatCompletionBlockedReason */
    generationBlockedReason: chatCompletionBlocked ? CHAT_COMPLETION_LIMIT_MESSAGE : null,
    usageStats
  };
}

export function useBillingUsageQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.settings.usage(),
    queryFn: () => getBillingUsage(token!),
    enabled: isAuthenticated(token)
  });
}

export function useBillingUsageHistoryQuery(days = 30) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.settings.usageHistory(days),
    queryFn: () => getBillingUsageHistory(token!, days),
    enabled: isAuthenticated(token)
  });
}

export function useBillingPlansQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: [...queryKeys.settings.billing(), "plans"] as const,
    queryFn: () => listBillingPlans(token!),
    enabled: isAuthenticated(token)
  });
}

export function useCreateBillingCheckoutMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      planCode,
      customerEmail
    }: {
      planCode: BillingPlan["code"];
      customerEmail?: string | null;
    }) => createBillingCheckout(token!, planCode, customerEmail),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.billing() });
    }
  });
}

export function useCreateBillingPortalMutation() {
  const token = useAuthToken();
  return useMutation({
    mutationFn: (customerEmail?: string | null) => createBillingPortal(token!, customerEmail)
  });
}

export function usePurchaseCreditsMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ credits, description }: { credits: number; description?: string }) =>
      purchaseCredits(token!, credits, description),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.usage() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.billing() });
    }
  });
}

export function useProgressOverviewQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: [...queryKeys.quizzes.all, "progress"] as const,
    queryFn: () => getProgressOverview(token!),
    enabled: isAuthenticated(token)
  });
}

export function useFlashcardStudyStatsQuery(topic?: string) {
  const token = useAuthToken();
  return useQuery({
    queryKey: [...queryKeys.flashcards.all, "study-stats", topic ?? "all"] as const,
    queryFn: () => getFlashcardStudyStats(token!, topic),
    enabled: isAuthenticated(token)
  });
}
