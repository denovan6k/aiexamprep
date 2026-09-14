"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Brain,
  Check,
  Clock,
  Clock3,
  Flag,
  Layers3,
  Sparkles,
  Target
} from "lucide-react";

import { formatCountdown } from "@/components/quiz/quiz-countdown";
import { SidebarSection } from "@/components/sidebar/sidebar-section";
import type { QuizSessionContext } from "@/lib/study";
import { asRoute, cn } from "@/lib/utils";

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatTopicLabel(topic: string) {
  return topic.replace(/^\s*\d+\s*[-_.:]\s*/, "").trim() || topic;
}

type QuizSessionSidebarProps = {
  context: QuizSessionContext;
  questionIndex: number;
  totalQuestions: number;
  isTimed?: boolean;
  secondsLeft?: number | null;
  timerSeconds?: number | null;
  answeredCount?: number;
  flaggedCount?: number;
};

export function QuizSessionSidebar({
  context,
  questionIndex,
  totalQuestions,
  isTimed = false,
  secondsLeft = null,
  timerSeconds = null,
  answeredCount = context.answered_count,
  flaggedCount = context.flagged_count
}: QuizSessionSidebarProps) {
  const progressPct = totalQuestions ? Math.round(((questionIndex + 1) / totalQuestions) * 100) : 0;
  const completionPct = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const averageScore = Math.max(0, Math.min(100, Math.round(context.average_score)));
  const timeProgressPct =
    isTimed && secondsLeft !== null && timerSeconds
      ? Math.max(0, Math.min(100, (secondsLeft / timerSeconds) * 100))
      : null;
  const urgent = isTimed && secondsLeft !== null && secondsLeft <= 60;

  return (
    <div className="flex flex-col gap-4">
      <SidebarSection
        title={context.agent ? "Professor agent" : "Practice mode"}
        icon={<Brain className="h-4 w-4" />}
        defaultOpen
        contentClassName="space-y-3 px-3 py-3"
      >
        {context.agent ? (
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-card to-card p-4">
            <p className="truncate text-sm font-semibold">{context.agent.name}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
              {context.agent.style_summary ?? context.agent.subject_area ?? "Exam session"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Add a professor for tailored review insights.</p>
            <Link
              href={asRoute("/agents")}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
            >
              Choose an agent
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/35 p-3 ring-1 ring-inset ring-border/60">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="h-3 w-3 text-primary" />
              Quiz average
            </div>
            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{averageScore}%</p>
          </div>
          <div className="rounded-lg bg-muted/35 p-3 ring-1 ring-inset ring-border/60">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers3 className="h-3 w-3 text-primary" />
              Cards due
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <p className="text-xl font-semibold tracking-tight tabular-nums">{context.cards_due}</p>
              {context.cards_due === 0 ? <Check className="h-3.5 w-3.5 text-success" /> : null}
            </div>
          </div>
        </div>

        {context.next_up ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">Next review</p>
            <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed">{context.next_up.label}</p>
            <Link
              href={asRoute(`/flashcards/${context.next_up.deck_id}/study`)}
              className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
            >
              <BookOpen className="h-3 w-3" />
              Start flashcard review
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs text-muted-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10 text-success">
              <Check className="h-3.5 w-3.5" />
            </span>
            No flashcard review is due
          </div>
        )}
      </SidebarSection>

      {isTimed ? (
        <SidebarSection
          title="Timer"
          icon={urgent ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Clock3 className="h-4 w-4" />}
          defaultOpen
          contentClassName="p-0"
        >
          <div className="rounded-lg bg-primary/5 p-3 ring-1 ring-inset ring-primary/20">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground">Time remaining</span>
              <span
                className={cn(
                  "font-mono text-xl font-semibold tabular-nums tracking-tight",
                  urgent ? "text-destructive" : "text-foreground"
                )}
              >
                {secondsLeft !== null ? formatCountdown(secondsLeft) : "--:--"}
              </span>
            </div>
            {timeProgressPct !== null ? (
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-1000 ease-linear",
                    urgent ? "bg-destructive" : "bg-primary"
                  )}
                  style={{ width: `${timeProgressPct}%` }}
                />
              </div>
            ) : null}
            {urgent ? (
              <p className="mt-2 text-[10px] leading-relaxed text-destructive">
                Less than a minute left. Your quiz will submit automatically.
              </p>
            ) : (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Elapsed {formatElapsed(context.elapsed_seconds)} · auto-submit when time runs out
              </p>
            )}
          </div>
        </SidebarSection>
      ) : null}

      <SidebarSection title="Session progress" icon={<Target className="h-4 w-4" />} defaultOpen>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {!isTimed ? (
              <span className="flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatElapsed(context.elapsed_seconds)}
              </span>
            ) : (
              <span className="text-[10px] tabular-nums text-muted-foreground">
                Q {questionIndex + 1}/{totalQuestions}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-end justify-between">
              <span className="text-xs font-medium">
                Question {questionIndex + 1} of {totalQuestions}
              </span>
              <span className="text-lg font-semibold tracking-tight tabular-nums text-primary">{progressPct}%</span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Current quiz position"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPct}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--accent-glow))] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/30 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground">Answered</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {answeredCount}<span className="font-normal text-muted-foreground">/{totalQuestions}</span>
              </p>
            </div>
            <div className="rounded-lg bg-warning/5 px-3 py-2.5">
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Flag className="h-3 w-3 text-warning" />
                Flagged
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-warning">{flaggedCount}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
            <span>{completionPct}% answered</span>
            {context.pace_estimate_minutes ? (
              <span>
                Est. <span className="font-medium text-foreground">~{context.pace_estimate_minutes} min left</span>
              </span>
            ) : null}
          </div>
        </div>
      </SidebarSection>
    </div>
  );
}

type QuizInsightPanelProps = {
  context: QuizSessionContext;
};

export function QuizInsightPanel({ context }: QuizInsightPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <SidebarSection title="Topic focus" icon={<Sparkles className="h-4 w-4" />} defaultOpen>
        <p className="mb-3 text-[10px] leading-relaxed text-muted-foreground">
          Lowest-scoring topics from completed quizzes
        </p>
        <div className="space-y-3">
          {context.topic_focus.length ? (
            context.topic_focus.map((topic, index) => {
              const score = Math.max(0, Math.min(100, topic.score_pct));
              const topicLabel = formatTopicLabel(topic.topic);
              return (
                <div key={topic.topic?.trim() ? topic.topic : `topic-${index}`}>
                  <div className="flex items-center justify-between gap-3 text-[10px]">
                    <span className="truncate font-medium text-foreground">{topicLabel}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{score}%</span>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`${topicLabel} score`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={score}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--accent-glow))] transition-all duration-700"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Complete a quiz to build your topic accuracy history.
              </p>
            </div>
          )}
        </div>
      </SidebarSection>

      {context.agent_insight ? (
        <SidebarSection title="Agent insight" icon={<Brain className="h-4 w-4" />} defaultOpen={false}>
          <p className="text-[10px] leading-relaxed text-muted-foreground">{context.agent_insight}</p>
        </SidebarSection>
      ) : null}
    </div>
  );
}
