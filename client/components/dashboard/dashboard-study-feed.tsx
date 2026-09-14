"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DashboardFeedSection } from "@/components/dashboard/dashboard-feed-section";
import { DashboardResourceFeedRow } from "@/components/dashboard/dashboard-resource-feed-card";
import { ResourceListRow } from "@/components/page-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PagePaginationControls } from "@/components/ui/pagination-controls";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeedResourceItem, StudyFeed } from "@/lib/core-study";
import { pageCount } from "@/lib/pagination";
import { asRoute, cn } from "@/lib/utils";

const RECENT_FEED_PAGE_SIZE = 6;

type RecentKindFilter = "all" | FeedResourceItem["kind"];

const RECENT_KIND_LABELS: Record<RecentKindFilter, string> = {
  all: "recent activity",
  quiz: "quizzes",
  deck: "decks",
  material: "materials"
};

type DashboardStudyFeedProps = {
  feed?: StudyFeed | null;
  firstCourseId?: string | null;
  hideWeakTopics?: boolean;
  isLoading?: boolean;
};

function FeedList({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function RecentKindFilters({
  value,
  onChange,
  counts
}: {
  value: RecentKindFilter;
  onChange: (value: RecentKindFilter) => void;
  counts: Record<RecentKindFilter, number>;
}) {
  const options: { value: RecentKindFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "quiz", label: "Quizzes" },
    { value: "deck", label: "Decks" },
    { value: "material", label: "Materials" }
  ];

  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
          {counts[option.value] > 0 ? ` (${counts[option.value]})` : ""}
        </button>
      ))}
    </div>
  );
}

function PaginatedRecentFeed({ items }: { items: FeedResourceItem[] }) {
  const [kindFilter, setKindFilter] = useState<RecentKindFilter>("all");
  const [page, setPage] = useState(1);

  const kindCounts = useMemo(
    () => ({
      all: items.length,
      quiz: items.filter((item) => item.kind === "quiz").length,
      deck: items.filter((item) => item.kind === "deck").length,
      material: items.filter((item) => item.kind === "material").length
    }),
    [items]
  );

  const filteredItems = useMemo(() => {
    if (kindFilter === "all") return items;
    return items.filter((item) => item.kind === kindFilter);
  }, [items, kindFilter]);

  useEffect(() => {
    setPage(1);
  }, [kindFilter, items.length]);

  useEffect(() => {
    const pages = pageCount(filteredItems.length, RECENT_FEED_PAGE_SIZE);
    if (page > pages) setPage(pages);
  }, [filteredItems.length, page]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * RECENT_FEED_PAGE_SIZE;
    return filteredItems.slice(start, start + RECENT_FEED_PAGE_SIZE);
  }, [filteredItems, page]);

  return (
    <div className="space-y-4">
      <RecentKindFilters value={kindFilter} onChange={setKindFilter} counts={kindCounts} />

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center">
          <p className="text-sm font-medium">No {RECENT_KIND_LABELS[kindFilter]} yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try another filter or generate practice from your materials.
          </p>
          {kindFilter !== "all" ? (
            <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => setKindFilter("all")}>
              Show all activity
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <FeedList>
            {pageItems.map((item) => (
              <DashboardResourceFeedRow key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </FeedList>
          <PagePaginationControls
            total={filteredItems.length}
            page={page}
            pageSize={RECENT_FEED_PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}


function EmptyFeedCard({
  title,
  description,
  actionHref,
  actionLabel
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <Button asChild size="sm" className="mt-4">
        <Link href={asRoute(actionHref)}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

export function DashboardStudyFeed({
  feed,
  firstCourseId,
  hideWeakTopics = false,
  isLoading
}: DashboardStudyFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  const nextExam = feed?.next_exam;
  const examItems = feed?.exam_items ?? [];
  const recentItems = feed?.recent_items ?? [];
  const weakTopics = (feed?.weak_topics ?? []).slice(0, 4);

  return (
    <div className="space-y-8">
      {nextExam ? (
        <DashboardFeedSection
          eyebrow="Your next exam"
          title={`Based on ${nextExam.title}`}
          subtitle={
            nextExam.exam_date
              ? `Exam on ${new Date(nextExam.exam_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })}`
              : "Course-focused practice from your library"
          }
          actionHref={firstCourseId ? `/courses/${nextExam.id}` : "/courses"}
          actionLabel="Open course"
        >
          {examItems.length === 0 ? (
            <EmptyFeedCard
              title="No resources for this course yet"
              description="Upload material or generate a quiz from chat to build your exam prep library."
              actionHref={firstCourseId ? `/chat?course_id=${nextExam.id}` : "/chat"}
              actionLabel="Open chat"
            />
          ) : (
            <FeedList>
              {examItems.slice(0, 4).map((item) => (
                <DashboardResourceFeedRow key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </FeedList>
          )}
        </DashboardFeedSection>
      ) : null}

      <DashboardFeedSection
        eyebrow="Keep studying"
        title="Pick up where you left off"
        subtitle="Sorted by your latest quiz, flashcard, and material activity."
        actionHref="/progress"
        actionLabel="View progress"
      >
        {recentItems.length === 0 ? (
          <EmptyFeedCard
            title="Nothing to resume yet"
            description="Generate a quiz or flashcard deck from your course materials to start building activity."
            actionHref={firstCourseId ? `/chat?course_id=${firstCourseId}` : "/chat"}
            actionLabel="Open chat"
          />
        ) : (
          <PaginatedRecentFeed items={recentItems} />
        )}
      </DashboardFeedSection>

      {!hideWeakTopics ? (
        <DashboardFeedSection
          eyebrow="Worth revisiting"
          title="Strengthen weak topics"
          subtitle="Focus review where your quiz scores are lowest."
          actionHref="/quizzes"
          actionLabel="Browse quizzes"
        >
          {weakTopics.length === 0 ? (
            <EmptyFeedCard
              title="No weak topics flagged yet"
              description="Complete a few quizzes to unlock topic-level recommendations."
              actionHref="/quizzes"
              actionLabel="Take a quiz"
            />
          ) : (
            <div className="space-y-2">
              {weakTopics.map((topic) => (
                <ResourceListRow
                  key={topic.topic}
                  title={topic.topic}
                  meta={
                    <div className="mt-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Quiz score</span>
                        <Badge variant={topic.score_pct < 50 ? "danger" : "warning"}>{topic.score_pct}%</Badge>
                      </div>
                      <Progress value={topic.score_pct} className="h-1.5" />
                    </div>
                  }
                  actions={
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={asRoute(
                          firstCourseId ? `/chat?course_id=${firstCourseId}` : "/chat"
                        )}
                      >
                        Ask in chat
                      </Link>
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </DashboardFeedSection>
      ) : null}

      {feed?.recommendations?.[0] ? (
        <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {feed.recommendations[0]}
        </div>
      ) : null}
    </div>
  );
}
