import { DefaultChatTransport } from "ai";

import { API_BASE_URL } from "@/lib/api";
import { normalizeProfessorAgentId } from "@/lib/chat";
import type { PrepwiseSendBody, PrepwiseUIMessage } from "@/lib/chat-ui-message";
import { lastUserText } from "@/lib/chat-ui-message";

type TransportRefs = {
  getToken: () => string | null;
  getThreadId: () => string | null;
};

function streamUrl(threadId: string) {
  return `${API_BASE_URL}/chat/threads/${threadId}/messages/stream`;
}

function attachmentsUrl(threadId: string) {
  return `${API_BASE_URL}/chat/threads/${threadId}/messages/stream-with-attachments`;
}

export function createPrepwiseChatTransport(refs: TransportRefs) {
  return new PrepwiseChatTransport(refs);
}

class PrepwiseChatTransport extends DefaultChatTransport<PrepwiseUIMessage> {
  private refs: TransportRefs;

  constructor(refs: TransportRefs) {
    super({
      api: `${API_BASE_URL}/chat/threads/placeholder/messages/stream`,
      prepareSendMessagesRequest: ({ messages, body, headers, credentials }) => {
        const threadId = refs.getThreadId();
        if (!threadId) {
          throw new Error("No active chat thread.");
        }
        const sendBody = (body ?? {}) as PrepwiseSendBody;
        return {
          api: streamUrl(threadId),
          headers,
          credentials,
          body: {
            content: lastUserText(messages),
            model: sendBody.model ?? null,
            llm_provider: sendBody.llmProvider ?? null,
            professor_agent_id: normalizeProfessorAgentId(sendBody.professorAgentId),
            generation_settings: sendBody.generationSettings ?? null,
            media_attachment_ids: sendBody.mediaAttachmentIds ?? [],
            artifact_type: sendBody.artifactType ?? null
          }
        };
      }
    });
    this.refs = refs;
  }

  async sendMessages(options: Parameters<DefaultChatTransport<PrepwiseUIMessage>["sendMessages"]>[0]) {
    const sendBody = (options.body ?? {}) as PrepwiseSendBody;
    const files = sendBody.files;
    if (!files?.length) {
      return super.sendMessages(options);
    }

    const threadId = this.refs.getThreadId();
    const token = this.refs.getToken();
    if (!threadId) {
      throw new Error("No active chat thread.");
    }
    if (!token) {
      throw new Error("You need to sign in again.");
    }

    const form = new FormData();
    form.append("content", lastUserText(options.messages));
    const professorAgentId = normalizeProfessorAgentId(sendBody.professorAgentId);
    if (professorAgentId) {
      form.append("professor_agent_id", professorAgentId);
    }
    if (sendBody.model) {
      form.append("model", sendBody.model);
    }
    if (sendBody.llmProvider) {
      form.append("llm_provider", sendBody.llmProvider);
    }
    if (sendBody.generationSettings) {
      form.append("generation_settings", JSON.stringify(sendBody.generationSettings));
    }
    for (const file of files) {
      form.append("files", file);
    }

    const response = await fetch(attachmentsUrl(threadId), {
      method: "POST",
      body: form,
      signal: options.abortSignal
    });

    if (!response.ok) {
      throw new Error((await response.text()) || "Failed to send chat attachments.");
    }
    if (!response.body) {
      throw new Error("The response body is empty.");
    }

    return this.processResponseStream(response.body);
  }

  async reconnectToStream() {
    return null;
  }
}
