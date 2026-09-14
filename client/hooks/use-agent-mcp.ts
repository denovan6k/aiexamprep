"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  createAgentMcpConnection,
  deleteAgentMcpConnection,
  listAgentMcpConnections,
  syncAgentMcpConnection,
  testAgentMcpConnection,
  updateAgentMcpConnection
} from "@/lib/study";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useAgentMcpConnectionsQuery(agentId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: [...queryKeys.agents.agent(agentId ?? ""), "mcp"],
    queryFn: () => listAgentMcpConnections(token!, agentId!),
    enabled: isAuthenticated(token) && Boolean(agentId)
  });
}

export function useCreateAgentMcpMutation(agentId: string) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createAgentMcpConnection>[2]) =>
      createAgentMcpConnection(token!, agentId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.agent(agentId) });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.agents.agent(agentId), "mcp"] });
    }
  });
}

export function useUpdateAgentMcpMutation(agentId: string) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectionId,
      payload
    }: {
      connectionId: string;
      payload: Parameters<typeof updateAgentMcpConnection>[3];
    }) => updateAgentMcpConnection(token!, agentId, connectionId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.agents.agent(agentId), "mcp"] });
    }
  });
}

export function useDeleteAgentMcpMutation(agentId: string) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => deleteAgentMcpConnection(token!, agentId, connectionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.agent(agentId) });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.agents.agent(agentId), "mcp"] });
    }
  });
}

export function useSyncAgentMcpMutation(agentId: string) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => syncAgentMcpConnection(token!, agentId, connectionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.agents.agent(agentId), "mcp"] });
    }
  });
}

export function useTestAgentMcpMutation(agentId: string) {
  const token = useAuthToken();
  return useMutation({
    mutationFn: (connectionId: string) => testAgentMcpConnection(token!, agentId, connectionId)
  });
}
