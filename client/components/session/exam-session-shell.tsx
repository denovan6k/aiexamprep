"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ExamSessionShellProps = {
  title: string;
  subtitle?: string;
  modeLabel?: string;
  live?: boolean;
  main: ReactNode;
  sidebar?: ReactNode;
  insight?: ReactNode;
  className?: string;
};

export function ExamSessionShell({
  title,
  subtitle,
  modeLabel,
  live = false,
  main,
  sidebar,
  insight,
  className
}: ExamSessionShellProps) {
  const hasPanels = Boolean(sidebar || insight);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-primary/15 bg-card accent-glow", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-destructive/60" />
          <span className="h-2 w-2 rounded-full bg-warning/70" />
          <span className="h-2 w-2 rounded-full bg-success/70" />
        </div>
        <span className="truncate text-xs text-muted-foreground">{title}</span>
        {subtitle ? <span className="hidden text-xs text-muted-foreground sm:inline">- {subtitle}</span> : null}
        {modeLabel ? (
          <span className="hidden rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
            {modeLabel}
          </span>
        ) : null}
        {live ? (
          <span className="ml-auto hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary sm:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Live session
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "grid gap-px bg-border",
          hasPanels ? "lg:grid-cols-[1fr_200px_200px] lg:items-stretch" : "grid-cols-1"
        )}
      >
        <div className="bg-background">{main}</div>
        {sidebar ? <div className="hidden bg-border lg:block">{sidebar}</div> : null}
        {insight ? <div className="hidden bg-background lg:block">{insight}</div> : null}
      </div>
    </div>
  );
}
