"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PlatformLlmProvider } from "@/lib/llm";
import type { ApiKeyProvider } from "@/lib/settings";
import {
  createThread,
  deleteThread,
  listChatAgents,
  listMessages,
  listThreads,
  updateThread,
  updateThreadAgent,
  updateThreadLlmSource,
  type ChatMessage,
  type CreateThreadInput
} from "@/lib/chat";
import { queryKeys } from "@/lib/query-keys";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useChatThreadsQuery(options?: { includeArchived?: boolean }) {
  const token = useAuthToken();
  const includeArchived = options?.includeArchived ?? true;
  return useQuery({
    queryKey: queryKeys.chat.threads(includeArchived),
    queryFn: () => listThreads(token!, { includeArchived }),
    enabled: isAuthenticated(token),
    staleTime: 60_000
  });
}

export function useChatMessagesQuery(threadId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.chat.messages(threadId!),
    queryFn: () => listMessages(token!, threadId!),
    enabled: isAuthenticated(token) && Boolean(threadId),
    staleTime: 30_000
  });
}

export function useChatAgentsQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.chat.agents(),
    queryFn: () => listChatAgents(token!),
    enabled: isAuthenticated(token)
  });
}

export function useCreateThreadMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input?: CreateThreadInput) => createThread(token!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
    }
  });
}

export function useUpdateThreadMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      input
    }: {
      threadId: string;
      input: Parameters<typeof updateThread>[2];
    }) => updateThread(token!, threadId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
    }
  });
}

export function useDeleteThreadMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => deleteThread(token!, threadId),
    onSuccess: (_data, threadId) => {
      queryClient.removeQueries({ queryKey: queryKeys.chat.messages(threadId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
    }
  });
}

export function useUpdateThreadAgentMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, agentId }: { threadId: string; agentId: string | null }) =>
      updateThreadAgent(token!, threadId, agentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
    }
  });
}

export function useUpdateThreadLlmSourceMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      source,
      provider
    }: {
      threadId: string;
      source: "platform" | "byok";
      provider: ApiKeyProvider | PlatformLlmProvider | null;
    }) => updateThreadLlmSource(token!, threadId, source, provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
    }
  });
}

export function useInvalidateChatMessages() {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  return async (threadId: string): Promise<ChatMessage[]> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(threadId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
    return queryClient.fetchQuery({
      queryKey: queryKeys.chat.messages(threadId),
      queryFn: () => listMessages(token!, threadId)
    });
  };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

import {
  bulkThreadAction,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
  type BulkThreadInput,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/chat";

export function useChatProjectsQuery(options?: { includeArchived?: boolean }) {
  const token = useAuthToken();
  const includeArchived = options?.includeArchived ?? false;
  return useQuery({
    queryKey: queryKeys.chat.projects(includeArchived),
    queryFn: () => listProjects(token!, { includeArchived }),
    enabled: isAuthenticated(token),
    staleTime: 60_000,
  });
}

export function useChatProjectQuery(projectId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.chat.project(projectId!),
    queryFn: () => getProject(token!, projectId!),
    enabled: isAuthenticated(token) && Boolean(projectId),
    staleTime: 60_000,
  });
}

export function useCreateProjectMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(token!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat", "projects"] });
    },
  });
}

export function useUpdateProjectMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: UpdateProjectInput }) =>
      updateProject(token!, projectId, input),
    onSuccess: (_data, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: ["chat", "projects"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.project(projectId) });
    },
  });
}

export function useDeleteProjectMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => deleteProject(token!, projectId),
    onSuccess: (_data, projectId) => {
      queryClient.removeQueries({ queryKey: queryKeys.chat.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: ["chat", "projects"] });
      // Threads may have been unassigned
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
    },
  });
}

export function useBulkThreadActionMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkThreadInput) => bulkThreadAction(token!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
      // Project thread counts may have changed
      void queryClient.invalidateQueries({ queryKey: ["chat", "projects"] });
    },
  });
}
