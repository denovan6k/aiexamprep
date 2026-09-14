"use client";

import { use, Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Settings,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SystemMessage } from "@/components/ui/system-message";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatConversationSkeleton } from "@/components/chat/chat-conversation-skeleton";
import { ChatThinking } from "@/components/chat/chat-thinking";
import { InstitutionIndicator } from "@/components/chat/institution-indicator";
import { PrepwiseChatMessage } from "@/components/chat/prepwise-chat-message";
import { QueueStatus } from "@/components/chat/queue-status";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import type { AgentOption } from "@/components/chat/agent-picker";
import { useAuth } from "@/components/providers/auth-provider";
import type { LlmProvider, LlmSource } from "@/lib/llm";
import type { ApiKeyProvider, UserApiKey } from "@/lib/settings";
import type { QuizGenerationSettings } from "@/lib/study";
import {
  normalizeProfessorAgentId,
  undoLastTurn,
  deleteLastUserPrompt,
  sanitizeThreadTitle,
  type ChatMessage as ApiChatMessage,
  type ChatThread,
} from "@/lib/chat";
import { showError, showSuccess } from "@/lib/toast";
import { shouldApplyServerMessages } from "@/lib/chat-message-sync";
import { asRoute, cn } from "@/lib/utils";
import {
  getMessageMetadata,
  getMessageText,
  uiMessagesFromHistory,
  type PrepwiseSendBody,
  type PrepwiseUIMessage,
} from "@/lib/chat-ui-message";
import { createPrepwiseChatTransport } from "@/lib/prepwise-chat-transport";
import { getMaterialStatus } from "@/lib/materials";
import { getJob, pollJobUntilComplete, type GenerationJob } from "@/lib/jobs";
import { noteAssistantReply, shouldPromptForFeedback } from "@/lib/chat-feedback";
import {
  useChatAgentsQuery,
  useChatMessagesQuery,
  useChatProjectQuery,
  useChatThreadsQuery,
  useCreateThreadMutation,
  useDeleteProjectMutation,
  useInvalidateChatMessages,
  useUpdateProjectMutation,
  useUpdateThreadAgentMutation,
  useUpdateThreadLlmSourceMutation,
} from "@/hooks/use-chat";
import { usePlanQuota } from "@/hooks/use-billing";
import { useApiKeysQuery } from "@/hooks/use-settings";
import { useAuthToken } from "@/hooks/use-auth-token";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_THREADS: ChatThread[] = [];
const EMPTY_MESSAGES: ApiChatMessage[] = [];
const EMPTY_AGENT_OPTIONS: AgentOption[] = [];
const EMPTY_API_KEYS: UserApiKey[] = [];

type PageProps = {
  params: Promise<{ projectId: string }>;
};

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// RecentChats — paginated recents list (10 per page)
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

function RecentChats({ threads }: { threads: ChatThread[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(threads.length / PAGE_SIZE);
  const visibleThreads = threads.slice(0, page * PAGE_SIZE);
  const hasMore = page < totalPages;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6">
      <p className="mb-1 mt-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
        Recents
      </p>
      {visibleThreads.map((thread) => (
        <Link
          key={thread.id}
          href={`/chat/${thread.id}`}
          className={cn(
            "group flex items-center justify-between gap-4",
            "border-b border-border/20 py-2.5 last:border-0",
            "text-sm text-foreground transition-colors hover:text-primary"
          )}
        >
          <span className="min-w-0 truncate font-medium group-hover:underline">
            {sanitizeThreadTitle(thread.title, 80)}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {relativeTime(thread.updated_at)}
          </span>
        </Link>
      ))}
      {threads.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {visibleThreads.length} of {threads.length}
          </span>
          <div className="flex items-center gap-2">
            {hasMore ? (
              <button
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 rounded px-2 py-1 hover:bg-sidebar-accent/60 hover:text-foreground transition-colors"
              >
                Show more
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setPage(1)}
                className="flex items-center gap-1 rounded px-2 py-1 hover:bg-sidebar-accent/60 hover:text-foreground transition-colors"
              >
                Show less
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = use(params);
  const router = useRouter();

  const { data: project, isLoading: projectLoading, error: projectError } =
    useChatProjectQuery(projectId);
  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

  function handleToggleArchive() {
    if (!project) return;
    updateProjectMutation.mutate(
      { projectId: project.id, input: { archived: !project.archived } },
      {
        onSuccess: () => {
          showSuccess(!project.archived ? "Project archived." : "Project unarchived.");
          if (!project.archived) router.push("/projects");
        },
        onError: (err) => showError(err, "Failed to update project."),
      }
    );
  }

  function handleDeleteProject() {
    if (!project) return;
    if (!confirm("Delete this project? Chats will be unassigned, not deleted.")) return;
    deleteProjectMutation.mutate(project.id, {
      onSuccess: () => {
        showSuccess("Project deleted.");
        router.push("/projects");
      },
      onError: (err) => showError(err, "Failed to delete project."),
    });
  }

  if (projectLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading project...
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 py-12 px-4">
        <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">
          ← Projects
        </Link>
        <SystemMessage variant="action" fill>
          Project not found or accessible.
        </SystemMessage>
      </div>
    );
  }

  return (
    <Suspense fallback={<ChatConversationSkeleton showComposer className="h-full" />}>
      <ProjectChatView
        projectId={projectId}
        projectName={project.name}
        projectArchived={project.archived}
        onToggleArchive={handleToggleArchive}
        onDelete={handleDeleteProject}
      />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// ProjectChatView — full chat experience scoped to a project
// ---------------------------------------------------------------------------

type ProjectChatViewProps = {
  projectId: string;
  projectName: string;
  projectArchived: boolean;
  onToggleArchive: () => void;
  onDelete: () => void;
};

function ProjectChatView({
  projectId,
  projectName,
  projectArchived,
  onToggleArchive,
  onDelete,
}: ProjectChatViewProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const invalidateMessages = useInvalidateChatMessages();

  const [composerDraft, setComposerDraft] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeJob, setActiveJob] = useState<GenerationJob | null>(null);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [redoPrompt, setRedoPrompt] = useState<string | null>(null);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [liveThreadId, setLiveThreadId] = useState<string | null>(null);

  const checkpointsRef = useRef<{ messages: PrepwiseUIMessage[]; lastUserPrompt: string }[]>([]);
  const pollAbortRef = useRef(0);
  const pollControllerRef = useRef<AbortController | null>(null);
  const resumedJobsRef = useRef<Set<string>>(new Set());
  const threadIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(token);

  useEffect(() => { tokenRef.current = token; }, [token]);

  const transport = useMemo(
    () =>
      createPrepwiseChatTransport({
        getToken: () => tokenRef.current,
        getThreadId: () => threadIdRef.current,
      }),
    []
  );

  const { messages, setMessages, sendMessage, status, error: chatError } =
    useChat<PrepwiseUIMessage>({
      id: `project-${projectId}`,
      transport,
      onData: (dataPart) => {
        if (dataPart.type === "data-generation") {
          const jobId = dataPart.data.job_id;
          const threadId = threadIdRef.current;
          if (jobId && threadId && dataPart.data.event === "generation_queued") {
            void startJobPollingRef.current?.(jobId, threadId);
          }
        }
        if (dataPart.type === "data-thread-title") {
          const title = dataPart.data.title?.trim();
          const threadId = threadIdRef.current;
          if (!title || !threadId) return;
          queryClient.setQueriesData<ChatThread[]>(
            { queryKey: [...queryKeys.chat.all, "threads"] },
            (existing) => {
              if (!existing) return existing;
              return existing.map((t) =>
                t.id === threadId ? { ...t, title, updated_at: new Date().toISOString() } : t
              );
            }
          );
        }
      },
      onFinish: ({ message }) => {
        const threadId = threadIdRef.current;
        if (threadId) {
          void invalidateMessages(threadId);
          void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
        }
        noteAssistantReply();
        if (shouldPromptForFeedback()) setFeedbackMessageId(message.id);
        setUndoAvailable(true);
      },
      onError: (err) => {
        showError(err.message || "Failed to send message");
        const threadId = threadIdRef.current;
        if (threadId) {
          void invalidateMessages(threadId).then((fresh) => {
            setMessages(uiMessagesFromHistory(fresh));
            setUndoAvailable(fresh.some((m) => m.role === "user"));
          });
          void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
        }
      },
    });

  const isStreaming = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1) ?? null;
  const lastMessageText = lastMessage ? getMessageText(lastMessage) : "";
  const pendingAssistantHasOutput =
    lastMessage?.role === "assistant" &&
    (Boolean(lastMessageText.trim()) ||
      lastMessage.parts.some(
        (p) => p.type === "reasoning" && "text" in p && Boolean((p as { text?: string }).text?.trim())
      ));
  const showChatThinking = !isGenerating && (isSending || (isStreaming && lastMessage?.role === "user"));
  const showPendingInlineThinking = isStreaming && lastMessage?.role === "assistant" && !pendingAssistantHasOutput;

  const { data: threads = EMPTY_THREADS } = useChatThreadsQuery({ includeArchived: false });
  const targetThreadId = liveThreadId;
  const { data: serverMessages = EMPTY_MESSAGES, isLoading: isLoadingMessages } =
    useChatMessagesQuery(targetThreadId);
  const { data: chatAgents } = useChatAgentsQuery();
  const { data: apiKeys = EMPTY_API_KEYS } = useApiKeysQuery();
  const { usageStats, chatCompletionBlockedReason, uploadBlockedReason } = usePlanQuota();
  const updateThreadAgentMutation = useUpdateThreadAgentMutation();
  const updateThreadLlmSourceMutation = useUpdateThreadLlmSourceMutation();
  const createThread = useCreateThreadMutation();

  const agents: AgentOption[] = useMemo(
    () =>
      (chatAgents ?? EMPTY_AGENT_OPTIONS).map((a) => ({
        id: a.id,
        name: a.name,
        subject_area: a.subject_area,
        avatar_url: a.avatar_url,
      })),
    [chatAgents]
  );

  const activeThread = useMemo(
    () => threads.find((t) => t.id === targetThreadId) ?? null,
    [targetThreadId, threads]
  );

  // Recent threads for this project, sorted newest first
  const projectThreads = useMemo(
    () =>
      threads
        .filter((t) => t.project_id === projectId)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [threads, projectId]
  );

  const startJobPolling = useCallback(
    async (jobId: string, threadId: string, options?: { resumed?: boolean }) => {
      if (!token) return;
      const pollId = ++pollAbortRef.current;
      pollControllerRef.current?.abort();
      const controller = new AbortController();
      pollControllerRef.current = controller;
      setIsGenerating(true);
      setActiveJob(null);
      let keepFailureVisible = false;
      try {
        const initial = await getJob(token, jobId);
        if (pollId !== pollAbortRef.current) return;
        if (options?.resumed && (initial.status === "completed" || initial.status === "failed")) return;
        setActiveJob(initial);
        const finalJob = await pollJobUntilComplete(token, jobId, {
          signal: controller.signal,
          onUpdate: (job) => { if (pollId === pollAbortRef.current) setActiveJob(job); },
        });
        if (pollId !== pollAbortRef.current) return;
        setActiveJob(finalJob);
        keepFailureVisible = finalJob.status === "failed";
        if (finalJob.status === "completed" || finalJob.status === "failed") {
          const fresh = await invalidateMessages(threadId);
          if (pollId !== pollAbortRef.current) return;
          setMessages(uiMessagesFromHistory(fresh));
          setUndoAvailable(fresh.some((m) => m.role === "user"));
        }
      } catch (err) {
        if (pollId === pollAbortRef.current) {
          showError(err, "Failed to track generation job");
          try {
            const fresh = await invalidateMessages(threadId);
            if (pollId === pollAbortRef.current) {
              setMessages(uiMessagesFromHistory(fresh));
              setUndoAvailable(fresh.some((m) => m.role === "user"));
            }
          } catch { /* ignore */ }
        }
      } finally {
        if (pollId === pollAbortRef.current) {
          setIsGenerating(false);
          if (!keepFailureVisible) setActiveJob(null);
        }
      }
    },
    [invalidateMessages, setMessages, token]
  );

  const startJobPollingRef = useRef(startJobPolling);
  useEffect(() => { startJobPollingRef.current = startJobPolling; }, [startJobPolling]);

  useEffect(() => {
    if (chatError) showError(chatError.message || "Failed to send message");
  }, [chatError]);

  useEffect(() => {
    if (!targetThreadId || isLoadingMessages || isStreaming) return;
    if (!shouldApplyServerMessages({ isStreaming, status, localMessages: messages, serverMessages: serverMessages as ApiChatMessage[] })) return;
    setMessages(uiMessagesFromHistory(serverMessages as ApiChatMessage[]));
    setUndoAvailable(serverMessages.some((m) => m.role === "user"));
  }, [isLoadingMessages, isStreaming, messages.length, serverMessages, setMessages, status, targetThreadId]);

  const selectedAgentId = normalizeProfessorAgentId(activeThread?.professor_agent_id);
  const { llmSource, llmProvider } = useMemo(() => {
    const validProviders = apiKeys.filter((k) => k.is_valid).map((k) => k.provider);
    let source: LlmSource = activeThread?.llm_source ?? "platform";
    let provider: LlmProvider | null = activeThread?.llm_provider ?? null;
    if (source === "byok") {
      if (validProviders.length === 0) { source = "platform"; provider = null; }
      else if (!provider || !validProviders.includes(provider as ApiKeyProvider)) provider = validProviders[0] ?? null;
    }
    return { llmSource: source, llmProvider: provider };
  }, [activeThread, apiKeys]);

  useEffect(() => {
    const threadId = targetThreadId;
    if (!threadId || isGenerating) return;
    const queued = messages.find((m) => {
      const meta = getMessageMetadata(m);
      return meta?.event === "generation_queued" && meta.job_id;
    });
    const jobId = queued ? getMessageMetadata(queued)?.job_id : undefined;
    if (!jobId || resumedJobsRef.current.has(jobId)) return;
    resumedJobsRef.current.add(jobId);
    void startJobPolling(jobId, threadIdRef.current ?? threadId, { resumed: true });
  }, [targetThreadId, isGenerating, messages, startJobPolling]);

  useEffect(() => {
    return () => {
      pollAbortRef.current += 1;
      pollControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!token || !targetThreadId || isLoadingMessages) return;
    const processingIds = messages.flatMap((m) => {
      const meta = getMessageMetadata(m);
      const mat = meta?.material as { id?: string; status?: string } | undefined;
      if ((meta?.event === "material_processing" || meta?.event === "material_attached") && mat?.id && mat.status === "processing") return [mat.id];
      return [];
    });
    if (!processingIds.length) return;
    let cancelled = false;
    const poll = async () => {
      for (const materialId of processingIds) {
        try {
          const st = await getMaterialStatus(token, materialId);
          if (st.status === "processing") continue;
          if (!cancelled) {
            const fresh = await invalidateMessages(targetThreadId);
            setMessages(uiMessagesFromHistory(fresh));
          }
          return;
        } catch { /* ignore */ }
      }
    };
    const interval = window.setInterval(() => { void poll(); }, 2000);
    void poll();
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [targetThreadId, invalidateMessages, isLoadingMessages, messages, setMessages, token]);

  const handleAgentChange = useCallback(
    (agentId: string | null) => {
      const normalizedAgentId = normalizeProfessorAgentId(agentId);
      if (!token || !targetThreadId) return;
      updateThreadAgentMutation.mutate(
        { threadId: targetThreadId, agentId: normalizedAgentId },
        { onError: (err) => showError(err, "Failed to update agent") }
      );
    },
    [targetThreadId, token, updateThreadAgentMutation]
  );

  const handleLlmSourceChange = useCallback(
    (source: LlmSource, provider?: LlmProvider | null) => {
      if (!token || !targetThreadId) return;
      updateThreadLlmSourceMutation.mutate(
        { threadId: targetThreadId, source, provider: provider ?? null },
        { onError: (err) => showError(err, "Failed to update model source") }
      );
    },
    [targetThreadId, token, updateThreadLlmSourceMutation]
  );

  const ensureThreadId = useCallback(async () => {
    if (threadIdRef.current) return threadIdRef.current;
    const thread = await createThread.mutateAsync({ project_id: projectId });
    threadIdRef.current = thread.id;
    setLiveThreadId(thread.id);
    window.history.replaceState(null, "", asRoute(`/chat/${thread.id}`));
    return thread.id;
  }, [createThread, projectId]);

  const currentThreadId = useCallback(() => threadIdRef.current, []);

  async function handleSend(
    content: string,
    generationSettings?: QuizGenerationSettings,
    model?: string,
    files?: File[],
    options?: {
      supportsReasoning?: boolean;
      mediaAttachmentIds?: string[];
      artifactType?: string;
      llmProvider?: LlmProvider | null;
    }
  ) {
    if (!token) return;
    try {
      setIsSending(true);
      const threadId = await ensureThreadId();
      checkpointsRef.current = [{ messages, lastUserPrompt: content }];
      setRedoPrompt(null);
      setUndoAvailable(false);
      setFeedbackMessageId(null);
      const body: PrepwiseSendBody = {
        model: model ?? null,
        llmProvider: options?.llmProvider ?? llmProvider ?? null,
        professorAgentId: normalizeProfessorAgentId(selectedAgentId),
        generationSettings: generationSettings ?? null,
        files,
        mediaAttachmentIds: options?.mediaAttachmentIds ?? [],
        artifactType: options?.artifactType ?? null,
      };
      await sendMessage({ text: content }, { body });
    } catch (err) {
      showError(err, "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  function handleArtifactChoice(artifactType: string) {
    void handleSend("Build the selected study material from my attachments.", undefined, undefined, undefined, { artifactType });
  }

  async function handleUndo() {
    if (!token) return;
    const threadId = currentThreadId();
    if (!threadId) return;
    let userIndex = messages.length - 1;
    while (userIndex >= 0 && messages[userIndex].role !== "user") userIndex--;
    if (userIndex < 0) return;
    const prompt = getMessageText(messages[userIndex]);
    checkpointsRef.current = [{ messages, lastUserPrompt: prompt }];
    setMessages(messages.slice(0, userIndex));
    setComposerDraft(prompt);
    setRedoPrompt(prompt);
    setUndoAvailable(false);
    try {
      await undoLastTurn(token, threadId);
      await deleteLastUserPrompt(token, threadId);
      await invalidateMessages(threadId);
    } catch (err) { showError(err, "Failed to undo"); }
  }

  function handleRedo(assistantMessageId?: string) {
    if (!token) return;
    const threadId = currentThreadId();
    if (redoPrompt) {
      const prompt = redoPrompt;
      setRedoPrompt(null);
      setComposerDraft(null);
      void handleSend(prompt);
      return;
    }
    let userIndex = messages.length - 1;
    while (userIndex >= 0 && messages[userIndex].role !== "user") userIndex--;
    if (userIndex >= 0 && threadId) {
      const regeneratePrompt = getMessageText(messages[userIndex]);
      setUndoAvailable(false);
      setMessages(messages.slice(0, userIndex));
      setComposerDraft(null);
      void (async () => {
        try { await undoLastTurn(token, threadId); await deleteLastUserPrompt(token, threadId); } catch { /* ignore */ }
        void handleSend(regeneratePrompt);
      })();
      return;
    }
    if (assistantMessageId) handleRetry(assistantMessageId);
  }

  function handleRetry(messageId: string) {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index < 0) return;
    let userIndex = index;
    while (userIndex >= 0 && messages[userIndex].role !== "user") userIndex--;
    if (userIndex < 0) return;
    const prompt = getMessageText(messages[userIndex]);
    setMessages(messages.slice(0, userIndex));
    void handleSend(prompt);
  }

  const latestUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return messages[i].id;
    return null;
  }, [messages]);

  const latestAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return messages[i].id;
    return null;
  }, [messages]);

  const activeJobAnchorId = useMemo(() => {
    if (!activeJob) return null;
    const owner = messages.find((m) => getMessageMetadata(m)?.job_id === activeJob.id);
    return owner?.id ?? null;
  }, [activeJob, messages]);

  const canUndoLatest = undoAvailable && Boolean(latestUserMessageId);
  const canRedoLatest = Boolean(redoPrompt) || canUndoLatest;
  const isConversationLoading = isAuthLoading || (isLoadingMessages && messages.length === 0);
  const isEmptyState = messages.length === 0 && !isStreaming;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      {/* ── Top-right actions — absolute within this relative container ── */}
      <div className="absolute right-3 top-3 z-20 sm:right-5 sm:top-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link href={`/projects/${projectId}/settings`}>
                <Settings className="mr-2 h-4 w-4" />
                Project settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleArchive}>
              {projectArchived ? (
                <><ArchiveRestore className="mr-2 h-4 w-4" />Unarchive project</>
              ) : (
                <><Archive className="mr-2 h-4 w-4" />Archive project</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Middle: conversation or empty state — fills available space ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isConversationLoading ? (
          <ChatConversationSkeleton />
        ) : !isEmptyState ? (
          /* ── Active conversation ── */
          <Conversation className="relative h-full">
            <ConversationContent className="mx-auto w-full max-w-3xl">
              {messages.map((message) => {
                const isLatestUser = message.id === latestUserMessageId;
                const isLatestAssistant = message.id === latestAssistantMessageId;
                const streamingThis = isStreaming && isLatestAssistant && message.role === "assistant";
                return (
                  <Fragment key={message.id}>
                    <PrepwiseChatMessage
                      message={message}
                      isStreaming={streamingThis}
                      showInlineThinking={streamingThis && showPendingInlineThinking}
                      animateOnMount={false}
                      showFeedback={message.id === feedbackMessageId}
                      onRetry={handleRetry}
                      onUndo={() => void handleUndo()}
                      onRedo={() => handleRedo(message.role === "assistant" ? message.id : undefined)}
                      canUndo={isLatestUser && canUndoLatest}
                      canRedo={(isLatestUser || isLatestAssistant) && canRedoLatest}
                      showActions={message.role === "user" || isLatestAssistant}
                      onArtifactChoice={handleArtifactChoice}
                      artifactChoiceDisabled={isStreaming || isGenerating || isSending}
                    />
                    {message.id === activeJobAnchorId ? (
                      <QueueStatus job={activeJob} onDismiss={() => setActiveJob(null)} />
                    ) : null}
                  </Fragment>
                );
              })}
              {!activeJobAnchorId && (isGenerating || activeJob?.status === "failed") ? (
                <QueueStatus job={activeJob} onDismiss={() => setActiveJob(null)} />
              ) : null}
              {showChatThinking ? <ChatThinking /> : null}
            </ConversationContent>
            <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
              <ConversationScrollButton className="shadow-md" />
            </div>
          </Conversation>
        ) : (
          /* ── Empty state: title + composer + recents, all in one scrollable column ── */
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-10">
              {/* Breadcrumb */}
              <div className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Link href="/projects" className="hover:text-foreground transition-colors">
                  Projects
                </Link>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-foreground font-medium">{projectName}</span>
              </div>

              {/* Big title */}
              <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                {projectName}
              </h1>
            </div>

            {/* Recents — directly below the composer */}
            <div className="shrink-0">
              <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
                <InstitutionIndicator institution={user?.institution ?? null} className="mb-2" />
              </div>
              <ChatComposer
                onSend={(msg, settings, model, files, opts) =>
                  void handleSend(msg, settings, model, files, opts)
                }
                agents={agents}
                selectedAgentId={selectedAgentId}
                onAgentChange={handleAgentChange}
                agentPickerDisabled={isStreaming || isGenerating || isConversationLoading || isSending}
                llmSource={llmSource}
                llmProvider={llmProvider}
                apiKeys={apiKeys}
                onLlmSourceChange={handleLlmSourceChange}
                modelPickerDisabled={isStreaming || isGenerating || isConversationLoading || isSending}
                disabled={isStreaming || isGenerating || isConversationLoading || isSending}
                uploadBlockedReason={uploadBlockedReason}
                chatCompletionBlockedReason={chatCompletionBlockedReason}
                usageStats={usageStats}
                draftMessage={composerDraft}
                onDraftMessageConsumed={() => setComposerDraft(null)}
                className="shrink-0"
              />
            </div>

            {/* Recents — directly below the composer */}
            {projectThreads.length > 0 && (
              <RecentChats threads={projectThreads} />
            )}
          </div>
        )}
      </div>

      {/* ── Composer for active conversation (pinned to bottom) ── */}
      {!isEmptyState && (
        <div className="shrink-0">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
            <InstitutionIndicator institution={user?.institution ?? null} className="mb-2 mt-2" />
          </div>
          <ChatComposer
            onSend={(msg, settings, model, files, opts) =>
              void handleSend(msg, settings, model, files, opts)
            }
            agents={agents}
            selectedAgentId={selectedAgentId}
            onAgentChange={handleAgentChange}
            agentPickerDisabled={isStreaming || isGenerating || isConversationLoading || isSending}
            llmSource={llmSource}
            llmProvider={llmProvider}
            apiKeys={apiKeys}
            onLlmSourceChange={handleLlmSourceChange}
            modelPickerDisabled={isStreaming || isGenerating || isConversationLoading || isSending}
            disabled={isStreaming || isGenerating || isConversationLoading || isSending}
            uploadBlockedReason={uploadBlockedReason}
            chatCompletionBlockedReason={chatCompletionBlockedReason}
            usageStats={usageStats}
            draftMessage={composerDraft}
            onDraftMessageConsumed={() => setComposerDraft(null)}
            className="shrink-0"
          />
        </div>
      )}
    </div>
  );
}
