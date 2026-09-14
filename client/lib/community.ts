import { ApiError, apiRequest } from "@/lib/api";

export type CommunityGroup = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: string;
  school_name: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  member_count: number;
  is_member?: boolean;
  membership_role?: string | null;
  created_at: string;
  updated_at: string;
};

export type CommunityThread = {
  id: string;
  group_id: string;
  title: string;
  body: string;
  author_id?: string | null;
  author_name?: string | null;
  pinned: boolean;
  locked: boolean;
  reply_count?: number;
  upvote_count?: number;
  downvote_count?: number;
  score?: number;
  user_vote?: number | null;
  created_at: string;
  updated_at: string;
};

export type CommunityReply = {
  id: string;
  thread_id: string;
  parent_id?: string | null;
  body: string;
  author_id?: string | null;
  author_name?: string | null;
  upvote_count?: number;
  downvote_count?: number;
  score?: number;
  user_vote?: number | null;
  created_at: string;
  updated_at: string;
};

export type CommunityMember = {
  user_id: string;
  name: string;
  role: string;
  status: string;
  joined_at: string;
};

export type SharedResource = {
  id: string;
  group_id: string;
  resource_type: string;
  resource_id: string;
  title: string;
  description: string | null;
  visibility: string;
  shared_by_user_id?: string | null;
  shared_by_name?: string | null;
  intro_thread_id?: string | null;
  created_at: string;
};

export type ContentReport = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
};

export type CommunitySearchResult = {
  groups: CommunityGroup[];
  threads: CommunityThread[];
};

export type CommunityFeedItem = CommunityThread & {
  group_slug: string;
  group_name: string;
};

export type CommunityProfile = {
  user_id: string;
  name: string;
  reputation_score: number;
  reputation_tier: string;
  bio: string | null;
  study_interests: string[];
  joined_groups: Array<{ id: string; name: string; slug: string }>;
  thread_count: number;
  reply_count: number;
  recent_threads: CommunityThread[];
  recent_replies: CommunityReply[];
};

export type CommunityNotification = {
  id: string;
  notification_type: string;
  title: string;
  body: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  group_id: string | null;
  group_slug: string | null;
  thread_id: string | null;
  reply_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type ThreadSort = "newest" | "top" | "trending";

export function reputationTierLabel(tier: string): string {
  switch (tier) {
    case "trusted":
      return "Trusted member";
    case "contributor":
      return "Contributor";
    default:
      return "Newcomer";
  }
}

export async function listCommunityGroups(token?: string | null) {
  return apiRequest<CommunityGroup[]>("/community/groups", { token: token ?? undefined, cache: "no-store" });
}

export async function listCommunityFeed(sort: ThreadSort = "newest", token?: string | null) {
  try {
    return await apiRequest<CommunityFeedItem[]>(`/community/feed?sort=${sort}`, {
      token: token ?? undefined,
      cache: "no-store"
    });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      throw err;
    }
    return buildCommunityFeedFromGroups(sort, token);
  }
}

async function buildCommunityFeedFromGroups(
  sort: ThreadSort,
  token?: string | null
): Promise<CommunityFeedItem[]> {
  const groups = await listCommunityGroups(token);
  const visibleGroups = groups.filter((group) => group.visibility === "public" || group.is_member);
  const threadBatches = await Promise.all(
    visibleGroups.slice(0, 20).map(async (group) => {
      const threads = await listGroupThreads(group.id, token, sort);
      return threads.map(
        (thread): CommunityFeedItem => ({
          ...thread,
          group_slug: group.slug,
          group_name: group.name
        })
      );
    })
  );

  const items = threadBatches.flat();
  if (sort === "top") {
    items.sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      return (
        (b.score ?? 0) - (a.score ?? 0) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  } else if (sort === "trending") {
    items.sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      const aHot = (a.score ?? 0) + (a.reply_count ?? 0);
      const bHot = (b.score ?? 0) + (b.reply_count ?? 0);
      return bHot - aHot || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  } else {
    items.sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  return items.slice(0, 25);
}

export async function searchCommunity(query: string, token?: string | null) {
  return apiRequest<CommunitySearchResult>(`/community/search?q=${encodeURIComponent(query)}`, {
    token: token ?? undefined
  });
}

export async function getCommunityGroup(groupId: string, token?: string | null) {
  return apiRequest<CommunityGroup>(`/community/groups/${groupId}`, { token: token ?? undefined });
}

export async function getCommunityGroupBySlug(slug: string, token?: string | null) {
  return apiRequest<CommunityGroup>(`/community/groups/by-slug/${slug}`, { token: token ?? undefined, cache: "no-store" });
}

export async function createCommunityGroup(
  token: string,
  payload: {
    name: string;
    description?: string;
    visibility?: string;
    school_name?: string;
  }
) {
  return apiRequest<CommunityGroup>("/community/groups", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateCommunityGroup(
  token: string,
  groupId: string,
  payload: Partial<{ name: string; description: string; visibility: string; school_name: string }>
) {
  return apiRequest<CommunityGroup>(`/community/groups/${groupId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload)
  });
}

export async function deleteCommunityGroup(token: string, groupId: string) {
  return apiRequest<void>(`/community/groups/${groupId}`, { method: "DELETE", token });
}

export async function joinCommunityGroup(token: string, groupId: string) {
  return apiRequest<CommunityGroup>(`/community/groups/${groupId}/join`, { method: "POST", token });
}

export async function leaveCommunityGroup(token: string, groupId: string) {
  return apiRequest<CommunityGroup>(`/community/groups/${groupId}/leave`, { method: "POST", token });
}

export async function listGroupMembers(groupId: string, token?: string | null) {
  return apiRequest<CommunityMember[]>(`/community/groups/${groupId}/members`, {
    token: token ?? undefined
  });
}

export async function listGroupThreads(groupId: string, token?: string | null, sort: ThreadSort = "newest") {
  return apiRequest<CommunityThread[]>(`/community/groups/${groupId}/threads?sort=${sort}`, {
    token: token ?? undefined,
    cache: "no-store"
  });
}

export async function createGroupThread(token: string, groupId: string, title: string, body: string) {
  return apiRequest<CommunityThread>(`/community/groups/${groupId}/threads`, {
    method: "POST",
    token,
    body: JSON.stringify({ title, body })
  });
}

export async function getThread(threadId: string, token?: string | null) {
  return apiRequest<CommunityThread>(`/community/threads/${threadId}`, { token: token ?? undefined });
}

export async function updateThread(token: string, threadId: string, payload: { title?: string; body?: string }) {
  return apiRequest<CommunityThread>(`/community/threads/${threadId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload)
  });
}

export async function deleteThread(token: string, threadId: string) {
  return apiRequest<void>(`/community/threads/${threadId}`, { method: "DELETE", token });
}

export async function voteThread(token: string, threadId: string, vote: -1 | 0 | 1) {
  return apiRequest<CommunityThread>(`/community/threads/${threadId}/vote`, {
    method: "POST",
    token,
    body: JSON.stringify({ vote })
  });
}

export async function pinThread(token: string, threadId: string) {
  return apiRequest<CommunityThread>(`/community/threads/${threadId}/pin`, { method: "POST", token });
}

export async function unpinThread(token: string, threadId: string) {
  return apiRequest<CommunityThread>(`/community/threads/${threadId}/unpin`, { method: "POST", token });
}

export async function lockThread(token: string, threadId: string) {
  return apiRequest<CommunityThread>(`/community/threads/${threadId}/lock`, { method: "POST", token });
}

export async function unlockThread(token: string, threadId: string) {
  return apiRequest<CommunityThread>(`/community/threads/${threadId}/unlock`, { method: "POST", token });
}

export async function listThreadReplies(threadId: string, token?: string | null) {
  return apiRequest<CommunityReply[]>(`/community/threads/${threadId}/replies`, {
    token: token ?? undefined
  });
}

export async function createThreadReply(
  token: string,
  threadId: string,
  body: string,
  parentId?: string | null
) {
  return apiRequest<CommunityReply>(`/community/threads/${threadId}/replies`, {
    method: "POST",
    token,
    body: JSON.stringify({ body, parent_id: parentId ?? null })
  });
}

export async function updateReply(token: string, replyId: string, body: string) {
  return apiRequest<CommunityReply>(`/community/replies/${replyId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ body })
  });
}

export async function deleteReply(token: string, replyId: string) {
  return apiRequest<void>(`/community/replies/${replyId}`, { method: "DELETE", token });
}

export async function voteReply(token: string, replyId: string, vote: -1 | 0 | 1) {
  return apiRequest<CommunityReply>(`/community/replies/${replyId}/vote`, {
    method: "POST",
    token,
    body: JSON.stringify({ vote })
  });
}

export async function listSharedResources(groupId: string, token?: string | null) {
  return apiRequest<SharedResource[]>(`/community/groups/${groupId}/shared-resources`, {
    token: token ?? undefined
  });
}

export async function shareResource(
  token: string,
  groupId: string,
  payload: {
    resource_type: string;
    resource_id: string;
    title: string;
    description?: string;
    visibility?: string;
  }
) {
  return apiRequest<SharedResource>(`/community/groups/${groupId}/shared-resources`, {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function listModerationReports(token: string, status = "open") {
  return apiRequest<ContentReport[]>(`/moderation/reports?status=${encodeURIComponent(status)}`, { token });
}

export async function createContentReport(
  token: string,
  payload: { target_type: string; target_id: string; reason: string; details?: string }
) {
  return apiRequest<ContentReport>("/moderation/reports", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function resolveContentReport(token: string, reportId: string, notes?: string) {
  return apiRequest<ContentReport>(`/moderation/reports/${reportId}/resolve`, {
    method: "POST",
    token,
    body: JSON.stringify({ status: "resolved", notes })
  });
}

export function resourceHref(resource: SharedResource): string | null {
  switch (resource.resource_type) {
    case "quiz":
      return `/quizzes/${resource.resource_id}/play`;
    case "flashcard_deck":
      return `/flashcards/${resource.resource_id}/study`;
    case "agent":
      return `/agents/${resource.resource_id}`;
    default:
      return null;
  }
}

export async function getCommunityProfile(userId: string, token?: string | null) {
  return apiRequest<CommunityProfile>(`/community/profiles/${userId}`, {
    token: token ?? undefined,
    cache: "no-store"
  });
}

export async function updateCommunityProfile(
  token: string,
  payload: { bio?: string; study_interests?: string[] }
) {
  return apiRequest<CommunityProfile>("/community/profiles/me", {
    method: "PATCH",
    token,
    body: JSON.stringify(payload)
  });
}

export async function listNotifications(token: string, unreadOnly = false) {
  return apiRequest<CommunityNotification[]>(
    `/community/notifications?unread_only=${unreadOnly ? "true" : "false"}`,
    { token, cache: "no-store" }
  );
}

export async function unreadNotificationCount(token: string) {
  return apiRequest<{ unread_count: number }>("/community/notifications/unread-count", {
    token,
    cache: "no-store"
  });
}

export async function markNotificationRead(token: string, notificationId: string) {
  return apiRequest<CommunityNotification>(`/community/notifications/${notificationId}/read`, {
    method: "POST",
    token
  });
}

export async function markAllNotificationsRead(token: string) {
  return apiRequest<{ unread_count: number }>("/community/notifications/read-all", {
    method: "POST",
    token
  });
}
