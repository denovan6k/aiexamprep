"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  updateAgent,
  uploadAgentAvatar,
  type AgentUpdateInput
} from "@/lib/study";
import type { ListParams } from "@/lib/pagination";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useAgentsQuery(params: ListParams = {}) {
  const token = useAuthToken();
  const normalized = { limit: 12, offset: 0, ...params };
  return useQuery({
    queryKey: [...queryKeys.agents.list(), normalized],
    queryFn: () => listAgents(token!, normalized),
    enabled: isAuthenticated(token)
  });
}

export function useAgentQuery(agentId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.agents.agent(agentId ?? ""),
    queryFn: () => getAgent(token!, agentId!),
    enabled: isAuthenticated(token) && Boolean(agentId)
  });
}

export function useCreateAgentMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ description, name }: { description: string; name?: string }) =>
      createAgent(token!, description, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.agents() });
    }
  });
}

export function useUpdateAgentMutation(agentId: string) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AgentUpdateInput) => updateAgent(token!, agentId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.agent(agentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.agents() });
    }
  });
}

export function useUploadAgentAvatarMutation(agentId: string) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAgentAvatar(token!, agentId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.agent(agentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.agents() });
    }
  });
}

export function useDeleteAgentMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => deleteAgent(token!, agentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.agents() });
    }
  });
}
