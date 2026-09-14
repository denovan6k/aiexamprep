"use client";

import { useEffect, useState } from "react";

import {
  Message,
  MessageContent
} from "@/components/ai-elements/message";
import { Reasoning, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { KnorvexSplashMark } from "@/components/chat/knorvex-splash";

const thinkingStages = [
  "Reading your question",
  "Finding the right context",
  "Preparing a helpful response"
];

type ChatThinkingProps = {
  message?: string;
  className?: string;
};

function ThinkingLabel({ text }: { text: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <KnorvexSplashMark size={22} />
      <Shimmer as="span" className="text-sm" duration={1.35}>
        {text}
      </Shimmer>
    </div>
  );
}

export function ChatThinking({ message, className }: ChatThinkingProps) {
  const [stage, setStage] = useState(0);
  const rotatingMessage = message ?? thinkingStages[stage];

  useEffect(() => {
    if (message) return;

    const timer = window.setInterval(() => {
      setStage((current) => Math.min(current + 1, thinkingStages.length - 1));
    }, 1800);
    return () => window.clearInterval(timer);
  }, [message]);

  return (
    <Message from="assistant" className={className ?? "mx-auto w-full max-w-3xl px-4 py-2 sm:px-6"}>
      <MessageContent className="w-full max-w-none">
        <Reasoning isStreaming open className="mb-0">
          <ReasoningTrigger className="pointer-events-none w-full cursor-default [&>svg:last-child]:hidden">
            <ThinkingLabel text={rotatingMessage} />
          </ReasoningTrigger>
        </Reasoning>
      </MessageContent>
    </Message>
  );
}

export function ChatThinkingFallback({ message }: { message?: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-background px-4 sm:px-6">
      <ChatThinking message={message} />
    </div>
  );
}

export function InlineChatThinking({ text = "Thinking..." }: { text?: string }) {
  return (
    <Reasoning isStreaming open className="mb-0">
      <ReasoningTrigger className="pointer-events-none w-full cursor-default [&>svg:last-child]:hidden">
        <ThinkingLabel text={text} />
      </ReasoningTrigger>
    </Reasoning>
  );
}
