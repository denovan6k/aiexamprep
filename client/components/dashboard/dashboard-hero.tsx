"use client";

import { CalendarDays } from "lucide-react";

import { AdjustDailyGoalDialog } from "@/components/dashboard/adjust-daily-goal-dialog";
import { QuickStartDialog } from "@/components/dashboard/quick-start-dialog";
import { RefreshPlanDialog } from "@/components/dashboard/refresh-plan-dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type DashboardHeroProps = {
  userName?: string | null;
  studyGoal?: string | null;
  dailyMinutes: number;
  completedMinutes: number;
  completedTasks: number;
  totalTasks: number;
  nextExamTitle?: string | null;
  nextExamDate?: string | null;
  firstCourseId?: string | null;
  flashcardDeckId?: string | null;
  isRefreshing?: boolean;
  onRefresh: () => void | Promise<void>;
};

function formatDisplayDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString("en-US", options);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(fullName?: string | null) {
  if (!fullName?.trim()) return "there";
  return fullName.trim().split(/\s+/)[0];
}

export function DashboardHero({
  userName,
  studyGoal,
  dailyMinutes,
  completedMinutes,
  completedTasks,
  totalTasks,
  nextExamTitle,
  nextExamDate,
  firstCourseId,
  flashcardDeckId,
  isRefreshing,
  onRefresh
}: DashboardHeroProps) {
  const progressPct = dailyMinutes ? Math.min(100, Math.round((completedMinutes / dailyMinutes) * 100)) : 0;
  const today = formatDisplayDate(new Date(), {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  return (
    <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-primary/80">Today · {today}</p>
          <div>
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
              {greeting()}, {firstName(userName)}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {studyGoal?.trim() ||
                "Your plan surfaces the highest-impact tasks from exams, flashcards, and weak quiz topics."}
            </p>
          </div>
          {nextExamTitle && nextExamDate ? (
            <p className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              Next exam: <span className="font-medium text-foreground">{nextExamTitle}</span> ·{" "}
              {formatDisplayDate(new Date(nextExamDate), {
                month: "short",
                day: "numeric",
                year: "numeric"
              })}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <QuickStartDialog firstCourseId={firstCourseId} flashcardDeckId={flashcardDeckId} />
          <AdjustDailyGoalDialog currentMinutes={dailyMinutes} />
          <RefreshPlanDialog isPending={isRefreshing} onConfirm={onRefresh} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/70 bg-background/80 p-3 backdrop-blur-sm sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Daily progress</p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {completedMinutes}/{dailyMinutes} min · {completedTasks}/{totalTasks} tasks
            </p>
          </div>
          <Progress value={progressPct} className="mt-2 h-2" />
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center gap-3 rounded-lg border border-border/70 px-3 py-2",
            progressPct >= 100 && "border-success/30 bg-success/5"
          )}
        >
          <p className="text-2xl font-medium tabular-nums">{progressPct}%</p>
          <p className="text-xs text-muted-foreground">of today&apos;s target</p>
        </div>
      </div>
    </section>
  );
}
