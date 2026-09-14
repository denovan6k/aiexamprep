import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

type StudySessionLayoutProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function StudySessionLayout({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  headerExtra,
  children,
  aside,
  className
}: StudySessionLayoutProps) {
  return (
    <div className={cn("mx-auto w-full space-y-4", aside ? "max-w-7xl" : "max-w-5xl", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          ) : null}
          <div>
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {headerExtra ? <div className="flex max-w-full flex-wrap items-center gap-2">{headerExtra}</div> : null}
      </div>

      <div
        className={cn(
          "grid items-start gap-5",
          aside
            ? "lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]"
            : "grid-cols-1"
        )}
      >
        <div className="min-w-0">{children}</div>
        {aside ? <aside className="min-w-0 lg:sticky lg:top-4">{aside}</aside> : null}
      </div>
    </div>
  );
}
