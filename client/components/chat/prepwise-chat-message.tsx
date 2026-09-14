"use client";

import { CopyIcon, Redo2Icon, RefreshCwIcon, Undo2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger
} from "@/components/ai-elements/reasoning";
import { ErrorBoundary } from "@/components/error-boundary";
import { FlashcardGenerationCard } from "@/components/chat/flashcard-generation-card";
import { ArtifactChoiceCard } from "@/components/chat/artifact-choice-card";
import { StudyArtifactCard } from "@/components/chat/study-artifact-card";
import { InlineChatThinking } from "@/components/chat/chat-thinking";
import { GenerationCard } from "@/components/chat/generation-card";
import { VisualizationWidget } from "@/components/chat/visualization-widget";
import { MediaAttachmentCard } from "@/components/chat/MediaAttachmentCard";
import { Tool, type ToolPart } from "@/components/tool";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FeedbackBar } from "@/components/ui/feedback-bar";
import { queuedGenerationMessage, type MediaAttachment } from "@/lib/chat";
import { showError, showSuccess } from "@/lib/toast";
import { dismissFeedbackPrompt } from "@/lib/chat-feedback";
import {
  getMessageMetadata,
  getMessageText,
  type PrepwiseMessageMetadata,
  type PrepwiseUIMessage
} from "@/lib/chat-ui-message";
import { getFriendlyError } from "@/lib/error-handler";
import { AlertCircle, CheckCircle2 } from "lucide-react";

type PrepwiseChatMessageProps = {
  message: PrepwiseUIMessage;
  isStreaming?: boolean;
  showInlineThinking?: boolean;
  animateOnMount?: boolean;
  showFeedback?: boolean;
  onRetry?: (messageId: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  showActions?: boolean;
  onArtifactChoice?: (artifactType: string) => void;
  artifactChoiceDisabled?: boolean;
};

function ProgressiveMessageResponse({
  content,
  isStreaming,
  animateOnMount
}: {
  content: string;
  isStreaming: boolean;
  animateOnMount: boolean;
}) {
  const shouldAnimate = animateOnMount && !isStreaming;
  const [visibleContent, setVisibleContent] = useState(() => (shouldAnimate ? "" : content));
  const wasAnimating = useRef(shouldAnimate);

  useEffect(() => {
    if (!shouldAnimate) {
      setVisibleContent(content);
      wasAnimating.current = false;
      return;
    }

    if (!wasAnimating.current && content) {
      setVisibleContent("");
    }
    wasAnimating.current = true;
  }, [content, shouldAnimate]);

  useEffect(() => {
    if (!shouldAnimate || visibleContent.length >= content.length) return;

    const remaining = content.length - visibleContent.length;
    const charactersPerFrame = remaining > 180 ? 12 : remaining > 48 ? 7 : 3;
    const frame = window.requestAnimationFrame(() => {
      setVisibleContent(content.slice(0, visibleContent.length + charactersPerFrame));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [content, shouldAnimate, visibleContent]);

  if (isStreaming) {
    return <MessageResponse isAnimating>{content}</MessageResponse>;
  }

  const isRevealAnimating = shouldAnimate && visibleContent.length < content.length;

  return <MessageResponse isAnimating={isRevealAnimating}>{visibleContent}</MessageResponse>;
}

function MaterialAttachedAlert({ metadata }: { metadata: PrepwiseMessageMetadata }) {
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
        </p>
      </AlertDescription>
    </Alert>
  );
}

export function PrepwiseChatMessage({
  message,
  isStreaming = false,
  showInlineThinking = true,
  animateOnMount = false,
  showFeedback = false,
  onRetry,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  showActions = true,
  onArtifactChoice,
  artifactChoiceDisabled = false
}: PrepwiseChatMessageProps) {
  const metadata = getMessageMetadata(message);
  const event = metadata?.event;
  const text = getMessageText(message);
  const [feedbackVisible, setFeedbackVisible] = useState(showFeedback);
  const [copied, setCopied] = useState(false);

  const quizPart = message.parts.find((part) => part.type === "data-quiz");
  const flashcardsPart = message.parts.find((part) => part.type === "data-flashcards");
  const artifactChoicePart = message.parts.find((part) => part.type === "data-artifact-choice");
  const artifactPart = message.parts.find((part) => part.type === "data-artifact");
  const materialPart = message.parts.find((part) => part.type === "data-material");
  const errorPart = message.parts.find((part) => part.type === "data-error");
  const visualizationPart = message.parts.find((part) => part.type === "data-visualization");

  const hasGeneratedContent =
    (quizPart?.type === "data-quiz" && Boolean(quizPart.data.quiz || quizPart.data.quiz_preview)) ||
    (flashcardsPart?.type === "data-flashcards" && Boolean(flashcardsPart.data.deck_id)) ||
    (artifactPart?.type === "data-artifact" &&
      Boolean(artifactPart.data.artifact_id || artifactPart.data.artifact_preview)) ||
    (visualizationPart?.type === "data-visualization" && Boolean(visualizationPart.data.title));
  const content =
    event === "generation_queued" && !hasGeneratedContent
      ? queuedGenerationMessage(metadata?.generation_type, text)
      : text;

  const reasoningParts = message.parts.filter((part) => part.type === "reasoning");
  const reasoningText = reasoningParts
    .map((part) => (part.type === "reasoning" ? part.text : ""))
    .join("");
  // Only treat reasoning as "present" once actual tokens have landed. A
  // reasoning part can exist with state "streaming" before its first token
  // arrives - gating on text (not just part presence) avoids a blank
  // Reasoning box flashing between the loading shimmer and real content.
  const hasReasoningTokens = reasoningText.trim().length > 0;
  const isStreamingReasoning =
    isStreaming && reasoningParts.some((part) => part.type === "reasoning" && part.state === "streaming");

  useEffect(() => {
    setFeedbackVisible(showFeedback);
  }, [showFeedback]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      showSuccess("Copied to clipboard.");
    } catch {
      setCopied(false);
      showError("Could not copy to clipboard.");
    }
  }

  const quiz =
    quizPart && quizPart.type === "data-quiz"
      ? quizPart.data.quiz ?? (quizPart.data.quiz_preview as typeof quizPart.data.quiz)
      : null;
  const flashcards =
    flashcardsPart && flashcardsPart.type === "data-flashcards" && flashcardsPart.data.deck_id
      ? {
          deck_id: flashcardsPart.data.deck_id,
          cards: flashcardsPart.data.flashcard_preview ?? [],
          card_count: flashcardsPart.data.card_count ?? flashcardsPart.data.flashcard_preview?.length ?? 0
        }
      : null;

  const artifactChoice =
    artifactChoicePart && artifactChoicePart.type === "data-artifact-choice"
      ? artifactChoicePart.data
      : metadata?.event === "artifact_choice"
        ? {
            choices: metadata.choices ?? [],
            attachment_names: metadata.attachment_names ?? []
          }
        : null;

  const studyArtifact =
    artifactPart && artifactPart.type === "data-artifact" && artifactPart.data.artifact_preview
      ? {
          artifactId: artifactPart.data.artifact_id,
          artifactType: artifactPart.data.artifact_type ?? "summary",
          title: artifactPart.data.artifact_title ?? "Study material",
          preview: artifactPart.data.artifact_preview
        }
      : metadata?.artifact_preview
        ? {
            artifactId: metadata.artifact_id,
            artifactType: metadata.artifact_type ?? "summary",
            title: metadata.artifact_title ?? "Study material",
            preview: metadata.artifact_preview
          }
        : null;

  const materialMeta =
    materialPart && materialPart.type === "data-material"
      ? (materialPart.data as PrepwiseMessageMetadata)
      : metadata;

  const degradation =
    errorPart && errorPart.type === "data-error"
      ? errorPart.data.degradation_reason
      : metadata?.degradation_reason;

  const visualization =
    visualizationPart && visualizationPart.type === "data-visualization"
      ? visualizationPart.data
      : metadata?.visualization ?? null;

  const hasVisibleContent = Boolean(content.trim()) || Boolean(visualization);

  // Sequence: shimmer (nothing yet) -> Reasoning stream (tokens arriving)
  // -> final content. Shimmer only shows while there is truly nothing to
  // render; the moment reasoning tokens exist, hand off to the Reasoning
  // block instead of showing both or neither.
  const showThinkingShimmer =
    showInlineThinking &&
    isStreaming &&
    message.role === "assistant" &&
    !hasVisibleContent &&
    !hasReasoningTokens &&
    !degradation;

  return (
    <Message from={message.role} className="group/message mx-auto w-full max-w-3xl px-4 py-2 sm:px-6">
      <MessageContent
        className={
          message.role === "user"
            ? "max-w-[min(88%,40rem)]"
            : "w-full max-w-none"
        }
      >
        {hasReasoningTokens ? (
          <Reasoning
            className="mb-2 w-full"
            isStreaming={isStreamingReasoning}
            defaultOpen={isStreamingReasoning}
            duration={
              typeof metadata?.reasoning_duration_ms === "number"
                ? Math.round(metadata.reasoning_duration_ms / 1000)
                : undefined
            }
          >
            <ReasoningTrigger />
            <ReasoningContent>{reasoningText}</ReasoningContent>
          </Reasoning>
        ) : null}

        {metadata?.tool_calls
          ?.filter((call) => call.tool !== "render_visualization")
          .map((call, index) => {
          const toolPart: ToolPart = {
            type: "tool-mcp",
            state: "output-available",
            input: call.input,
            output: { result: call.result },
            toolCallId: `${call.tool}-${index}`
          };
          return <Tool key={toolPart.toolCallId} toolPart={toolPart} />;
        })}

        {degradation ? (
          <Alert variant="warning" className="rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {
                getFriendlyError({
                  code: degradation.code,
                  message: degradation.detail ?? degradation.message
                }).title
              }
            </AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                {
                  getFriendlyError({
                    code: degradation.code,
                    message: degradation.detail ?? degradation.message
                  }).message
                }
              </p>
              {degradation.retryable && onRetry ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={() => onRetry(message.id)}
                >
                  <RefreshCwIcon className="size-3.5" />
                  Try again
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : showThinkingShimmer ? (
          <InlineChatThinking />
        ) : content.trim() ? (
          <ProgressiveMessageResponse
            content={content}
            isStreaming={isStreaming && message.role === "assistant"}
            animateOnMount={animateOnMount && message.role === "assistant"}
          />
        ) : null}

        {visualization ? (
          <ErrorBoundary
            className="mt-4 min-h-0"
            title="Animation failed to render"
            description="The demo player hit a problem. Try again, or refresh if it keeps happening."
            resetKeys={[visualization.title, visualization.engine]}
          >
            <VisualizationWidget visualization={visualization} />
          </ErrorBoundary>
        ) : null}

        {materialMeta?.event === "material_attached" ? (
          <MaterialAttachedAlert metadata={materialMeta} />
        ) : null}

        {Array.isArray(materialMeta?.attachments) && materialMeta.attachments.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {(materialMeta.attachments as MediaAttachment[]).map((att) => (
              <MediaAttachmentCard key={att.id || att.filename} attachment={att} />
            ))}
          </div>
        ) : null}

        {quiz ? <GenerationCard quiz={quiz} /> : null}
        {flashcards ? <FlashcardGenerationCard deck={flashcards} /> : null}
        {artifactChoice?.choices?.length ? (
          <ArtifactChoiceCard
            choices={artifactChoice.choices}
            attachmentNames={artifactChoice.attachment_names}
            disabled={artifactChoiceDisabled}
            onSelect={(artifactType) => onArtifactChoice?.(artifactType)}
          />
        ) : null}
        {studyArtifact && studyArtifact.artifactType === "mind_map" ? (
          <StudyArtifactCard
            artifactType={studyArtifact.artifactType}
            title={studyArtifact.title}
            preview={studyArtifact.preview}
            artifactId={studyArtifact.artifactId}
          />
        ) : null}
      </MessageContent>

      {showActions && !isStreaming ? (
        <MessageActions
          className={
            message.role === "user"
              ? "ml-auto gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/message:opacity-100 md:group-focus-within/message:opacity-100"
              : "gap-0.5 pt-1"
          }
        >
          <MessageAction
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            tooltip={copied ? "Copied" : "Copy"}
            onClick={() => void handleCopy()}
            label={copied ? "Copied" : "Copy"}
          >
            <CopyIcon className="size-3.5" />
          </MessageAction>
          {message.role === "user" ? (
            <>
              <MessageAction
                className="h-9 w-9 text-muted-foreground hover:text-foreground disabled:opacity-40"
                tooltip="Undo"
                onClick={onUndo}
                disabled={!canUndo}
                label="Undo"
              >
                <Undo2Icon className="size-3.5" />
              </MessageAction>
              <MessageAction
                className="h-9 w-9 text-muted-foreground hover:text-foreground disabled:opacity-40"
                tooltip="Redo"
                onClick={onRedo}
                disabled={!canRedo}
                label="Redo"
              >
                <Redo2Icon className="size-3.5" />
              </MessageAction>
            </>
          ) : (
            <MessageAction
              className="h-9 w-9 text-muted-foreground hover:text-foreground disabled:opacity-40"
              tooltip="Redo"
              onClick={onRedo}
              disabled={!canRedo}
              label="Redo"
            >
              <Redo2Icon className="size-3.5" />
            </MessageAction>
          )}
        </MessageActions>
      ) : null}

      {feedbackVisible ? (
        <FeedbackBar
          title="Was this helpful?"
          onHelpful={() => {
            setFeedbackVisible(false);
            dismissFeedbackPrompt();
          }}
          onNotHelpful={() => {
            setFeedbackVisible(false);
            dismissFeedbackPrompt();
          }}
          onClose={() => {
            setFeedbackVisible(false);
            dismissFeedbackPrompt();
          }}
          className="mt-3"
        />
      ) : null}
    </Message>
  );
}