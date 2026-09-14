"use client";

import { ArrowUp, Code2, FileText, Image, Layers, Paperclip, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage
} from "@/components/ai-elements/prompt-input";
import { MediaUploader, type MediaUploaderRef } from "@/components/chat/MediaUploader";
import { AgentPicker, type AgentOption } from "@/components/chat/agent-picker";
import { ChatModelPicker } from "@/components/chat/chat-model-picker";
import { SlashCommandMenu } from "@/components/chat/slash-command-menu";
import { QuizSettingsSheet } from "@/components/chat/quiz-settings-sheet";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { FileUpload, FileUploadContent } from "@/components/ui/file-upload";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SystemMessage } from "@/components/ui/system-message";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QuotaTooltip } from "@/components/billing/quota-tooltip";
import type { PlanQuotaUsageStats } from "@/hooks/use-billing";
import { useAiModelsQuery } from "@/hooks/use-ai-models";
import { useSlashCommands } from "@/hooks/use-slash-commands";
import { flattenProviderModels, pickDefaultModel, type AiModel } from "@/lib/ai";
import {
  CHAT_ATTACHMENT_ACCEPT,
  validateMediaUpload,
  type MediaAttachment,
  type ValidatedChatAttachment
} from "@/lib/chat";
import type { LlmProvider, LlmSource } from "@/lib/llm";
import {
  BYOK_MODELS,
  modelSupportsReasoning,
  modelSupportsVision,
  pickFirstVisionModel
} from "@/lib/llm";
import { getPastedContent, type PastedContent } from "@/lib/paste-content";
import type { UserApiKey } from "@/lib/settings";
import type { QuizGenerationSettings } from "@/lib/study";
import { siteConfig } from "@/lib/site";
import { showError, showWarning } from "@/lib/toast";
import { cn } from "@/lib/utils";

const EMPTY_MODELS: AiModel[] = [];

type ChatComposerProps = {
  onSend: (
    message: string,
    settings?: QuizGenerationSettings,
    model?: string,
    files?: File[],
    options?: {
      supportsReasoning?: boolean;
      mediaAttachmentIds?: string[];
      llmProvider?: LlmProvider | null;
    },
    mediaAttachmentIds?: string[]
  ) => void;
  agents?: AgentOption[];
  selectedAgentId?: string | null;
  onAgentChange?: (agentId: string | null) => void;
  onAgentCreated?: (agent: AgentOption) => void;
  agentPickerDisabled?: boolean;
  llmSource?: LlmSource;
  llmProvider?: LlmProvider | null;
  apiKeys?: UserApiKey[];
  onLlmSourceChange?: (source: LlmSource, provider?: LlmProvider | null) => void;
  modelPickerDisabled?: boolean;
  disabled?: boolean;
  uploadBlockedReason?: string | null;
  chatCompletionBlockedReason?: string | null;
  usageStats?: PlanQuotaUsageStats | null;
  draftMessage?: string | null;
  onDraftMessageConsumed?: () => void;
  className?: string;
};

function toRatio(used: number, limit: number | null): number {
  if (limit === null || limit <= 0) return 0;
  return Math.min(1, Math.max(0, used) / limit);
}

function formatUsageLine(label: string, used: number, limit: number | null): string {
  if (limit === null) return `${label}: ${Math.max(0, used)} used (unlimited plan)`;
  return `${label}: ${Math.max(0, used)} / ${limit}`;
}

function UsageMeter({ usageStats }: { usageStats: PlanQuotaUsageStats }) {
  const generationRatio = toRatio(usageStats.generationsUsed, usageStats.generationLimit);
  const uploadRatio = toRatio(usageStats.uploadsUsed, usageStats.uploadLimit);
  const progress = Math.max(generationRatio, uploadRatio);
  const radius = 10;
  const stroke = 2.5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const toneClass =
    progress >= 1 ? "text-destructive" : progress >= 0.75 ? "text-amber-500" : "text-emerald-500";

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="group relative hidden h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-muted/30 sm:inline-flex"
          aria-label="Usage progress"
        >
          <svg className={cn("h-6 w-6 -rotate-90", toneClass)} viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r={radius} fill="none" className="stroke-border/70" strokeWidth={stroke} />
            <circle
              cx="12"
              cy="12"
              r={radius}
              fill="none"
              className="stroke-current transition-all duration-300 group-hover:brightness-110"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-[11px] leading-relaxed">
        <p>Plan usage</p>
        <p>{formatUsageLine("Chat completions", usageStats.generationsUsed, usageStats.generationLimit)}</p>
        <p>{formatUsageLine("Uploads", usageStats.uploadsUsed, usageStats.uploadLimit)}</p>
      </TooltipContent>
    </Tooltip>
  );
}

type PastedBlock = PastedContent & {
  id: string;
};

export function ChatComposer({
  onSend,
  agents = [],
  selectedAgentId,
  onAgentChange,
  onAgentCreated,
  agentPickerDisabled,
  llmSource = "platform",
  llmProvider,
  apiKeys = [],
  onLlmSourceChange,
  modelPickerDisabled,
  disabled,
  uploadBlockedReason,
  chatCompletionBlockedReason,
  usageStats,
  draftMessage,
  onDraftMessageConsumed,
  className
}: ChatComposerProps) {
  const { token } = useAuth();
  const { data: modelsData, isLoading: modelsLoading } = useAiModelsQuery();
  const [message, setMessage] = useState("");
  const models: AiModel[] = modelsData ? flattenProviderModels(modelsData) : EMPTY_MODELS;
  const platformProviders = modelsData?.providers ?? [];
  const llmConfigured = modelsData?.configured ?? false;
  const defaultSelection = pickDefaultModel(modelsData);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const selectedModelValue = selectedModel || defaultSelection.modelId;
  const [mediaAttachmentIds, setMediaAttachmentIds] = useState<string[]>([]);
  const [hasImageAttachments, setHasImageAttachments] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [pastedBlocks, setPastedBlocks] = useState<PastedBlock[]>([]);
  const [selectedPastedBlock, setSelectedPastedBlock] = useState<PastedBlock | null>(null);
  const mediaUploaderRef = useRef<MediaUploaderRef>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAttachmentsChange = useCallback((ids: string[], _attachments: MediaAttachment[]) => {
    setMediaAttachmentIds((previousIds) =>
      previousIds.length === ids.length && previousIds.every((id, index) => id === ids[index])
        ? previousIds
        : ids
    );
  }, []);

  const handleImagePresenceChange = useCallback((hasImages: boolean) => {
    setHasImageAttachments(hasImages);
  }, []);

  const handleUploadingStateChange = useCallback((isUploading: boolean) => {
    setMediaUploading((previousState) => previousState === isUploading ? previousState : isUploading);
  }, []);
  const uploadBlocked = Boolean(uploadBlockedReason);
  const chatCompletionBlocked = Boolean(chatCompletionBlockedReason);
  const uploadControlsDisabled = disabled || uploadBlocked;
  const slash = useSlashCommands({
    text: message,
    onTextChange: setMessage,
    textareaRef,
    disabled
  });

  useEffect(() => {
    if (draftMessage == null) return;
    setMessage(draftMessage);
    onDraftMessageConsumed?.();
  }, [draftMessage, onDraftMessageConsumed]);

  useEffect(() => {
    if (!hasImageAttachments || modelsLoading || models.length === 0) return;

    const modelId = selectedModelValue;
    const matchedProvider =
      (models.find((item) => item.id === modelId)?.provider as LlmProvider | undefined) ??
      (defaultSelection.modelId === modelId
        ? (defaultSelection.provider as LlmProvider | null)
        : null);
    const effectiveProvider =
      llmSource === "byok"
        ? llmProvider
        : llmProvider ?? matchedProvider ?? (defaultSelection.provider as LlmProvider | null);

    if (
      modelId &&
      modelSupportsVision(modelId, llmSource, effectiveProvider, models)
    ) {
      return;
    }

    if (
      llmSource === "byok" &&
      llmProvider &&
      (llmProvider === "openai" || llmProvider === "anthropic")
    ) {
      const visionByok = BYOK_MODELS[llmProvider].find((item) => item.supports_vision);
      if (visionByok) {
        setSelectedModel(visionByok.id);
        return;
      }
    }

    const visionPick = pickFirstVisionModel(models, {
      preferredProvider: "gemini",
      llmSource
    });
    if (!visionPick) return;

    setSelectedModel(visionPick.modelId);
    if (
      visionPick.provider &&
      (llmSource !== "platform" ||
        effectiveProvider !== visionPick.provider ||
        llmProvider !== visionPick.provider)
    ) {
      onLlmSourceChange?.("platform", visionPick.provider as LlmProvider);
    }
  }, [
    defaultSelection.modelId,
    defaultSelection.provider,
    hasImageAttachments,
    llmProvider,
    llmSource,
    models,
    modelsLoading,
    onLlmSourceChange,
    selectedModelValue
  ]);

  function handleSubmit(promptMessage: PromptInputMessage) {
    const trimmed = (promptMessage.text || message).trim();
    const currentMediaIds = mediaAttachmentIds.length > 0
      ? mediaAttachmentIds
      : mediaUploaderRef.current?.getAttachmentIds() || [];

    if ((!trimmed && currentMediaIds.length === 0 && pastedBlocks.length === 0) || disabled || mediaUploading) return;
    if (chatCompletionBlockedReason) {
      showWarning(chatCompletionBlockedReason);
      return;
    }
    const pastedContent = pastedBlocks
      .map((block) => `<pasted type="${block.kind}">\n${block.content}\n</pasted>`)
      .join("\n\n");
    const content = [trimmed, pastedContent].filter(Boolean).join("\n\n");
    const modelId = selectedModelValue || undefined;
    const matchedProvider =
      (models.find((item) => item.id === modelId)?.provider as LlmProvider | undefined) ??
      (defaultSelection.modelId === modelId
        ? (defaultSelection.provider as LlmProvider | null)
        : null);
    const effectiveProvider =
      llmSource === "byok"
        ? llmProvider
        : llmProvider ?? matchedProvider ?? (defaultSelection.provider as LlmProvider | null);
    const supportsReasoning = modelId
      ? modelSupportsReasoning(modelId, llmSource, effectiveProvider, models)
      : false;

    onSend(
      content || "Review the attached media.",
      undefined,
      modelId,
      undefined,
      {
        supportsReasoning,
        mediaAttachmentIds: currentMediaIds,
        llmProvider: effectiveProvider
      },
      currentMediaIds
    );

    setMessage("");
    setPastedBlocks([]);
    setSelectedPastedBlock(null);
    setMediaAttachmentIds([]);
    mediaUploaderRef.current?.clearQueue();
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const items = event.clipboardData?.items;
    if (items) {
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }
      if (files.length) {
        event.preventDefault();
        if (uploadBlockedReason) {
          showWarning(uploadBlockedReason);
          return;
        }
        mediaUploaderRef.current?.addFiles(files);
        return;
      }
    }

    const pastedContent = getPastedContent(event.clipboardData.getData("text/plain"));
    if (!pastedContent) return;

    event.preventDefault();
    setPastedBlocks((blocks) => [
      ...blocks,
      {
        ...pastedContent,
        id: crypto.randomUUID()
      }
    ]);
  }

  function removePastedBlock(id: string) {
    setPastedBlocks((blocks) => blocks.filter((block) => block.id !== id));
    setSelectedPastedBlock((block) => (block?.id === id ? null : block));
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (files.length) {
      mediaUploaderRef.current?.addFiles(files);
    }
  }

  function openDocumentPicker() {
    window.requestAnimationFrame(() => {
      documentInputRef.current?.click();
    });
  }

  function openImagePicker() {
    window.requestAnimationFrame(() => {
      imageInputRef.current?.click();
    });
  }

  function handleFilesAdded(files: File[]) {
    if (uploadBlockedReason) {
      showWarning(uploadBlockedReason);
      return;
    }
    mediaUploaderRef.current?.addFiles(files);
  }

  return (
    <div className={cn("shrink-0 bg-gradient-to-t from-background via-background to-background/80 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:px-6", className)}>
      <div className="mx-auto max-w-3xl space-y-2">
        {!llmConfigured && !modelsLoading ? (
          <SystemMessage variant="warning" fill className="text-xs">
            Connect an AI key in Models & API keys for AI-powered replies, or attach material to use offline study templates.
          </SystemMessage>
        ) : null}

        <FileUpload
          onFilesAdded={handleFilesAdded}
          multiple
          accept={CHAT_ATTACHMENT_ACCEPT}
          disabled={uploadControlsDisabled}
        >
          <FileUploadContent />
        </FileUpload>
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          disabled={uploadControlsDisabled}
          onChange={handleFileInputChange}
        />
        <input
          ref={documentInputRef}
          type="file"
          multiple
          accept={CHAT_ATTACHMENT_ACCEPT}
          className="hidden"
          disabled={uploadControlsDisabled}
          onChange={handleFileInputChange}
        />

        <PromptInput
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-[1.75rem] border border-border/80 bg-background shadow-[0_2px_24px_-4px_hsl(var(--foreground)/0.08)] ring-1 ring-border/50 transition-shadow focus-within:border-border focus-within:shadow-[0_4px_28px_-6px_hsl(var(--foreground)/0.12)]"
          >
            <PromptInputBody>
              <MediaUploader
                ref={mediaUploaderRef}
                token={token}
                disabled={uploadControlsDisabled}
                onAttachmentsChange={handleAttachmentsChange}
                onImagePresenceChange={handleImagePresenceChange}
                onUploadingStateChange={handleUploadingStateChange}
              />

              {pastedBlocks.length ? (
                <div className="flex flex-wrap gap-2 px-4 pt-3">
                  {pastedBlocks.map((block) => {
                    const Icon = block.kind === "code" ? Code2 : FileText;

                    return (
                      <span
                        key={block.id}
                        className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/60 py-1 pl-2.5 pr-1 text-xs text-muted-foreground"
                      >
                        <button
                          type="button"
                          className="inline-flex min-w-0 items-center gap-1.5 hover:text-foreground"
                          onClick={() => setSelectedPastedBlock(block)}
                          aria-label={`Preview pasted ${block.kind}`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{block.label}</span>
                        </button>
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-background hover:text-foreground"
                          onClick={() => removePastedBlock(block.id)}
                          aria-label={`Remove pasted ${block.kind}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : null}

              <div className="w-full px-3 pt-1">
                <PromptInputTextarea
                  value={message}
            disabled={disabled || mediaUploading}
                  placeholder={`Message ${siteConfig.name}...`}
                  className="min-h-[52px] max-h-[200px] w-full resize-none border-0 bg-transparent px-1 py-3 text-left text-[15px] leading-relaxed shadow-none focus-visible:ring-0"
                  onChange={(event) => {
                    textareaRef.current = event.currentTarget;
                    setMessage(event.currentTarget.value);
                    slash.handleCursorChange(event.currentTarget.selectionStart ?? 0);
                  }}
                  onFocus={(event) => {
                    textareaRef.current = event.currentTarget;
                    slash.handleCursorChange(event.currentTarget.selectionStart ?? 0);
                  }}
                  onSelect={(event) => slash.handleCursorChange(event.currentTarget.selectionStart ?? 0)}
                  onKeyDown={slash.handleKeyDown}
                  onPaste={handlePaste}
                />
              </div>
            </PromptInputBody>

            <PromptInputFooter className="flex-wrap gap-2 border-t border-border/40 px-2 py-2">
              <PromptInputTools className="flex-wrap">
                {uploadBlocked ? (
                  <QuotaTooltip reason={uploadBlockedReason}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                      disabled
                      aria-label="Add attachment"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </QuotaTooltip>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                        disabled={disabled}
                        aria-label="Add attachment"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-44">
                      <DropdownMenuItem disabled={disabled} onClick={openDocumentPicker}>
                        <FileText className="h-4 w-4" />
                        Document
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={disabled} onClick={openImagePicker}>
                        <Image className="h-4 w-4" />
                        Image
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

              <QuizSettingsSheet
                disabled={disabled}
                disabledReason={chatCompletionBlockedReason}
                onGenerate={(prompt, settings) => {
                  const modelId = selectedModelValue || undefined;
                  onSend(prompt, settings, modelId, undefined, {
                    supportsReasoning: modelId
                      ? modelSupportsReasoning(modelId, llmSource, llmProvider, models)
                      : false
                  });
                }}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                    disabled={disabled || chatCompletionBlocked}
                    aria-label="Quiz settings"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                }
              />

              <QuotaTooltip reason={chatCompletionBlockedReason}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="hidden h-9 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
                  disabled={disabled || chatCompletionBlocked}
                  onClick={() => {
                  const modelId = selectedModelValue || undefined;
                  onSend("/flashcards on my uploaded material", undefined, modelId, undefined, {
                    supportsReasoning: modelId
                      ? modelSupportsReasoning(modelId, llmSource, llmProvider, models)
                      : false
                  });
                }}
              >
                <Layers className="mr-1.5 h-3.5 w-3.5" />
                Flashcards
              </Button>
              </QuotaTooltip>
              </PromptInputTools>

              <div className="flex min-w-0 flex-1 basis-full items-center gap-1.5 sm:basis-auto sm:flex-none">
                {usageStats ? <UsageMeter usageStats={usageStats} /> : null}
                <AgentPicker
                  agents={agents}
                  selectedAgentId={selectedAgentId}
                  onAgentChange={onAgentChange}
                  onAgentCreated={onAgentCreated}
                  disabled={agentPickerDisabled || disabled}
                  compact
                  hideIcon
                  className="min-w-0"
                />

                <div className="hidden h-4 w-px bg-border sm:block" aria-hidden />

                <ChatModelPicker
                  platformProviders={platformProviders}
                  platformModels={models}
                  selectedModel={selectedModelValue}
                  llmSource={llmSource}
                  llmProvider={llmProvider}
                  apiKeys={apiKeys}
                  modelsLoading={modelsLoading}
                  llmConfigured={llmConfigured}
                  disabled={disabled || modelPickerDisabled}
                  visionOnly={hasImageAttachments}
                  onModelChange={setSelectedModel}
                  onLlmSourceChange={onLlmSourceChange}
                />

                <QuotaTooltip reason={chatCompletionBlockedReason}>
                  <PromptInputSubmit
                    size="icon-sm"
                    className="h-9 w-9 shrink-0 rounded-full"
                    disabled={
                      disabled ||
                      chatCompletionBlocked ||
                      mediaUploading ||
                      (!message.trim() && mediaAttachmentIds.length === 0 && pastedBlocks.length === 0)
                    }
                    aria-label="Send message"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </PromptInputSubmit>
                </QuotaTooltip>
              </div>
            </PromptInputFooter>
          </PromptInput>
          <SlashCommandMenu
            open={slash.isOpen}
            menuState={slash.menuState}
            position={slash.menuPosition}
            selectedIndex={slash.selectedIndex}
            onSelect={slash.selectItem}
            onHover={slash.setSelectedIndex}
          />

        <Dialog
          open={Boolean(selectedPastedBlock)}
          onOpenChange={(open) => {
            if (!open) setSelectedPastedBlock(null);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedPastedBlock?.kind === "code" ? "Code" : "TXT"} · {selectedPastedBlock?.lineCount}{" "}
                {selectedPastedBlock?.lineCount === 1 ? "line" : "lines"}
              </DialogTitle>
            </DialogHeader>
            <pre
              className={cn(
                "max-h-[min(60vh,36rem)] overflow-auto rounded-lg bg-muted/60 p-4 text-sm whitespace-pre-wrap",
                selectedPastedBlock?.kind === "code" && "font-mono"
              )}
            >
              {selectedPastedBlock?.content}
            </pre>
          </DialogContent>
        </Dialog>

        <p className="text-center text-[11px] text-muted-foreground/80">
          {siteConfig.name} can make mistakes. Verify important exam content.
        </p>
      </div>
    </div>
  );
}
