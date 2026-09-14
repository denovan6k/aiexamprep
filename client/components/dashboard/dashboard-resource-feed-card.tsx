"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpen, FileText, Layers } from "lucide-react";

import { ResourceListRow } from "@/components/page-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FeedResourceItem } from "@/lib/core-study";
import { asRoute, cn } from "@/lib/utils";

type DashboardResourceFeedCardProps = {
  item: FeedResourceItem;
  className?: string;
  compact?: boolean;
};

function kindIcon(kind: FeedResourceItem["kind"]) {
  switch (kind) {
    case "quiz":
      return BookOpen;
    case "deck":
      return Layers;
    default:
      return FileText;
  }
}

function kindLabel(kind: FeedResourceItem["kind"]) {
  switch (kind) {
    case "quiz":
      return "Quiz";
    case "deck":
      return "Deck";
    default:
      return "Material";
  }
}

function metaLine(item: FeedResourceItem) {
  const parts: string[] = [item.activity_label];
  if (item.course_title) parts.push(item.course_title);
  if (item.kind === "quiz" && item.meta.question_count) {
    parts.push(`${item.meta.question_count} questions`);
  }
  if (item.kind === "deck" && item.meta.card_count) {
    parts.push(`${item.meta.card_count} cards`);
  }
  if (item.kind === "material" && item.meta.chunk_count) {
    parts.push(`${item.meta.chunk_count} chunks`);
  }
  if (item.meta.status) parts.push(item.meta.status);
  return parts.join(" · ");
}

function actionLabel(kind: FeedResourceItem["kind"]) {
  switch (kind) {
    case "quiz":
      return "Play";
    case "deck":
      return "Study";
    default:
      return "Open";
  }
}

export function DashboardResourceFeedRow({ item }: { item: FeedResourceItem }) {
  const Icon = kindIcon(item.kind);

  return (
    <ResourceListRow
      icon={
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      }
      title={item.title}
      description={item.preview[0] ?? item.meta.file_name ?? undefined}
      meta={metaLine(item)}
      badge={
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {kindLabel(item.kind)}
        </Badge>
      }
      actions={
        <Button asChild size="sm" variant="outline" className="gap-1">
          <Link href={asRoute(item.href)}>
            {actionLabel(item.kind)}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      }
    />
  );
}

export function DashboardResourceFeedCard({ item, className, compact = false }: DashboardResourceFeedCardProps) {
  const Icon = kindIcon(item.kind);

  return (
    <article
      className={cn(
        "flex w-[min(100%,20rem)] shrink-0 flex-col rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md sm:w-auto sm:min-w-[18rem] sm:flex-1",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {kindLabel(item.kind)}
            </Badge>
          </div>
          <h4 className="mt-3 truncate text-base font-medium">{item.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{metaLine(item)}</p>
        </div>
      </div>

      {compact ? (
        <p className="mt-4 truncate text-xs text-muted-foreground">
          {item.meta.file_name ?? item.preview[0] ?? "Uploaded material"}
        </p>
      ) : item.preview.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.preview.map((chip) => (
            <Link
              key={chip}
              href={asRoute(item.href)}
              className="max-w-full truncate rounded-lg border border-border bg-muted/15 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-primary/30 hover:bg-accent/30"
            >
              {chip}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          {item.kind === "material"
            ? item.meta.file_name ?? "Uploaded material"
            : "Open to continue studying"}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button asChild size="sm" className="flex-1">
          <Link href={asRoute(item.href)}>
            {actionLabel(item.kind)}
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
