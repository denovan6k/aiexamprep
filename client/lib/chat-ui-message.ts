import type { UIMessage } from "ai";

import type { ChatMessage, QuizPreview } from "@/lib/chat";

export type PrepwiseMessageMetadata = {
  event?: string;
  job_id?: string;
  status?: string;
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
  error?: string;
  degradation_reason?: {
    code?: string;
    message?: string;
    detail?: string;
    retryable?: boolean;
  } | null;
  suggestions?: string[];
  deck_id?: string;
  card_count?: number;
  flashcard_preview?: Array<{ front: string; back: string; topic?: string | null }>;
  quiz_preview?: QuizPreview;
  question_count?: number;
  reasoning?: string;
  reasoning_duration_ms?: number;
  tool_calls?: Array<{ tool: string; input?: Record<string, unknown>; result?: string }>;
  attachments?: unknown;
  choices?: Array<{ id: string; label: string }>;
  attachment_names?: string[];
  artifact_id?: string;
  artifact_type?: string;
  artifact_title?: string;
  artifact_preview?: Record<string, unknown>;
  progress_stage?: string;
  progress_label?: string;
  generation_type?: string;
  visualization?: {
    kind: string;
    title: string;
    engine: string;
    caption?: string | null;
    html?: string;
    frames?: Array<{
      array?: number[];
      comparing?: number[];
      swapping?: number[];
      sorted_until?: number | null;
      message?: string;
      html?: string;
    }>;
    initial?: number[];
    final?: number[];
  };
};

export type PrepwiseDataParts = {
  user: ChatMessage;
  message: ChatMessage;
  quiz: {
    quiz: QuizPreview | null;
    quiz_id?: string | null;
    quiz_preview?: unknown;
    question_count?: number;
  };
  flashcards: {
    deck_id?: string;
    flashcard_preview?: Array<{ front: string; back: string; topic?: string | null }>;
    card_count?: number;
  };
  generation: {
    event?: string;
    job_id?: string;
    status?: string;
    progress_stage?: string;
    generation_type?: string;
  };
  "generation-progress": {
    stage?: string;
    label?: string;
    job_id?: string;
  };
  "artifact-choice": {
    event?: string;
    choices?: Array<{ id: string; label: string }>;
    attachment_names?: string[];
  };
  artifact: {
    artifact_id?: string;
    artifact_type?: string;
    artifact_title?: string;
    artifact_preview?: Record<string, unknown>;
  };
  material: {
    event?: string;
    material?: PrepwiseMessageMetadata["material"];
    materials?: PrepwiseMessageMetadata["materials"];
    attachments?: unknown;
    error?: string;
  };
  error: {
    event?: string;
    degradation_reason?: PrepwiseMessageMetadata["degradation_reason"];
    error?: string;
  };
  agent: {
    event?: string;
    agent_id?: string | null;
  };
  visualization: {
    kind: string;
    title: string;
    engine: string;
    caption?: string | null;
    html?: string;
    frames?: Array<{
      array?: number[];
      comparing?: number[];
      swapping?: number[];
      sorted_until?: number | null;
      message?: string;
      html?: string;
    }>;
    initial?: number[];
    final?: number[];
  };
  "thread-title": {
    title: string;
  };
};

export type PrepwiseUIMessage = UIMessage<never, PrepwiseDataParts>;

export type PrepwiseSendBody = {
  model?: string | null;
  llmProvider?: "openai" | "anthropic" | "gemini" | "openrouter" | null;
  professorAgentId?: string | null;
  generationSettings?: Record<string, unknown> | null;
  files?: File[];
  mediaAttachmentIds?: string[];
  artifactType?: string | null;
};

function textPart(text: string) {
  return { type: "text" as const, text };
}

function reasoningPart(text: string) {
  return { type: "reasoning" as const, text, state: "done" as const };
}

export function getMessageText(message: PrepwiseUIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function getMessageMetadata(message: PrepwiseUIMessage): PrepwiseMessageMetadata | null {
  const messagePart = message.parts.find((part) => part.type === "data-message");
  const generationPart = message.parts.find((part) => part.type === "data-generation");

  let metadata: PrepwiseMessageMetadata | null = null;
  if (messagePart && messagePart.type === "data-message") {
    metadata = (messagePart.data.metadata as PrepwiseMessageMetadata | null) ?? null;
  }

  // Live streams often emit data-generation before/without data-message metadata.
  // Merge so job resume + queued→completed sync can see job_id / event.
  if (generationPart && generationPart.type === "data-generation") {
    metadata = {
      ...(metadata ?? {}),
      event: generationPart.data.event ?? metadata?.event,
      job_id: generationPart.data.job_id ?? metadata?.job_id,
      status: generationPart.data.status ?? metadata?.status,
      progress_stage: generationPart.data.progress_stage ?? metadata?.progress_stage,
      generation_type: generationPart.data.generation_type ?? metadata?.generation_type
    };
  }

  if (metadata) return metadata;

  const reasoning = message.parts.find((part) => part.type === "reasoning");
  if (reasoning && reasoning.type === "reasoning" && reasoning.text) {
    return { reasoning: reasoning.text };
  }
  return null;
}

export function apiMessageToUIMessage(message: ChatMessage): PrepwiseUIMessage {
  const metadata = (message.metadata as PrepwiseMessageMetadata | null) ?? null;
  const parts: PrepwiseUIMessage["parts"] = [];

  if (metadata?.reasoning) {
    parts.push(reasoningPart(metadata.reasoning));
  }

  if (message.content) {
    parts.push(textPart(message.content));
  }

  if (message.role === "assistant") {
    if (message.quiz || metadata?.quiz_preview) {
      parts.push({
        type: "data-quiz",
        data: {
          quiz: message.quiz,
          quiz_id: message.quiz_id,
          quiz_preview: metadata?.quiz_preview,
          question_count: metadata?.question_count
        }
      });
    }

    if (metadata?.deck_id || metadata?.flashcard_preview) {
      parts.push({
        type: "data-flashcards",
        data: {
          deck_id: metadata.deck_id,
          flashcard_preview: metadata.flashcard_preview,
          card_count: metadata.card_count
        }
      });
    }

    if (
      metadata?.event === "generation_queued" ||
      metadata?.event === "generation_completed" ||
      metadata?.event === "generation_failed" ||
      metadata?.job_id
    ) {
      parts.push({
        type: "data-generation",
        data: {
          event: metadata.event,
          job_id: metadata.job_id,
          status: metadata.status,
          progress_stage: metadata.progress_stage,
          generation_type: metadata.generation_type
        }
      });
      if (metadata.progress_stage) {
        parts.push({
          type: "data-generation-progress",
          data: {
            stage: metadata.progress_stage,
            label: metadata.progress_label,
            job_id: metadata.job_id
          }
        });
      }
    }

    if (metadata?.event === "artifact_choice" || metadata?.choices?.length) {
      parts.push({
        type: "data-artifact-choice",
        data: {
          event: metadata.event,
          choices: metadata.choices,
          attachment_names: metadata.attachment_names
        }
      });
    }

    if (metadata?.artifact_id || metadata?.artifact_preview) {
      parts.push({
        type: "data-artifact",
        data: {
          artifact_id: metadata.artifact_id,
          artifact_type: metadata.artifact_type,
          artifact_title: metadata.artifact_title,
          artifact_preview: metadata.artifact_preview
        }
      });
    }

    if (
      metadata?.event === "material_attached" ||
      metadata?.event === "material_failed" ||
      metadata?.event === "material_processing" ||
      metadata?.event === "material_queued" ||
      metadata?.material
    ) {
      parts.push({
        type: "data-material",
        data: {
          event: metadata.event,
          material: metadata.material,
          materials: metadata.materials,
          attachments: metadata.attachments,
          error: metadata.error
        }
      });
    }

    if (metadata?.event === "request_failed" || metadata?.degradation_reason) {
      parts.push({
        type: "data-error",
        data: {
          event: metadata.event,
          degradation_reason: metadata.degradation_reason,
          error: metadata.error
        }
      });
    }

    if (metadata?.event === "agent_switched") {
      parts.push({
        type: "data-agent",
        data: {
          event: metadata.event,
          agent_id: metadata.agent_id
        }
      });
    }

    if (metadata?.visualization) {
      parts.push({
        type: "data-visualization",
        data: metadata.visualization
      });
    }

    parts.push({
      type: "data-message",
      data: message
    });
  }

  return {
    id: message.id,
    role: message.role,
    parts
  };
}

export function uiMessagesFromHistory(messages: ChatMessage[]): PrepwiseUIMessage[] {
  return messages.map(apiMessageToUIMessage);
}

export function lastUserText(messages: PrepwiseUIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user") {
      return getMessageText(message);
    }
  }
  return "";
}
