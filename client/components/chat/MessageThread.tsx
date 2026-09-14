"use client";

import React from "react";
import { ChatMessage as ChatMessageComponent } from "@/components/chat/chat-message";
import { MediaAttachmentCard } from "@/components/chat/MediaAttachmentCard";
import type { ChatMessage, MediaAttachment } from "@/lib/chat";
import { cn } from "@/lib/utils";

export type MessageThreadProps = {
  messages: ChatMessage[];
  isStreaming?: boolean;
  className?: string;
};

export function MessageThread({ messages, isStreaming = false, className }: MessageThreadProps) {
  return (
    <div className={cn("space-y-4 py-4", className)}>
      {messages.map((msg, idx) => {
        const attachments = msg.attachments || msg.media_attachments || msg.metadata?.attachments || [];
        const isLast = idx === messages.length - 1;
        const streamingThis = isStreaming && isLast && msg.role === "assistant";

        return (
          <div key={msg.id || idx} className="space-y-2">
            <ChatMessageComponent message={msg} streamContent={streamingThis} />
            {attachments.length > 0 && (
              <div className="mx-auto flex max-w-3xl flex-wrap gap-2 px-4 sm:px-6">
                {attachments.map((att: MediaAttachment) => (
                  <MediaAttachmentCard key={att.id || att.filename} attachment={att} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MessageThread;
