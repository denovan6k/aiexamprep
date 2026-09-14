"use client";

import { AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { FlashcardGenerationCard, type FlashcardPreview } from "@/components/chat/flashcard-generation-card";
import { GenerationCard } from "@/components/chat/generation-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FeedbackBar } from "@/components/ui/feedback-bar";
import { Markdown } from "@/components/ui/markdown";
import { ThinkingBar } from "@/components/ui/thinking-bar";
import { MediaAttachmentCard } from "@/components/chat/MediaAttachmentCard";
import { queuedGenerationMessage, type QuizPreview, type MediaAttachment } from "@/lib/chat";
import { dismissFeedbackPrompt } from "@/lib/chat-feedback";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export type ChatMessageRole = "user" | "assistant";

export type ChatMessageMetadata = {
  event?:
    | "material_attached"
    | "material_failed"
    | "material_queued"
    | "generation_queued"
    | "generation_completed"
    | "generation_failed"
    | "agent_switched"
    | string;
  job_id?: string;
  status?: string;
  generation_type?: string;
  agent_id?: string | null;
  material?: {
    title?: string;
    status?: string;
    chunk_count?: number;
    file_name?: string;
  };
  materials?: Array<{
    title?: string;
    status?: string;
    chunk_count?: number;
    file_name?: string;
  }>;
  attachments?: MediaAttachment[];
  error?: string;
  degradation_reason?: {
    code?: string;
    message?: string;
    fallback?: string;
  } | null;
  suggestions?: string[];
  deck_id?: string;
  card_count?: number;
  flashcard_preview?: Array<{ front: string; back: string; topic?: string | null }>;
};

export type ChatMessageData = {
  id: string;
  role: ChatMessageRole;
  content: string;
  quiz?: QuizPreview | null;
  flashcards?: FlashcardPreview | null;
  metadata?: ChatMessageMetadata | null;
  attachments?: MediaAttachment[] | null;
  media_attachments?: MediaAttachment[] | null;
};

type ChatMessageProps = {
  message: ChatMessageData;
  streamContent?: boolean;
  showFeedback?: boolean;
};

function useSmoothStreamText(text: string, active: boolean) {
  const [displayedText, setDisplayedText] = useState(active ? "" : text);

  useEffect(() => {
    if (!active) {
      setDisplayedText(text);
      return;
    }

    if (!text) {
      setDisplayedText("");
      return;
    }

    let frame: number | null = null;
    const tick = () => {
      setDisplayedText((current) => {
        const safeCurrent = text.startsWith(current) ? current : "";
        if (safeCurrent.length >= text.length) return text;
        const remaining = text.slice(safeCurrent.length);
        const punctuationPause = /^[\n.!?]/.test(remaining) ? 1 : 0;
        const chunkSize = Math.min(remaining.length, punctuationPause ? 4 : 14);
        const next = text.slice(0, safeCurrent.length + chunkSize);
        if (next.length < text.length) {
          frame = window.setTimeout(tick, 18);
        }
        return next;
      });
    };

    frame = window.setTimeout(tick, 18);
    return () => {
      if (frame !== null) window.clearTimeout(frame);
    };
  }, [active, text]);

  return displayedText;
}

function MaterialAttachedAlert({ metadata }: { metadata: ChatMessageMetadata }) {
  const materials =
    metadata.materials?.length
      ? metadata.materials
      : metadata.material
        ? [metadata.material]
        : [];
  const totalSections = materials.reduce((sum, item) => sum + (item.chunk_count ?? 0), 0);
  const labels = materials.map((item) => item.title ?? "File").join(", ");

  return (
    <Alert variant="success" className="mt-4 rounded-xl">
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>Material ready</AlertTitle>
      <AlertDescription>
        <p>
          <span className="font-medium text-foreground">{labels}</span>
          {materials.length === 1 ? " is indexed" : " are indexed"} with {totalSections} sections.
          Ask for a quiz, flashcards, or an explanation when you are ready.
        </p>
      </AlertDescription>
    </Alert>
  );
}

function MaterialFailedAlert({ metadata }: { metadata: ChatMessageMetadata }) {
  const material = metadata.material;
  return (
    <Alert variant="destructive" className="mt-4 rounded-xl">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Could not read {material?.title ?? "this file"}</AlertTitle>
      <AlertDescription>
        <p>{metadata.error ?? "No extractable text was found."}</p>
        {metadata.suggestions?.length ? (
          <ul className="mt-2 list-inside list-disc space-y-1">
            {metadata.suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function AssistantMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <Markdown className={cn("chat-prose text-[15px] leading-7 text-foreground", className)}>
      {content}
    </Markdown>
  );
}

function DegradationAlert({ metadata }: { metadata: ChatMessageMetadata }) {
  const reason = metadata.degradation_reason;
  if (!reason) return null;

  // Determine alert tone based on error type
  const isAuthError = reason.code === "auth" || reason.code === "authorization_failed";
  const variant = isAuthError ? "destructive" : "warning";

  return (
    <Alert variant={variant} className="mt-4 rounded-xl">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{reason.message ?? "AI provider unavailable"}</AlertTitle>
      <AlertDescription className="text-sm leading-relaxed">
        {reason.fallback ?? "Using offline question templates for this response."}
      </AlertDescription>
    </Alert>
  );
}

export function ChatMessage({ message, streamContent = false, showFeedback = false }: ChatMessageProps) {
  const isUser = message.role === "user";
  const event = message.metadata?.event;
  const content =
    event === "generation_queued"
      ? queuedGenerationMessage(message.metadata?.generation_type, message.content)
      : message.content;
  const attachments = message.attachments || message.media_attachments || message.metadata?.attachments || [];
  const [feedbackVisible, setFeedbackVisible] = useState(showFeedback);
  const displayedContent = useSmoothStreamText(content, streamContent && !isUser);

  useEffect(() => {
    setFeedbackVisible(showFeedback);
  }, [showFeedback]);

  function closeFeedback() {
    setFeedbackVisible(false);
    dismissFeedbackPrompt();
  }

  if (isUser) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-2 sm:px-6">
        <div className="flex justify-end">
          <div className="max-w-[min(88%,40rem)] space-y-2 rounded-[1.25rem] bg-muted/80 px-4 py-2.5 shadow-sm ring-1 ring-border/40">
            {content && (
              <Markdown className="chat-prose chat-prose-compact text-[15px] leading-relaxed text-foreground">
                {content}
              </Markdown>
            )}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map((att) => (
                  <MediaAttachmentCard key={att.id || att.filename} attachment={att} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
      <div className="flex gap-3">
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-foreground shadow-sm"
          aria-hidden
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{siteConfig.name}</p>
            {event === "material_attached" ? (
              <Badge variant="success" className="h-5 px-1.5 text-[10px]">
                Uploaded
              </Badge>
            ) : null}
            {event === "material_failed" ? (
              <Badge variant="danger" className="h-5 px-1.5 text-[10px]">
                Upload issue
              </Badge>
            ) : null}
          </div>

          {streamContent && !displayedContent ? (
            <ThinkingBar text="Thinking" className="max-w-md" />
          ) : streamContent ? (
            <div className="relative">
              <AssistantMarkdown content={displayedContent} />
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-full bg-primary align-middle" />
            </div>
          ) : (
            <AssistantMarkdown content={content} />
          )}

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {attachments.map((att) => (
                <MediaAttachmentCard key={att.id || att.filename} attachment={att} />
              ))}
            </div>
          )}

          {event === "material_attached" && message.metadata ? (
            <MaterialAttachedAlert metadata={message.metadata} />
          ) : null}
          {event === "material_failed" && message.metadata ? (
            <MaterialFailedAlert metadata={message.metadata} />
          ) : null}
          {message.metadata?.degradation_reason ? (
            <DegradationAlert metadata={message.metadata} />
          ) : null}

          {message.quiz ? <GenerationCard quiz={message.quiz} /> : null}
          {message.flashcards ? <FlashcardGenerationCard deck={message.flashcards} /> : null}

          {feedbackVisible ? (
            <FeedbackBar
              title="Was this helpful?"
              onHelpful={closeFeedback}
              onNotHelpful={closeFeedback}
              onClose={closeFeedback}
              className="mt-3"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
