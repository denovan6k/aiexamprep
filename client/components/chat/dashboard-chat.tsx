"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton
} from "@/components/ai-elements/conversation";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatEmptyState } from "@/components/chat/chat-empty-state";
import { ChatConversationSkeleton } from "@/components/chat/chat-conversation-skeleton";
import { ChatThinking } from "@/components/chat/chat-thinking";
import { InstitutionIndicator } from "@/components/chat/institution-indicator";
import { PrepwiseChatMessage } from "@/components/chat/prepwise-chat-message";
import { QueueStatus } from "@/components/chat/queue-status";
import type { AgentOption } from "@/components/chat/agent-picker";
import { useAuth } from "@/components/providers/auth-provider";
import type { LlmProvider, LlmSource } from "@/lib/llm";
import type { ApiKeyProvider, UserApiKey } from "@/lib/settings";
import type { QuizGenerationSettings } from "@/lib/study";
import {
  normalizeProfessorAgentId,
  undoLastTurn,
  deleteLastUserPrompt,
  type ChatMessage as ApiChatMessage,
  type ChatThread
} from "@/lib/chat";
import { showError } from "@/lib/toast";
import { shouldApplyServerMessages } from "@/lib/chat-message-sync";
import { asRoute } from "@/lib/utils";
import {
  getMessageMetadata,
  getMessageText,
  uiMessagesFromHistory,
  type PrepwiseSendBody,
  type PrepwiseUIMessage
} from "@/lib/chat-ui-message";
import { createPrepwiseChatTransport } from "@/lib/prepwise-chat-transport";
import { getMaterialStatus } from "@/lib/materials";
import { getJob, pollJobUntilComplete, type GenerationJob } from "@/lib/jobs";
import { noteAssistantReply, shouldPromptForFeedback } from "@/lib/chat-feedback";
import {
  useChatAgentsQuery,
  useChatMessagesQuery,
  useChatThreadsQuery,
  useCreateThreadMutation,
  useInvalidateChatMessages,
  useUpdateThreadAgentMutation,
  useUpdateThreadLlmSourceMutation
} from "@/hooks/use-chat";
import { usePlanQuota } from "@/hooks/use-billing";
import { useApiKeysQuery } from "@/hooks/use-settings";
import { useAuthToken } from "@/hooks/use-auth-token";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

const EMPTY_THREADS: ChatThread[] = [];
const EMPTY_MESSAGES: ApiChatMessage[] = [];
const EMPTY_AGENT_OPTIONS: AgentOption[] = [];
const EMPTY_API_KEYS: UserApiKey[] = [];

type DashboardChatProps = {
  initialThreadId?: string;
  projectId?: string;
};

type ChatCheckpoint = {
  messages: PrepwiseUIMessage[];
  lastUserPrompt: string;
};

function findLastUserMessageIndex(messages: PrepwiseUIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return index;
  }
  return -1;
}

export function DashboardChat({ initialThreadId, projectId }: DashboardChatProps) {
  return (
    <Suspense fallback={<ChatConversationSkeleton showComposer className="h-full" />}>
      <DashboardChatInner initialThreadId={initialThreadId} projectId={projectId} />
    </Suspense>
  );
}

function DashboardChatInner({ initialThreadId, projectId }: DashboardChatProps) {
  const chatId = initialThreadId ?? null;
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
  // Lazy `/chat` creates a thread via replaceState without remounting — keep a
  // live id so the messages query stays subscribed after the first send.
  const [liveThreadId, setLiveThreadId] = useState<string | null>(chatId);

  const checkpointsRef = useRef<ChatCheckpoint[]>([]);
  const loadedMessagesThreadRef = useRef<string | null>(null);
  const pollAbortRef = useRef(0);
  const pollControllerRef = useRef<AbortController | null>(null);
  const resumedJobsRef = useRef<Set<string>>(new Set());
  const threadIdRef = useRef<string | null>(chatId);
  const tokenRef = useRef<string | null>(token);

  useEffect(() => {
    threadIdRef.current = chatId;
    setLiveThreadId(chatId);
  }, [chatId]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const transport = useMemo(
    () =>
      createPrepwiseChatTransport({
        getToken: () => tokenRef.current,
        getThreadId: () => threadIdRef.current
      }),
    []
  );

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error: chatError
  } = useChat<PrepwiseUIMessage>({
    id: chatId ?? "chat",
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
            return existing.map((thread) =>
              thread.id === threadId
                ? { ...thread, title, updated_at: new Date().toISOString() }
                : thread
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
      if (shouldPromptForFeedback()) {
        setFeedbackMessageId(message.id);
      }
      setUndoAvailable(true);
    },
    onError: (err) => {
      showError(err.message || "Failed to send message");
      // Stream parse failures leave a blank/queued local turn while the server
      // may already have the full reply — refetch and apply into useChat.
      const threadId = threadIdRef.current;
      if (threadId) {
        void invalidateMessages(threadId).then((fresh) => {
          setMessages(uiMessagesFromHistory(fresh));
          setUndoAvailable(fresh.some((message) => message.role === "user"));
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads() });
      }
    }
  });

  const isStreaming = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1) ?? null;
  const lastMessageText = lastMessage ? getMessageText(lastMessage) : "";
  const pendingAssistantHasOutput =
    lastMessage?.role === "assistant" &&
    (Boolean(lastMessageText.trim()) ||
      lastMessage.parts.some(
        (part) => part.type === "reasoning" && "text" in part && Boolean(part.text?.trim())
      ));
  // Conversation-level thinking: before the assistant shell exists.
  const showChatThinking =
    !isGenerating &&
    (isSending || (isStreaming && lastMessage?.role === "user"));
  // Inline thinking: once the assistant bubble exists but has no tokens yet.
  const showPendingInlineThinking =
    isStreaming && lastMessage?.role === "assistant" && !pendingAssistantHasOutput;

  const {
    data: threads = EMPTY_THREADS,
    isLoading: isLoadingThreads
  } = useChatThreadsQuery({ includeArchived: true });
  const targetThreadId = liveThreadId ?? chatId;
  const {
    data: serverMessages = EMPTY_MESSAGES,
    isLoading: isLoadingMessages
  } = useChatMessagesQuery(targetThreadId);
  const { data: chatAgents } = useChatAgentsQuery();
  const { data: apiKeys = EMPTY_API_KEYS } = useApiKeysQuery();
  const {
    usageStats,
    chatCompletionBlockedReason,
    uploadBlockedReason
  } = usePlanQuota();
  const updateThreadAgentMutation = useUpdateThreadAgentMutation();
  const updateThreadLlmSourceMutation = useUpdateThreadLlmSourceMutation();
  const createThread = useCreateThreadMutation();

  const agents: AgentOption[] = useMemo(
    () =>
      (chatAgents ?? EMPTY_AGENT_OPTIONS).map((agent) => ({
        id: agent.id,
        name: agent.name,
        subject_area: agent.subject_area,
        avatar_url: agent.avatar_url
      })),
    [chatAgents]
  );
  const activeThread = useMemo(
    () => threads.find((thread: ChatThread) => thread.id === targetThreadId) ?? null,
    [targetThreadId, threads]
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
        // Stale job from earlier in this conversation: it already finished,
        // so don't resurface its result over newer activity.
        if (options?.resumed && (initial.status === "completed" || initial.status === "failed")) {
          return;
        }
        setActiveJob(initial);

        const finalJob = await pollJobUntilComplete(token, jobId, {
          signal: controller.signal,
          onUpdate: (job) => {
            if (pollId === pollAbortRef.current) {
              setActiveJob(job);
            }
          }
        });
        if (pollId !== pollAbortRef.current) return;

        setActiveJob(finalJob);
        keepFailureVisible = finalJob.status === "failed";
        if (finalJob.status === "completed" || finalJob.status === "failed") {
          // Invalidate alone is not enough — push fetched history into useChat
          // so the quiz/flashcard card replaces the queued placeholder live.
          const fresh = await invalidateMessages(threadId);
          if (pollId !== pollAbortRef.current) return;
          setMessages(uiMessagesFromHistory(fresh));
          setUndoAvailable(fresh.some((message) => message.role === "user"));
        }
      } catch (err) {
        if (pollId === pollAbortRef.current) {
          showError(err, "Failed to track generation job");
          try {
            const fresh = await invalidateMessages(threadId);
            if (pollId === pollAbortRef.current) {
              setMessages(uiMessagesFromHistory(fresh));
              setUndoAvailable(fresh.some((message) => message.role === "user"));
            }
          } catch {
            // Ignore secondary refetch failures; the primary error was already shown.
          }
        }
      } finally {
        if (pollId === pollAbortRef.current) {
          setIsGenerating(false);
          if (!keepFailureVisible) {
            setActiveJob(null);
          }
        }
      }
    },
    [invalidateMessages, setMessages, token]
  );

  const startJobPollingRef = useRef(startJobPolling);
  useEffect(() => {
    startJobPollingRef.current = startJobPolling;
  }, [startJobPolling]);

  useEffect(() => {
    if (chatError) {
      showError(chatError.message || "Failed to send message");
    }
  }, [chatError]);

  useEffect(() => {
    if (!targetThreadId || isLoadingMessages || isStreaming) return;
    if (
      !shouldApplyServerMessages({
        isStreaming,
        status,
        localMessages: messages,
        serverMessages: serverMessages as ApiChatMessage[]
      })
    ) {
      return;
    }
    setMessages(uiMessagesFromHistory(serverMessages as ApiChatMessage[]));
    setUndoAvailable(serverMessages.some((message) => message.role === "user"));
  }, [
    isLoadingMessages,
    isStreaming,
    messages.length,
    serverMessages,
    setMessages,
    status,
    targetThreadId
  ]);

  const selectedAgentId = normalizeProfessorAgentId(activeThread?.professor_agent_id);
  const { llmSource, llmProvider } = useMemo(() => {
    const validProviders = apiKeys.filter((key) => key.is_valid).map((key) => key.provider);
    let source: LlmSource = activeThread?.llm_source ?? "platform";
    let provider: LlmProvider | null = activeThread?.llm_provider ?? null;
    if (source === "byok") {
      if (validProviders.length === 0) {
        source = "platform";
        provider = null;
      } else if (!provider || !validProviders.includes(provider as ApiKeyProvider)) {
        provider = validProviders[0] ?? null;
      }
    }
    return { llmSource: source, llmProvider: provider };
  }, [activeThread, apiKeys]);

  useEffect(() => {
    const threadId = targetThreadId;
    if (!threadId || isGenerating) return;
    const queued = messages.find((message) => {
      const metadata = getMessageMetadata(message);
      return metadata?.event === "generation_queued" && metadata.job_id;
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

  const handleAgentChange = useCallback(
    (agentId: string | null) => {
      const normalizedAgentId = normalizeProfessorAgentId(agentId);
      if (!token || !targetThreadId) return;
      updateThreadAgentMutation.mutate(
        { threadId: targetThreadId, agentId: normalizedAgentId },
        {
          onError: (err) => showError(err, "Failed to update agent")
        }
      );
    },
    [targetThreadId, token, updateThreadAgentMutation]
  );

  const handleLlmSourceChange = useCallback(
    (source: LlmSource, provider?: LlmProvider | null) => {
      if (!token || !targetThreadId) return;
      updateThreadLlmSourceMutation.mutate(
        { threadId: targetThreadId, source, provider: provider ?? null },
        {
          onError: (err) => showError(err, "Failed to update model source")
        }
      );
    },
    [targetThreadId, token, updateThreadLlmSourceMutation]
  );

  useEffect(() => {
    if (!token || !targetThreadId || isLoadingMessages) return;

    const processingMaterialIds = messages.flatMap((message) => {
      const metadata = getMessageMetadata(message);
      const material = metadata?.material as { id?: string; status?: string } | undefined;
      if (
        (metadata?.event === "material_processing" || metadata?.event === "material_attached") &&
        material?.id &&
        material.status === "processing"
      ) {
        return [material.id];
      }
      return [];
    });
    if (!processingMaterialIds.length) return;

    let cancelled = false;
    const poll = async () => {
      for (const materialId of processingMaterialIds) {
        try {
          const status = await getMaterialStatus(token, materialId);
          if (status.status === "processing") continue;
          if (!cancelled) {
            const fresh = await invalidateMessages(targetThreadId);
            setMessages(uiMessagesFromHistory(fresh));
            loadedMessagesThreadRef.current = null;
          }
          return;
        } catch {
          // Ignore transient polling errors.
        }
      }
    };

    const interval = window.setInterval(() => {
      void poll();
    }, 2000);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [targetThreadId, invalidateMessages, isLoadingMessages, messages, setMessages, token]);

  const handleDraftMessageConsumed = useCallback(() => {
    setComposerDraft(null);
  }, []);

  // ChatGPT-style lazy thread creation: `/chat` holds no thread until the
  // first message is sent. The thread is created right before that send, then
  // the URL is swapped to its canonical `/chat/{id}` without a navigation so
  // the in-flight stream survives; refreshing afterwards loads the thread page.
  const ensureThreadId = useCallback(async () => {
    if (threadIdRef.current) return threadIdRef.current;
    const thread = await createThread.mutateAsync(projectId ? { project_id: projectId } : undefined);
    threadIdRef.current = thread.id;
    setLiveThreadId(thread.id);
    window.history.replaceState(null, "", asRoute(`/chat/${thread.id}`));
    return thread.id;
  }, [createThread, projectId]);

  // After lazy creation the URL has changed but the component was never
  // re-mounted with an initialThreadId, so resolve the live id first.
  const currentThreadId = useCallback(() => threadIdRef.current ?? chatId, [chatId]);

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
    },
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
        artifactType: options?.artifactType ?? null
      };

      await sendMessage({ text: content }, { body });
    } catch (err) {
      showError(err, "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  function handleArtifactChoice(artifactType: string) {
    void handleSend("Build the selected study material from my attachments.", undefined, undefined, undefined, {
      artifactType
    });
  }

  async function handleUndo() {
    if (!token) return;
    const threadId = currentThreadId();
    if (!threadId) return;
    const userIndex = findLastUserMessageIndex(messages);
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
    } catch (err) {
      showError(err, "Failed to undo");
    }
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

    const userIndex = findLastUserMessageIndex(messages);
    if (userIndex >= 0 && threadId) {
      const regeneratePrompt = getMessageText(messages[userIndex]);
      setUndoAvailable(false);
      setMessages(messages.slice(0, userIndex));
      setComposerDraft(null);
      void (async () => {
        try {
          await undoLastTurn(token, threadId);
          await deleteLastUserPrompt(token, threadId);
        } catch {
          // Local regenerate still proceeds even if server cleanup fails.
        }
        void handleSend(regeneratePrompt);
      })();
      return;
    }

    if (assistantMessageId) {
      void handleRetry(assistantMessageId);
    }
  }

  function handleRetry(messageId: string) {
    const index = messages.findIndex((message) => message.id === messageId);
    if (index < 0) return;
    let userIndex = index;
    while (userIndex >= 0 && messages[userIndex].role !== "user") {
      userIndex -= 1;
    }
    if (userIndex < 0) return;
    const prompt = getMessageText(messages[userIndex]);
    setMessages(messages.slice(0, userIndex));
    void handleSend(prompt);
  }

  const latestUserMessageId = useMemo(() => {
    const index = findLastUserMessageIndex(messages);
    return index >= 0 ? messages[index].id : null;
  }, [messages]);

  const latestAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") return messages[index].id;
    }
    return null;
  }, [messages]);

  // Anchor the generation status/failure card to the message that owns the job,
  // so it appears where the generation happened instead of a fixed slot.
  const activeJobAnchorId = useMemo(() => {
    if (!activeJob) return null;
    const owner = messages.find(
      (message) => getMessageMetadata(message)?.job_id === activeJob.id
    );
    return owner?.id ?? null;
  }, [activeJob, messages]);

  const canUndoLatest = undoAvailable && Boolean(latestUserMessageId);
  const canRedoLatest = Boolean(redoPrompt) || canUndoLatest;
  const isConversationLoading = isAuthLoading || (isLoadingMessages && messages.length === 0);
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {isConversationLoading ? (
        <ChatConversationSkeleton />
      ) : messages.length === 0 && !isStreaming ? (
        <ChatEmptyState onSelectPrompt={(prompt) => void handleSend(prompt)} />
      ) : (
        <Conversation className="relative">
          <ConversationContent className="mx-auto w-full max-w-3xl">
            {messages.map((message) => {
              const isLatestUser = message.id === latestUserMessageId;
              const isLatestAssistant = message.id === latestAssistantMessageId;
              const streamingThis =
                isStreaming && isLatestAssistant && message.role === "assistant";

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
      )}
      <div className="mt-auto shrink-0">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <InstitutionIndicator institution={user?.institution ?? null} className="mb-2 mt-2" />
        </div>
        <ChatComposer
          onSend={(message, settings, model, files, options) => void handleSend(message, settings, model, files, options)}
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
          onDraftMessageConsumed={handleDraftMessageConsumed}
          className="shrink-0"
        />
      </div>
    </div>
  );
}
