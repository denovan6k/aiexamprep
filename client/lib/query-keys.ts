/**
 * Centralized React Query key factory.
 * 
 * Provides type-safe, consistent query keys for all API endpoints.
 * Follows hierarchical structure: [resource, operation, ...params]
 * 
 * Benefits:
 * - Single source of truth for cache keys
 * - Type-safe invalidation and prefetching
 * - Hierarchical invalidation (e.g., invalidate all thread queries)
 * - Self-documenting API surface
 * 
 * Usage:
 * ```ts
 * // In a component
 * const { data } = useQuery({
 *   queryKey: queryKeys.chat.thread(threadId),
 *   queryFn: () => getThread(token, threadId)
 * });
 * 
 * // Invalidate specific thread
 * queryClient.invalidateQueries({ queryKey: queryKeys.chat.thread(threadId) });
 * 
 * // Invalidate all threads
 * queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
 * 
 * // Invalidate everything chat-related
 * queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
 * ```
 */

export const queryKeys = {
  /**
   * Authentication and user session queries
   */
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
    session: () => [...queryKeys.auth.all, "session"] as const,
  },

  /**
   * Chat thread and message queries
   */
  chat: {
    all: ["chat"] as const,
    threads: (includeArchived = true) =>
      [...queryKeys.chat.all, "threads", { includeArchived }] as const,
    thread: (threadId: string) => [...queryKeys.chat.all, "threads", threadId] as const,
    messages: (threadId: string) => [...queryKeys.chat.thread(threadId), "messages"] as const,
    agents: () => [...queryKeys.chat.all, "agents"] as const,
    agent: (agentId: string) => [...queryKeys.chat.agents(), agentId] as const,
    context: (threadId: string) => [...queryKeys.chat.thread(threadId), "context"] as const,
    projects: (includeArchived = false) =>
      [...queryKeys.chat.all, "projects", { includeArchived }] as const,
    project: (projectId: string) => [...queryKeys.chat.all, "projects", projectId] as const,
  },

  /**
   * Professor agent queries
   */
  agents: {
    all: ["agents"] as const,
    list: () => [...queryKeys.agents.all, "list"] as const,
    agent: (agentId: string) => [...queryKeys.agents.all, agentId] as const,
  },

  /**
   * Course queries
   */
  courses: {
    all: ["courses"] as const,
    list: () => [...queryKeys.courses.all, "list"] as const,
    course: (courseId: string) => [...queryKeys.courses.all, courseId] as const,
    workspace: (courseId: string) => [...queryKeys.courses.course(courseId), "workspace"] as const,
    materials: (courseId: string) => [...queryKeys.courses.course(courseId), "materials"] as const,
  },

  onboarding: {
    all: ["onboarding"] as const,
    state: () => [...queryKeys.onboarding.all, "state"] as const,
  },

  study: {
    all: ["study"] as const,
    today: () => [...queryKeys.study.all, "today"] as const,
    feed: () => [...queryKeys.study.all, "feed"] as const,
  },

  analytics: {
    all: ["analytics"] as const,
    events: () => [...queryKeys.analytics.all, "events"] as const,
  },

  /**
   * Material queries
   */
  materials: {
    all: ["materials"] as const,
    list: () => [...queryKeys.materials.all, "list"] as const,
    material: (materialId: string) => [...queryKeys.materials.all, materialId] as const,
    status: (materialId: string) => [...queryKeys.materials.material(materialId), "status"] as const,
    chunks: (materialId: string) => [...queryKeys.materials.material(materialId), "chunks"] as const,
    chat: {
      sessions: (materialId: string) => [...queryKeys.materials.material(materialId), "chat", "sessions"] as const,
      session: (materialId: string, sessionId: string) => 
        [...queryKeys.materials.material(materialId), "chat", "sessions", sessionId] as const,
      messages: (materialId: string, sessionId: string) => 
        [...queryKeys.materials.chat.session(materialId, sessionId), "messages"] as const,
    },
  },

  /**
   * CV tailoring queries
   */
  cv: {
    all: ["cv"] as const,
    documents: () => [...queryKeys.cv.all, "documents"] as const,
    document: (documentId: string) => [...queryKeys.cv.documents(), documentId] as const,
    tailorings: () => [...queryKeys.cv.all, "tailorings"] as const,
    tailoring: (tailoringId: string) => [...queryKeys.cv.tailorings(), tailoringId] as const,
  },

  /**
   * Quiz queries
   */
  quizzes: {
    all: ["quizzes"] as const,
    list: () => [...queryKeys.quizzes.all, "list"] as const,
    quiz: (quizId: string) => [...queryKeys.quizzes.all, quizId] as const,
    editor: (quizId: string) => [...queryKeys.quizzes.quiz(quizId), "editor"] as const,
    questions: (quizId: string) => [...queryKeys.quizzes.quiz(quizId), "questions"] as const,
    attempts: (quizId: string) => [...queryKeys.quizzes.quiz(quizId), "attempts"] as const,
    attempt: (attemptId: string) => [...queryKeys.quizzes.all, "attempts", attemptId] as const,
    remediation: (attemptId: string) =>
      [...queryKeys.quizzes.attempt(attemptId), "remediation"] as const,
  },

  /**
   * Flashcard queries
   */
  flashcards: {
    all: ["flashcards"] as const,
    decks: () => [...queryKeys.flashcards.all, "decks"] as const,
    deck: (deckId: string) => [...queryKeys.flashcards.decks(), deckId] as const,
    cards: (deckId: string) => [...queryKeys.flashcards.deck(deckId), "cards"] as const,
    studySession: (deckId: string) => [...queryKeys.flashcards.deck(deckId), "study-session"] as const,
  },

  /**
   * Study artifact queries
   */
  studyArtifacts: {
    all: ["study-artifacts"] as const,
    artifact: (artifactId: string) => [...queryKeys.studyArtifacts.all, artifactId] as const,
  },

  /**
   * Generation job queries
   */
  jobs: {
    all: ["jobs"] as const,
    job: (jobId: string) => [...queryKeys.jobs.all, jobId] as const,
    byThread: (threadId: string) => [...queryKeys.jobs.all, "thread", threadId] as const,
  },

  /**
   * Search queries
   */
  search: {
    all: ["search"] as const,
    results: (query: string, filters?: Record<string, unknown>) => 
      [...queryKeys.search.all, "results", query, filters] as const,
    ask: (query: string) => [...queryKeys.search.all, "ask", query] as const,
  },

  /**
   * Settings queries
   */
  settings: {
    all: ["settings"] as const,
    aiModels: () => [...queryKeys.settings.all, "ai-models"] as const,
    apiKeys: () => [...queryKeys.settings.all, "api-keys"] as const,
    apiKey: (keyId: string) => [...queryKeys.settings.apiKeys(), keyId] as const,
    generationProfiles: () => [...queryKeys.settings.all, "generation-profiles"] as const,
    generationProfile: (profileId: string) => 
      [...queryKeys.settings.generationProfiles(), profileId] as const,
    modelDefaults: () => [...queryKeys.settings.all, "model-defaults"] as const,
    billing: () => [...queryKeys.settings.all, "billing"] as const,
    subscription: () => [...queryKeys.settings.billing(), "subscription"] as const,
    usage: () => [...queryKeys.settings.billing(), "usage"] as const,
    usageHistory: (days = 30) => [...queryKeys.settings.billing(), "usage-history", days] as const,
  },

  /**
   * Institution queries
   */
  institutions: {
    all: ["institutions"] as const,
    list: () => [...queryKeys.institutions.all, "list"] as const,
    institution: (institutionId: string) => [...queryKeys.institutions.all, institutionId] as const,
  },

  /**
   * Community queries
   */
  community: {
    all: ["community"] as const,
    posts: (filters?: Record<string, unknown>) => 
      [...queryKeys.community.all, "posts", filters] as const,
    post: (postId: string) => [...queryKeys.community.all, "posts", postId] as const,
    sharedResources: () => [...queryKeys.community.all, "shared-resources"] as const,
  },

  /**
   * Blog queries
   */
  blog: {
    all: ["blog"] as const,
    posts: (filters?: Record<string, unknown>) => 
      [...queryKeys.blog.all, "posts", filters] as const,
    post: (slug: string) => [...queryKeys.blog.all, "posts", slug] as const,
  },

  notifications: {
    all: ["notifications"] as const,
    list: (limit = 30) => [...queryKeys.notifications.all, "list", limit] as const,
    unreadCount: () => [...queryKeys.notifications.all, "unread-count"] as const,
    preferences: () => [...queryKeys.notifications.all, "preferences"] as const,
  },

  admin: {
    all: ["admin"] as const,
    analytics: {
      all: ["admin", "analytics"] as const,
      overview: () => [...queryKeys.admin.analytics.all, "overview"] as const,
      growth: (days: number) => [...queryKeys.admin.analytics.all, "growth", days] as const,
      revenue: () => [...queryKeys.admin.analytics.all, "revenue"] as const,
      usage: () => [...queryKeys.admin.analytics.all, "usage"] as const,
    },
    users: {
      all: ["admin", "users"] as const,
      list: (params?: Record<string, unknown>) => [...queryKeys.admin.users.all, "list", params] as const,
      detail: (userId: string) => [...queryKeys.admin.users.all, userId] as const,
      usage: (userId: string) => [...queryKeys.admin.users.detail(userId), "usage"] as const,
      chatThreads: (userId: string, params?: Record<string, unknown>) =>
        [...queryKeys.admin.users.detail(userId), "chat-threads", params] as const,
      chatMessages: (userId: string, threadId: string, params?: Record<string, unknown>) =>
        [...queryKeys.admin.users.chatThreads(userId), threadId, "messages", params] as const,
    },
    subscriptions: {
      all: ["admin", "subscriptions"] as const,
      list: (params?: Record<string, unknown>) =>
        [...queryKeys.admin.subscriptions.all, "list", params] as const,
    },
    moderation: {
      all: ["admin", "moderation"] as const,
      reports: (params?: Record<string, unknown>) =>
        [...queryKeys.admin.moderation.all, "reports", params] as const,
      appeals: (params?: Record<string, unknown>) =>
        [...queryKeys.admin.moderation.all, "appeals", params] as const,
    },
    support: {
      all: ["admin", "support"] as const,
      tickets: (params?: Record<string, unknown>) =>
        [...queryKeys.admin.support.all, "tickets", params] as const,
    },
    marketing: {
      all: ["admin", "marketing"] as const,
      templates: () => [...queryKeys.admin.marketing.all, "templates"] as const,
      campaigns: () => [...queryKeys.admin.marketing.all, "campaigns"] as const,
    },
  },

  support: {
    all: ["support"] as const,
    tickets: (params?: Record<string, unknown>) => [...queryKeys.support.all, "tickets", params] as const,
    appeals: () => [...queryKeys.support.all, "appeals"] as const,
  },
} as const;

/**
 * Type helper to extract query key types.
 * Example usage with queryClient operations.
 */
export type QueryKeyType = readonly unknown[];

/**
 * Utility to check if a query key matches a pattern.
 * Useful for selective cache invalidation.
 * 
 * @example
 * if (matchesQueryKey(key, queryKeys.chat.all)) {
 *   // This is a chat-related key
 * }
 */
export function matchesQueryKey(key: readonly unknown[], pattern: readonly unknown[]): boolean {
  if (pattern.length > key.length) return false;
  return pattern.every((part, index) => part === key[index]);
}
