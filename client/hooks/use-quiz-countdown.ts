"use client";

import { useCallback, useEffect, useState } from "react";

import type { QuizAttempt, QuizSessionContext } from "@/lib/study";

const SYNC_DRIFT_SECONDS = 2;

export function computeSecondsRemaining(deadlineAt: string): number {
  return Math.max(0, Math.floor((new Date(deadlineAt).getTime() - Date.now()) / 1000));
}

export function resolveQuizDeadline(
  attempt: Pick<QuizAttempt, "deadline_at" | "started_at" | "timer_seconds">,
  timerMinutes: number | null,
  sessionContext: Pick<QuizSessionContext, "deadline_at" | "timer_seconds">
): string | null {
  if (attempt.deadline_at) return attempt.deadline_at;
  if (sessionContext.deadline_at) return sessionContext.deadline_at;

  const totalSeconds =
    attempt.timer_seconds ??
    sessionContext.timer_seconds ??
    (timerMinutes && timerMinutes > 0 ? timerMinutes * 60 : null);

  if (!totalSeconds || !attempt.started_at) return null;

  return new Date(new Date(attempt.started_at).getTime() + totalSeconds * 1000).toISOString();
}

export function parseQuizTimerMinutes(config: Record<string, unknown> | null | undefined): number | null {
  const raw = config?.timer_minutes;
  if (typeof raw === "number" && raw > 0) return Math.floor(raw);
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  return null;
}

export function resolveQuizTimerSeconds(
  attempt: Pick<QuizAttempt, "timer_seconds">,
  timerMinutes: number | null,
  sessionContext: Pick<QuizSessionContext, "timer_seconds">
): number | null {
  return (
    attempt.timer_seconds ??
    sessionContext.timer_seconds ??
    (timerMinutes && timerMinutes > 0 ? timerMinutes * 60 : null)
  );
}

type UseQuizCountdownOptions = {
  enabled: boolean;
  deadlineAt: string | null;
  serverSecondsRemaining?: number | null;
  timerSeconds?: number | null;
  startedAt?: string | null;
};

/**
 * Counts down one second at a time locally. Backend values re-align the clock
 * only when drift exceeds a small threshold, so polling does not cause jumps.
 */
export function useQuizCountdown({
  enabled,
  deadlineAt,
  serverSecondsRemaining,
  timerSeconds,
  startedAt
}: UseQuizCountdownOptions): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const computeServerTarget = useCallback((): number | null => {
    if (!enabled) return null;
    if (deadlineAt) return computeSecondsRemaining(deadlineAt);
    if (timerSeconds && startedAt) {
      const fallbackDeadline = new Date(
        new Date(startedAt).getTime() + timerSeconds * 1000
      ).toISOString();
      return computeSecondsRemaining(fallbackDeadline);
    }
    if (deadlineAt === null && serverSecondsRemaining != null) {
      return Math.max(0, serverSecondsRemaining);
    }
    return null;
  }, [enabled, deadlineAt, serverSecondsRemaining, timerSeconds, startedAt]);

  const syncToServer = useCallback(
    (force = false) => {
      const target = computeServerTarget();
      if (target === null) return;

      setSecondsLeft((prev) => {
        if (prev === null) return target;
        if (force || Math.abs(prev - target) > SYNC_DRIFT_SECONDS) return target;
        return prev;
      });
    },
    [computeServerTarget]
  );

  useEffect(() => {
    if (!enabled) {
      setSecondsLeft(null);
      return;
    }

    syncToServer();
  }, [enabled, deadlineAt, serverSecondsRemaining, syncToServer]);

  useEffect(() => {
    if (!enabled) return;

    const intervalId = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 0) return prev === null ? null : 0;
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        syncToServer(true);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enabled, syncToServer]);

  return secondsLeft;
}
