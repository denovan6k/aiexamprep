"use client";

import { AlertTriangle, Clock3 } from "lucide-react";

import { cn } from "@/lib/utils";

type QuizCountdownProps = {
  secondsLeft: number;
  timerSeconds: number;
  compact?: boolean;
};

export function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function QuizCountdown({ secondsLeft, timerSeconds, compact = false }: QuizCountdownProps) {
  const progress = timerSeconds > 0 ? Math.max(0, Math.min(100, (secondsLeft / timerSeconds) * 100)) : 0;
  const urgent = secondsLeft <= 60;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums",
          urgent ? "text-destructive" : "text-foreground"
        )}
      >
        {urgent ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
        {formatCountdown(secondsLeft)}
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {urgent ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Clock3 className="h-4 w-4" />}
          <span>Time remaining</span>
        </div>
        <span
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums tracking-tight",
            urgent ? "text-destructive" : "text-foreground"
          )}
        >
          {formatCountdown(secondsLeft)}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-1000 ease-linear",
            urgent ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      {urgent ? (
        <p className="mt-2 text-xs text-destructive">Less than a minute left. Your quiz will submit automatically.</p>
      ) : null}
    </div>
  );
}
