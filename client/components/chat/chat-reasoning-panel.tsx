"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  formatReasoningForDisplay,
  formatThoughtDuration
} from "@/lib/reasoning-display";
import { cn } from "@/lib/utils";

type ChatReasoningPanelProps = {
  reasoning: string;
  isStreaming?: boolean;
  durationSeconds?: number | null;
  className?: string;
};

const VISIBLE_HEAD_STEPS = 2;
const VISIBLE_TAIL_STEPS = 1;

function splitReasoningSteps(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Cursor-style thought stream:
 * muted "Thought for Ns" header, inline prose, collapsible — no card/spinner chrome.
 */
export function ChatReasoningPanel({
  reasoning,
  isStreaming = false,
  durationSeconds = null,
  className
}: ChatReasoningPanelProps) {
  const [open, setOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef<number | null>(null);
  const wasStreamingRef = useRef(isStreaming);

  useEffect(() => {
    if (isStreaming) {
      setOpen(true);
      if (startedAtRef.current == null) {
        startedAtRef.current = Date.now();
      }
      wasStreamingRef.current = true;
      return;
    }
    if (wasStreamingRef.current) {
      setOpen(false);
      setDetailsOpen(false);
      wasStreamingRef.current = false;
    }
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming) return;
    const tick = () => {
      const started = startedAtRef.current ?? Date.now();
      setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming || !open) return;
    bottomRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [reasoning, isStreaming, open]);

  const { text, wasObfuscated } = formatReasoningForDisplay(reasoning, {
    streaming: isStreaming
  });
  const steps = useMemo(() => splitReasoningSteps(text), [text]);
  const resolvedDuration = durationSeconds ?? (elapsed > 0 ? elapsed : null);
  const label = isStreaming
    ? elapsed > 0
      ? `Thinking… ${elapsed}s`
      : "Thinking…"
    : formatThoughtDuration(resolvedDuration);

  const shouldCollapseMiddle =
    !isStreaming && steps.length > VISIBLE_HEAD_STEPS + VISIBLE_TAIL_STEPS + 1;
  const headSteps = shouldCollapseMiddle ? steps.slice(0, VISIBLE_HEAD_STEPS) : steps;
  const tailSteps = shouldCollapseMiddle ? steps.slice(-VISIBLE_TAIL_STEPS) : [];
  const middleSteps = shouldCollapseMiddle
    ? steps.slice(VISIBLE_HEAD_STEPS, steps.length - VISIBLE_TAIL_STEPS)
    : [];
  const hiddenCount = middleSteps.length;

  if (!text && !isStreaming) return null;

  return (
    <div className={cn("mb-3 space-y-1.5", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 text-left text-[13px] text-muted-foreground/80 transition-colors hover:text-muted-foreground"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div className="space-y-2.5 text-[13px] leading-relaxed text-muted-foreground">
          {isStreaming ? (
            <p className="whitespace-pre-wrap break-words">
              {text || (
                <span className="inline-flex items-center gap-1 text-muted-foreground/60">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/50" />
                  <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/50 [animation-delay:120ms]" />
                  <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/50 [animation-delay:240ms]" />
                </span>
              )}
              {text ? (
                <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-muted-foreground/50 align-middle" />
              ) : null}
            </p>
          ) : (
            <>
              {headSteps.map((step, index) => (
                <p key={`head-${index}`} className="whitespace-pre-wrap break-words">
                  {step}
                </p>
              ))}

              {hiddenCount > 0 ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setDetailsOpen((value) => !value)}
                    className="flex items-center gap-1 text-[13px] text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                    aria-expanded={detailsOpen}
                  >
                    <span>
                      {hiddenCount} more step{hiddenCount === 1 ? "" : "s"}
                      {wasObfuscated ? " hidden" : ""}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                        detailsOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {detailsOpen
                    ? middleSteps.map((step, index) => (
                        <p
                          key={`mid-${index}`}
                          className="whitespace-pre-wrap break-words text-muted-foreground/80"
                        >
                          {step}
                        </p>
                      ))
                    : null}
                </div>
              ) : null}

              {tailSteps.map((step, index) => (
                <p key={`tail-${index}`} className="whitespace-pre-wrap break-words">
                  {step}
                </p>
              ))}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      ) : null}
    </div>
  );
}
