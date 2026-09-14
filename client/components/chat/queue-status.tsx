"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { KnorvexSplashMark } from "@/components/chat/knorvex-splash";
import { Message, MessageAvatar } from "@/components/ui/message";
import type { GenerationJob } from "@/lib/jobs";
import { siteConfig } from "@/lib/site";
import { showError } from "@/lib/toast";
import { cn } from "@/lib/utils";

type QueueStatusProps = {
  job: GenerationJob | null;
  className?: string;
  onDismiss?: () => void;
};

const STAGES = [
  { id: "understanding", label: "Understanding request" },
  { id: "reading_material", label: "Reading material" },
  { id: "generating", label: "Building it" },
  { id: "persisting", label: "Saving results" }
] as const;

function artifactNoun(job: GenerationJob): string {
  if (job.job_type === "flashcard_generation") return "flashcards";
  if (job.job_type === "study_artifact_generation") return "study material";
  return "quiz";
}

function failureLabel(job: GenerationJob): string {
  if (job.job_type === "flashcard_generation") return "Flashcard";
  if (job.job_type === "study_artifact_generation") return "Study artifact";
  return "Quiz";
}

function stageIndex(job: GenerationJob): number {
  if (job.status === "queued") return 0;
  const index = STAGES.findIndex((stage) => stage.id === job.progress_stage);
  if (index >= 0) return index;
  if (job.status === "running") return 2;
  return 0;
}

function statusLabel(job: GenerationJob): string {
  if (job.status === "queued") {
    return `Preparing your ${artifactNoun(job)}`;
  }
  const index = stageIndex(job);
  return STAGES[index]?.label ?? `Generating your ${artifactNoun(job)}`;
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-2.5 overflow-hidden rounded-full bg-muted/70",
        className
      )}
    >
      <div className="h-full w-full animate-[shimmer_1.8s_infinite_linear] bg-[linear-gradient(90deg,transparent,hsl(var(--foreground)/0.08),transparent)] bg-[length:200%_100%]" />
    </div>
  );
}

function ArtifactSkeleton({ jobType }: { jobType: GenerationJob["job_type"] }) {
  const isFlashcards = jobType === "flashcard_generation";
  const isArtifact = jobType === "study_artifact_generation";

  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <SkeletonLine className="h-3 w-2/5" />
        <SkeletonLine className="h-6 w-20 rounded-full" />
      </div>
      {isFlashcards ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
            <SkeletonLine className="w-3/4" />
            <SkeletonLine className="w-1/2" />
          </div>
          <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
            <SkeletonLine className="w-2/3" />
            <SkeletonLine className="w-4/5" />
          </div>
        </div>
      ) : isArtifact ? (
        <div className="space-y-2">
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-11/12" />
          <SkeletonLine className="w-4/5" />
          <SkeletonLine className="w-2/3" />
        </div>
      ) : (
        <div className="space-y-2">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5"
            >
              <div className="size-4 shrink-0 rounded-full bg-muted" />
              <SkeletonLine className={row === 1 ? "w-3/5" : "w-4/5"} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function useProgressPercent(job: GenerationJob | null) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    setElapsedMs(0);
    const started = Date.now();
    const timer = window.setInterval(() => setElapsedMs(Date.now() - started), 180);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status, job?.progress_stage]);

  return useMemo(() => {
    if (!job) return 0;
    const index = stageIndex(job);
    const floors = [8, 24, 48, 76];
    const ceilings = [22, 46, 74, 92];
    const floor = floors[index] ?? 8;
    const ceiling = ceilings[index] ?? 92;
    const crawl = Math.min(ceiling - floor - 1, Math.floor(elapsedMs / 420));
    if (job.status === "queued") {
      return Math.min(18, 6 + Math.floor(elapsedMs / 700));
    }
    return Math.min(ceiling, floor + crawl);
  }, [elapsedMs, job]);
}

export function QueueStatus({ job, className, onDismiss }: QueueStatusProps) {
  const lastFailedJobId = useRef<string | null>(null);
  const percent = useProgressPercent(job);

  useEffect(() => {
    if (!job || job.status !== "failed" || lastFailedJobId.current === job.id) return;
    lastFailedJobId.current = job.id;
    showError(
      job.error_message ?? `${failureLabel(job)} generation failed. Please try again.`
    );
  }, [job]);

  if (!job || job.status === "completed") {
    return null;
  }

  const failed = job.status === "failed";
  const currentStage = stageIndex(job);
  const noun = artifactNoun(job);

  return (
    <Message className={cn("bg-transparent px-3 py-2 sm:px-6", className)}>
      <MessageAvatar
        src=""
        alt={siteConfig.name}
        fallback="KV"
        className="shrink-0 border border-border bg-card text-foreground"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">{siteConfig.name}</p>
        {failed ? (
          <div className="overflow-hidden rounded-2xl border border-destructive/30 bg-card p-3 shadow-sm sm:p-4">
            <p className="text-sm text-destructive">
              {job.error_message ??
                `${failureLabel(job)} generation failed. Please try again.`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Send the request again when you are ready.
            </p>
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="mt-2 text-xs text-muted-foreground underline underline-offset-2"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 bg-muted/30 px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                <KnorvexSplashMark size={22} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <Shimmer as="p" className="truncate text-sm font-medium" duration={1.4}>
                    {statusLabel(job)}
                  </Shimmer>
                  <p className="text-xs text-muted-foreground">This usually takes a moment.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-3 sm:space-y-4 sm:p-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Progress</span>
                  <span className="tabular-nums">{percent}%</span>
                </div>
                <div
                  className="relative h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-label={`Generating ${noun}`}
                >
                  <div
                    className="h-full rounded-full bg-foreground/80 transition-[width] duration-500 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                  <div className="pointer-events-none absolute inset-0 animate-[shimmer_1.6s_infinite_linear] bg-[linear-gradient(90deg,transparent,hsl(var(--background)/0.35),transparent)] bg-[length:200%_100%]" />
                </div>
              </div>

              <ol className="grid grid-cols-1 gap-1.5 min-[400px]:grid-cols-2 md:grid-cols-4">
                {STAGES.map((stage, index) => {
                  const done = index < currentStage;
                  const active = index === currentStage;
                  return (
                    <li
                      key={stage.id}
                      className={cn(
                        "flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] leading-tight sm:text-xs",
                        done && "text-foreground",
                        active && "bg-muted/60 text-foreground",
                        !done && !active && "text-muted-foreground/70"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full border",
                          done && "border-foreground/40 bg-foreground text-background",
                          active && "border-foreground/50 bg-background",
                          !done && !active && "border-border"
                        )}
                      >
                        {done ? (
                          <Check className="size-2.5" />
                        ) : active ? (
                          <span className="size-1.5 animate-pulse rounded-full bg-foreground" />
                        ) : null}
                      </span>
                      <span className="truncate">{stage.label.replace(" request", "")}</span>
                    </li>
                  );
                })}
              </ol>

              <ArtifactSkeleton jobType={job.job_type} />
            </div>
          </div>
        )}
      </div>
    </Message>
  );
}
