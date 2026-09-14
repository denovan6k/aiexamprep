"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { asRoute } from "@/lib/utils";

type DashboardFeedSectionProps = {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
  headerAside?: ReactNode;
  children: ReactNode;
};

export function DashboardFeedSection({
  eyebrow,
  title,
  subtitle,
  actionHref,
  actionLabel,
  headerAside,
  children
}: DashboardFeedSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-wider text-primary/80">{eyebrow}</p>
          ) : null}
          <h3 className="mt-1 text-lg font-medium tracking-tight">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerAside}
          {actionHref && actionLabel ? (
            <Button asChild variant="outline" size="sm">
              <Link href={asRoute(actionHref)}>{actionLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}
