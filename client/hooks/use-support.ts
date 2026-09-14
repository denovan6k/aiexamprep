"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  createModerationAppeal,
  createSupportTicket,
  listMySupportTickets,
  type ModerationAppealCreateInput,
  type SupportTicketCreateInput
} from "@/lib/support";
import type { ListParams } from "@/lib/pagination";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useMySupportTicketsQuery(params: ListParams = {}) {
  const token = useAuthToken();
  const normalized = { limit: 10, offset: 0, ...params };
  return useQuery({
    queryKey: queryKeys.support.tickets(normalized),
    queryFn: () => listMySupportTickets(token!, normalized),
    enabled: isAuthenticated(token)
  });
}

export function useCreateSupportTicketMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SupportTicketCreateInput) => createSupportTicket(token!, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.support.all });
    }
  });
}

export function useCreateModerationAppealMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ModerationAppealCreateInput) => createModerationAppeal(token!, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.support.appeals() });
    }
  });
}
