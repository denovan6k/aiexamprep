"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCommunityGroup,
  createContentReport,
  createGroupThread,
  createThreadReply,
  deleteCommunityGroup,
  deleteReply,
  deleteThread,
  getCommunityGroup,
  getCommunityGroupBySlug,
  getCommunityProfile,
  getThread,
  joinCommunityGroup,
  leaveCommunityGroup,
  listCommunityFeed,
  listCommunityGroups,
  listGroupMembers,
  listGroupThreads,
  listModerationReports,
  listNotifications,
  listSharedResources,
  listThreadReplies,
  lockThread,
  markAllNotificationsRead,
  markNotificationRead,
  pinThread,
  resolveContentReport,
  searchCommunity,
  shareResource,
  unlockThread,
  unpinThread,
  updateCommunityGroup,
  updateCommunityProfile,
  updateReply,
  updateThread,
  voteReply,
  voteThread,
  type ThreadSort
} from "@/lib/community";
import { queryKeys } from "@/lib/query-keys";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useCommunityGroupsQuery(token?: string | null) {
  const authToken = useAuthToken();
  const effectiveToken = token ?? authToken;
  return useQuery({
    queryKey: queryKeys.community.all,
    queryFn: () => listCommunityGroups(effectiveToken),
    enabled: true
  });
}

export function useCommunityFeedQuery(sort: ThreadSort = "newest", token?: string | null) {
  const authToken = useAuthToken();
  const effectiveToken = token ?? authToken;
  return useQuery({
    queryKey: queryKeys.community.posts({ feed: sort }),
    queryFn: () => listCommunityFeed(sort, effectiveToken)
  });
}

export function useCommunityGroupQuery(groupId: string | null, token?: string | null) {
  const authToken = useAuthToken();
  const effectiveToken = token ?? authToken;
  return useQuery({
    queryKey: [...queryKeys.community.all, "groups", groupId] as const,
    queryFn: () => getCommunityGroup(groupId!, effectiveToken),
    enabled: Boolean(groupId)
  });
}

export function useCommunityGroupBySlugQuery(slug: string | null, token?: string | null) {
  const authToken = useAuthToken();
  const effectiveToken = token ?? authToken;
  return useQuery({
    queryKey: [...queryKeys.community.all, "groups", "slug", slug] as const,
    queryFn: () => getCommunityGroupBySlug(slug!, effectiveToken),
    enabled: Boolean(slug)
  });
}

export function useGroupThreadsQuery(groupId: string | null, sort: ThreadSort = "newest", token?: string | null) {
  const authToken = useAuthToken();
  const effectiveToken = token ?? authToken;
  return useQuery({
    queryKey: [...queryKeys.community.all, "groups", groupId, "threads", sort] as const,
    queryFn: () => listGroupThreads(groupId!, effectiveToken, sort),
    enabled: Boolean(groupId)
  });
}

export function useCommunityThreadQuery(threadId: string | null, token?: string | null) {
  const authToken = useAuthToken();
  const effectiveToken = token ?? authToken;
  return useQuery({
    queryKey: queryKeys.community.post(threadId!),
    queryFn: () => getThread(threadId!, effectiveToken),
    enabled: Boolean(threadId)
  });
}

export function useThreadRepliesQuery(threadId: string | null, token?: string | null) {
  const authToken = useAuthToken();
  const effectiveToken = token ?? authToken;
  return useQuery({
    queryKey: [...queryKeys.community.post(threadId!), "replies"] as const,
    queryFn: () => listThreadReplies(threadId!, effectiveToken),
    enabled: Boolean(threadId)
  });
}

export function useCommunityNotificationsQuery(unreadOnly = false) {
  const token = useAuthToken();
  return useQuery({
    queryKey: [...queryKeys.community.all, "notifications", unreadOnly] as const,
    queryFn: () => listNotifications(token!, unreadOnly),
    enabled: isAuthenticated(token)
  });
}

function invalidateCommunity(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.community.all });
}

export function useCreateCommunityGroupMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createCommunityGroup>[1]) => createCommunityGroup(token!, payload),
    onSuccess: () => invalidateCommunity(queryClient)
  });
}

export function useUpdateCommunityGroupMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: Parameters<typeof updateCommunityGroup>[2] }) =>
      updateCommunityGroup(token!, groupId, payload),
    onSuccess: () => invalidateCommunity(queryClient)
  });
}

export function useDeleteCommunityGroupMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => deleteCommunityGroup(token!, groupId),
    onSuccess: () => invalidateCommunity(queryClient)
  });
}

export function useJoinCommunityGroupMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => joinCommunityGroup(token!, groupId),
    onSuccess: () => invalidateCommunity(queryClient)
  });
}

export function useLeaveCommunityGroupMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => leaveCommunityGroup(token!, groupId),
    onSuccess: () => invalidateCommunity(queryClient)
  });
}

export function useCreateGroupThreadMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, title, body }: { groupId: string; title: string; body: string }) =>
      createGroupThread(token!, groupId, title, body),
    onSuccess: () => invalidateCommunity(queryClient)
  });
}

export function useUpdateCommunityThreadMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      payload
    }: {
      threadId: string;
      payload: { title?: string; body?: string };
    }) => updateThread(token!, threadId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.community.post(variables.threadId) });
      invalidateCommunity(queryClient);
    }
  });
}

export function useDeleteCommunityThreadMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => deleteThread(token!, threadId),
    onSuccess: () => invalidateCommunity(queryClient)
  });
}

export function useVoteThreadMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, vote }: { threadId: string; vote: -1 | 0 | 1 }) =>
      voteThread(token!, threadId, vote),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.community.post(variables.threadId) });
      invalidateCommunity(queryClient);
    }
  });
}

export function useCreateThreadReplyMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      body,
      parentId
    }: {
      threadId: string;
      body: string;
      parentId?: string;
    }) => createThreadReply(token!, threadId, body, parentId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.community.post(variables.threadId), "replies"]
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.community.post(variables.threadId) });
    }
  });
}

export function useUpdateReplyMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ replyId, body, threadId }: { replyId: string; body: string; threadId: string }) =>
      updateReply(token!, replyId, body),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.community.post(variables.threadId), "replies"]
      });
    }
  });
}

export function useDeleteReplyMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ replyId, threadId }: { replyId: string; threadId: string }) =>
      deleteReply(token!, replyId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.community.post(variables.threadId), "replies"]
      });
    }
  });
}

export function useVoteReplyMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      replyId,
      vote,
      threadId
    }: {
      replyId: string;
      vote: -1 | 0 | 1;
      threadId: string;
    }) => voteReply(token!, replyId, vote),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.community.post(variables.threadId), "replies"]
      });
    }
  });
}

export function useShareResourceMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      payload
    }: {
      groupId: string;
      payload: {
        resource_type: string;
        resource_id: string;
        title: string;
        description?: string;
        visibility?: string;
      };
    }) => shareResource(token!, groupId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.community.sharedResources() });
    }
  });
}

export function useMarkNotificationReadMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(token!, notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.community.all, "notifications"] });
    }
  });
}

export function useMarkAllNotificationsReadMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(token!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.community.all, "notifications"] });
    }
  });
}

export function useUpdateCommunityProfileMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof updateCommunityProfile>[1]) =>
      updateCommunityProfile(token!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.community.all, "profiles"] });
    }
  });
}

export function useSearchCommunityMutation() {
  const token = useAuthToken();
  return useMutation({
    mutationFn: (query: string) => searchCommunity(query, token)
  });
}
