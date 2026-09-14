"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, CheckCircle2, Clock3 } from "lucide-react";

import { QuizInsightPanel, QuizSessionSidebar } from "@/components/session/quiz-session-panels";
import { StudySessionLayout } from "@/components/session/study-session-layout";
import { formatCountdown } from "@/components/quiz/quiz-countdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useFlagQuizAnswerMutation,
  useQuizAttemptQuery,
  useQuizSessionContextQuery,
  useSaveQuizAnswerMutation,
  useSubmitQuizAttemptMutation
} from "@/hooks/use-quizzes";
import {
  parseQuizTimerMinutes,
  resolveQuizDeadline,
  resolveQuizTimerSeconds,
  useQuizCountdown
} from "@/hooks/use-quiz-countdown";
import {
  type Quiz,
  type QuizAttempt,
  type QuizSessionContext
} from "@/lib/study";
import { showError } from "@/lib/toast";
import { asRoute, cn } from "@/lib/utils";

type QuizPlayerProps = {
  quiz: Quiz;
  attempt: QuizAttempt;
};

type McqOption = { id?: string; label?: string; text?: string };

const TRUE_FALSE_OPTIONS: McqOption[] = [
  { id: "true", text: "True" },
  { id: "false", text: "False" }
];

function optionLabel(option: McqOption) {
  return option.label ?? option.text ?? option.id ?? "";
}

function resolveEntityId(id: string | undefined | null, fallback: string): string {
  const trimmed = id?.trim();
  return trimmed ? trimmed : fallback;
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const copy = [...items];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  for (let i = copy.length - 1; i > 0; i -= 1) {
    hash = (Math.imul(1664525, hash) + 1013904223) | 0;
    const j = (hash >>> 0) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const emptyContext: QuizSessionContext = {
  agent: null,
  average_score: 0,
  cards_due: 0,
  next_up: null,
  topic_focus: [],
  agent_insight: null,
  answered_count: 0,
  flagged_count: 0,
  correct_count: 0,
  graded_count: 0,
  elapsed_seconds: 0,
  pace_estimate_minutes: null,
  timer_seconds: null,
  seconds_remaining: null,
  timer_expired: false,
  deadline_at: null
};

export function QuizPlayer({ quiz, attempt }: QuizPlayerProps) {
  const router = useRouter();
  const saveAnswerMutation = useSaveQuizAnswerMutation();
  const flagAnswerMutation = useFlagQuizAnswerMutation();
  const submitMutation = useSubmitQuizAttemptMutation();
  const { data: attemptDetail } = useQuizAttemptQuery(attempt.id);
  const config = quiz.config ?? {};
  const timerMinutes = parseQuizTimerMinutes(config);
  const shuffleQuestions = Boolean(config.shuffle_questions);
  const shuffleOptions = config.shuffle_options !== false;
  const modeLabel = timerMinutes ? "Exam mode" : "Practice mode";
  const modeDescription = timerMinutes
    ? "Timed attempt with exam pacing"
    : "Untimed practice with review flags";

  const questions = useMemo(() => {
    const base = [...quiz.questions];
    return shuffleQuestions ? seededShuffle(base, `questions-${attempt.id}`) : base;
  }, [quiz.questions, shuffleQuestions, attempt.id]);

  const shuffledOptionsByQuestion = useMemo(() => {
    const map = new Map<string, McqOption[]>();
    for (const question of quiz.questions) {
      if (question.type === "true_false") {
        map.set(
          question.id,
          shuffleOptions
            ? seededShuffle(TRUE_FALSE_OPTIONS, `options-${attempt.id}-${question.id}`)
            : TRUE_FALSE_OPTIONS
        );
        continue;
      }
      if (Array.isArray(question.options) && question.options.length > 0) {
        map.set(
          question.id,
          shuffleOptions
            ? seededShuffle(question.options, `options-${attempt.id}-${question.id}`)
            : question.options
        );
      }
    }
    return map;
  }, [quiz.questions, shuffleOptions, attempt.id]);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitTriggeredRef = useRef(false);
  const saveTimersRef = useRef<Record<string, number>>({});
  const savePromisesRef = useRef<Record<string, Promise<unknown>>>({});
  const hasHydratedAnswersRef = useRef(false);
  const flagStorageKey = useMemo(() => `quiz-flags:${attempt.id}`, [attempt.id]);

  const question = questions[index];
  const { data: sessionContext = emptyContext } = useQuizSessionContextQuery(attempt.id, {
    refetchInterval: 15_000,
    refetchOnMount: "always"
  });
  const contextDeadlineAt = sessionContext.deadline_at ?? null;
  const contextSecondsRemaining = sessionContext.seconds_remaining ?? null;
  const contextTimerSeconds = sessionContext.timer_seconds ?? null;
  const attemptFromDetail = attemptDetail?.attempt;

  const timerSeconds = useMemo(
    () =>
      resolveQuizTimerSeconds(attempt, timerMinutes, {
        timer_seconds: contextTimerSeconds ?? attemptFromDetail?.timer_seconds ?? null
      }),
    [attempt, timerMinutes, contextTimerSeconds, attemptFromDetail?.timer_seconds]
  );
  const isTimed = Boolean(timerSeconds && timerSeconds > 0);

  const startedAt =
    attempt.started_at ?? attemptFromDetail?.started_at ?? null;

  const deadlineAt = useMemo(() => {
    const resolved = resolveQuizDeadline(
      {
        deadline_at: attempt.deadline_at ?? attemptFromDetail?.deadline_at ?? null,
        started_at: startedAt,
        timer_seconds:
          attempt.timer_seconds ??
          attemptFromDetail?.timer_seconds ??
          contextTimerSeconds ??
          null
      },
      timerMinutes,
      { deadline_at: contextDeadlineAt, timer_seconds: contextTimerSeconds }
    );
    return resolved;
  }, [
    attempt.deadline_at,
    attempt.timer_seconds,
    attemptFromDetail?.deadline_at,
    attemptFromDetail?.timer_seconds,
    contextDeadlineAt,
    contextTimerSeconds,
    startedAt,
    timerMinutes
  ]);

  const serverSecondsRemaining = deadlineAt
    ? null
    : contextSecondsRemaining ?? attempt.seconds_remaining ?? attemptFromDetail?.seconds_remaining ?? null;

  const secondsLeft = useQuizCountdown({
    enabled: isTimed,
    deadlineAt,
    serverSecondsRemaining,
    timerSeconds,
    startedAt
  });
  const answeredCount = questions.filter((item) => {
    const answer = answers[item.id];
    return Array.isArray(answer) ? answer.length > 0 : answer !== undefined && answer !== "";
  }).length;
  const flaggedCount = questions.filter((item) => flagged[item.id]).length;

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem(flagStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        setFlagged(parsed);
      }
    } catch {
      // Ignore corrupt local fallback state.
    }
  }, [flagStorageKey]);

  useEffect(() => {
    if (!attemptDetail) return;

    if (attemptDetail.attempt.status === "submitted") {
      router.replace(asRoute(`/quizzes/attempts/${attemptDetail.attempt.id}/review`));
      return;
    }
    if (hasHydratedAnswersRef.current) return;

    const restoredAnswers: Record<string, unknown> = {};
    const restoredFlags: Record<string, boolean> = {};
    for (const answer of attemptDetail.answers) {
      restoredAnswers[answer.question_id] = answer.answer;
      if (answer.flagged) {
        restoredFlags[answer.question_id] = true;
      }
    }

    setAnswers(restoredAnswers);
    hasHydratedAnswersRef.current = true;
    if (attemptDetail.answers.length > 0) {
      setFlagged(restoredFlags);
      window.localStorage.setItem(flagStorageKey, JSON.stringify(restoredFlags));
    }
  }, [attemptDetail, flagStorageKey, router]);

  const persistAnswer = useCallback(
    (questionId: string, answer: unknown) => {
      const previousSave = savePromisesRef.current[questionId];
      const nextSave = (previousSave ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => saveAnswerMutation.mutateAsync({ attemptId: attempt.id, questionId, answer }));
      savePromisesRef.current[questionId] = nextSave;
      const clearPendingSave = () => {
        if (savePromisesRef.current[questionId] === nextSave) {
          delete savePromisesRef.current[questionId];
        }
      };
      void nextSave.then(clearPendingSave, clearPendingSave);
      return nextSave;
    },
    [attempt.id, saveAnswerMutation]
  );

  const handleSubmit = useCallback(
    async (reason: "manual" | "timer" = "manual") => {
      if (submitMutation.isPending || submitTriggeredRef.current) return;
      submitTriggeredRef.current = true;
      setIsSubmitting(true);
      if (reason === "timer") {
        setIsAutoSubmitting(true);
      }

      try {
        for (const timerId of Object.values(saveTimersRef.current)) {
          window.clearTimeout(timerId);
        }
        saveTimersRef.current = {};
        await Promise.all(
          Object.entries(answers).map(([questionId, answer]) =>
            persistAnswer(questionId, answer)
          )
        );
        const review = await submitMutation.mutateAsync(attempt.id);
        router.replace(asRoute(`/quizzes/attempts/${review.attempt.id}/review`));
      } catch (err) {
        submitTriggeredRef.current = false;
        setIsAutoSubmitting(false);
        setIsSubmitting(false);
        showError(err, "Failed to submit quiz.");
      }
    },
    [answers, attempt.id, persistAnswer, router, submitMutation]
  );

  useEffect(() => {
    if (attempt.timer_expired || sessionContext.timer_expired) {
      void handleSubmit("timer");
    }
  }, [attempt.timer_expired, sessionContext.timer_expired, handleSubmit]);

  useEffect(() => {
    if (!isTimed || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      void handleSubmit("timer");
    }
  }, [isTimed, secondsLeft, handleSubmit]);

  function updateAnswer(questionId: string, answer: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    const existingTimer = saveTimersRef.current[questionId];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }
    saveTimersRef.current[questionId] = window.setTimeout(() => {
      void persistAnswer(questionId, answer);
      delete saveTimersRef.current[questionId];
    }, 500);
  }

  useEffect(
    () => () => {
      for (const timerId of Object.values(saveTimersRef.current)) {
        window.clearTimeout(timerId);
      }
    },
    []
  );

  const toggleFlag = useCallback(
    (questionId: string) => {
      setFlagged((current) => {
        const next = !current[questionId];
        const nextFlags = { ...current, [questionId]: next };
        window.localStorage.setItem(flagStorageKey, JSON.stringify(nextFlags));
        flagAnswerMutation.mutate(
          { attemptId: attempt.id, questionId, flagged: next },
          {
            onError: (err) => {
              setFlagged(current);
              window.localStorage.setItem(flagStorageKey, JSON.stringify(current));
              showError(err, "Failed to update flag.");
            }
          }
        );
        return nextFlags;
      });
    },
    [attempt.id, flagAnswerMutation, flagStorageKey]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) {
        return;
      }
      if (event.key === "ArrowRight" || event.key === "j") {
        event.preventDefault();
        setIndex((value) => Math.min(questions.length - 1, value + 1));
      } else if (event.key === "ArrowLeft" || event.key === "k") {
        event.preventDefault();
        setIndex((value) => Math.max(0, value - 1));
      } else if (event.key === "f") {
        event.preventDefault();
        if (question) toggleFlag(question.id);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [question, questions.length, toggleFlag]);

  function renderOptions() {
    if (!question) return null;

    if (question.type === "matching" && question.options && !Array.isArray(question.options)) {
      const left = question.options.left ?? [];
      const right = question.options.right ?? [];
      const current = (answers[question.id] as Array<{ left: string; right: string }>) ?? [];

      return (
        <div className="space-y-3">
          {left.map((item, leftIndex) => {
            const leftId = resolveEntityId(item.id, `${question.id}-left-${leftIndex}`);
            const selected = current.find((pair) => pair.left === leftId)?.right ?? "";
            return (
              <div key={leftId} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                <p className="text-sm font-medium">{item.text}</p>
                <Select
                  value={selected || "__none__"}
                  onValueChange={(value) => {
                    const next = current.filter((pair) => pair.left !== leftId);
                    if (value !== "__none__") {
                      next.push({ left: leftId, right: value });
                    }
                    updateAnswer(question.id, next);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select match" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select match</SelectItem>
                    {right.map((option, rightIndex) => {
                      const rightId = resolveEntityId(option.id, `${question.id}-right-${rightIndex}`);
                      return (
                        <SelectItem key={rightId} value={rightId}>
                          {option.text}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      );
    }

    if (question.type === "short_answer" || question.type === "theory") {
      return (
        <Textarea
          className="min-h-28"
          value={String(answers[question.id] ?? "")}
          onChange={(event) => updateAnswer(question.id, event.target.value)}
          placeholder="Type your answer..."
        />
      );
    }

    const storedOptions = shuffledOptionsByQuestion.get(question.id);
    const options =
      question.type === "true_false"
        ? storedOptions?.length
          ? storedOptions
          : TRUE_FALSE_OPTIONS
        : storedOptions ?? [];

    return (
      <div
        className={cn(
          "grid gap-2.5",
          options.length >= 2 ? "md:grid-cols-2" : "grid-cols-1"
        )}
      >
        {options.map((option, optionIndex) => {
          const optionId = resolveEntityId(option.id, `${question.id}-option-${optionIndex}`);
          const selected = answers[question.id];
          const isSelected =
            question.type === "multi_select"
              ? Array.isArray(selected) && selected.includes(optionId)
              : selected === optionId;

          return (
            <button
              key={optionId}
              type="button"
              onClick={() => {
                if (question.type === "multi_select") {
                  const current = Array.isArray(selected) ? [...selected] : [];
                  const next = current.includes(optionId)
                    ? current.filter((item) => item !== optionId)
                    : [...current, optionId];
                  updateAnswer(question.id, next);
                } else {
                  updateAnswer(question.id, optionId);
                }
              }}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg px-3.5 py-3 text-left text-sm transition-colors",
                isSelected
                  ? "bg-accent font-medium text-foreground ring-2 ring-primary/50"
                  : "bg-muted/30 text-muted-foreground ring-1 ring-border hover:bg-muted/50"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-background ring-1 ring-border"
                )}
              >
                {String.fromCharCode(65 + optionIndex)}
              </span>
              <span className="pt-0.5 text-foreground">{optionLabel(option)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (!question) {
    return (
      <div className="rounded-xl bg-card p-6 ring-1 ring-border">
        <p className="text-sm font-medium">This quiz has no questions yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Return to setup and regenerate questions before starting the session.
        </p>
      </div>
    );
  }

  if (isAutoSubmitting) {
    return (
      <div className="rounded-xl bg-card p-8 text-center ring-1 ring-border">
        <Clock3 className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-base font-medium">Time&apos;s up</p>
        <p className="mt-1 text-sm text-muted-foreground">Submitting your answers...</p>
      </div>
    );
  }

  return (
    <StudySessionLayout
      title={quiz.title}
      subtitle={modeDescription}
      backHref={asRoute("/quizzes")}
      backLabel="All quizzes"
      headerExtra={
        <>
          <Badge variant="outline">{modeLabel}</Badge>
          {isTimed ? (
            <Badge
              variant={secondsLeft !== null && secondsLeft <= 60 ? "danger" : "secondary"}
              className="gap-1.5 font-mono tabular-nums"
            >
              <Clock3 className="h-3.5 w-3.5" />
              {secondsLeft !== null ? formatCountdown(secondsLeft) : "--:--"}
            </Badge>
          ) : null}
        </>
      }
      aside={
        <div className="flex flex-col gap-4">
          <QuizSessionSidebar
            context={sessionContext}
            questionIndex={index}
            totalQuestions={questions.length}
            isTimed={isTimed}
            secondsLeft={secondsLeft}
            timerSeconds={timerSeconds}
            answeredCount={answeredCount}
            flaggedCount={flaggedCount}
          />
          <QuizInsightPanel context={sessionContext} />
        </div>
      }
    >
      <div className="rounded-xl bg-card p-5 ring-1 ring-border sm:p-6">
        {isTimed ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary/5 px-4 py-3 ring-1 ring-inset ring-primary/20 lg:hidden">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock3 className="h-4 w-4 text-primary" />
              Time remaining
            </div>
            <span
              className={cn(
                "font-mono text-2xl font-semibold tabular-nums",
                secondsLeft !== null && secondsLeft <= 60 ? "text-destructive" : "text-foreground"
              )}
            >
              {secondsLeft !== null ? formatCountdown(secondsLeft) : "--:--"}
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Question {index + 1} of {questions.length} · {answeredCount} answered
          </p>
          <Button
            type="button"
            size="sm"
            variant={flagged[question.id] ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => toggleFlag(question.id)}
          >
            <Bookmark className="h-3.5 w-3.5" />
            {flagged[question.id] ? "Flagged" : "Flag"}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{question.type.replace("_", " ")}</Badge>
          {question.topic ? <Badge variant="secondary">{question.topic}</Badge> : null}
        </div>

        <p className="mt-4 text-lg font-medium leading-relaxed">{question.prompt}</p>
        <div className="mt-5">{renderOptions()}</div>

        <div className="mt-6 border-t border-border pt-4">
          <div className="mb-4 flex flex-nowrap gap-1.5 overflow-x-auto pb-1">
            {questions.map((item, itemIndex) => {
              const answer = answers[item.id];
              const answered = Array.isArray(answer)
                ? answer.length > 0
                : answer !== undefined && answer !== "";
              const questionKey = resolveEntityId(item.id, `question-${itemIndex}`);
              return (
                <button
                  key={questionKey}
                  type="button"
                  onClick={() => setIndex(itemIndex)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-xs transition-colors",
                    itemIndex === index
                      ? "bg-primary text-primary-foreground"
                      : flagged[item.id]
                        ? "bg-warning/10 text-warning ring-1 ring-warning/40"
                        : answered
                          ? "bg-success/10 text-success ring-1 ring-success/30"
                          : "text-muted-foreground ring-1 ring-border hover:bg-muted"
                  )}
                  aria-label={`Go to question ${itemIndex + 1}`}
                >
                  {answered && itemIndex !== index ? <CheckCircle2 className="h-3.5 w-3.5" /> : itemIndex + 1}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={index === 0}
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
            >
              Previous
            </Button>
            {index < questions.length - 1 ? (
              <Button type="button" size="sm" className="sm:ml-auto" onClick={() => setIndex((value) => value + 1)}>
                Next
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="sm:ml-auto"
                onClick={() => void handleSubmit("manual")}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit quiz"}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-start">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href={asRoute("/quizzes")}>
            <ArrowLeft className="h-4 w-4" />
            Back to quizzes
          </Link>
        </Button>
      </div>
    </StudySessionLayout>
  );
}
