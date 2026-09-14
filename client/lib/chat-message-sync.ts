import type { ChatMessage } from "@/lib/chat";
import { getMessageMetadata, type PrepwiseUIMessage } from "@/lib/chat-ui-message";

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

function isServerGenerationComplete(serverMessage: ChatMessage): boolean {
  const metadata = serverMessage.metadata;
  if (!metadata) return false;
  if (metadata.event === "generation_completed" || metadata.event === "generation_failed") {
    return true;
  }
  if (serverMessage.quiz_id) return true;

  const extended = metadata as { deck_id?: string; artifact_id?: string };
  return Boolean(extended.deck_id || extended.artifact_id);
}

function hasStaleQueuedGeneration(
  localMessages: PrepwiseUIMessage[],
  serverMessages: ChatMessage[]
): boolean {
  const serverById = new Map(serverMessages.map((message) => [message.id, message]));
  const serverByJobId = new Map<string, ChatMessage>();
  for (const message of serverMessages) {
    const jobId = message.metadata?.job_id;
    if (typeof jobId === "string" && jobId) {
      serverByJobId.set(jobId, message);
    }
  }

  for (const localMessage of localMessages) {
    const metadata = getMessageMetadata(localMessage);
    if (metadata?.event !== "generation_queued") continue;

    const byId = serverById.get(localMessage.id);
    if (byId && isServerGenerationComplete(byId)) {
      return true;
    }

    const jobId = metadata.job_id;
    if (jobId) {
      const byJob = serverByJobId.get(jobId);
      if (byJob && isServerGenerationComplete(byJob)) {
        return true;
      }
    }
  }

  return false;
}

export function shouldApplyServerMessages(options: {
  isStreaming: boolean;
  status: ChatStatus;
  localMessages: PrepwiseUIMessage[];
  serverMessages: ChatMessage[];
}): boolean {
  if (options.isStreaming) return false;

  if (hasStaleQueuedGeneration(options.localMessages, options.serverMessages)) {
    return true;
  }

  // After a stream parse error, prefer server history once it catches up — the
  // local assistant turn may be blank while the API already persisted the reply.
  if (options.status === "error") {
    return options.serverMessages.length >= options.localMessages.length;
  }

  // Keep optimistic / just-streamed turns. Applying a shorter stale cache was
  // wiping the user + assistant until a hard refresh.
  if (options.localMessages.length > options.serverMessages.length) {
    return false;
  }

  return true;
}
