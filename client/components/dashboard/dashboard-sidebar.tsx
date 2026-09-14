"use client";

import { ArrowUpRight, BookOpen, CalendarDays, Layers, Sparkles } from "lucide-react";
import Link from "next/link";

import { SidebarSection } from "@/components/sidebar/sidebar-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { Course, ProgressOverview } from "@/lib/study";
import { asRoute } from "@/lib/utils";

type DashboardSidebarProps = {
  courses: Course[];
  overview?: ProgressOverview | null;
  flashcardDue?: number;
  flashcardDeckId?: string | null;
  flashcardPreview?: string | null;
  isLoading?: boolean;
};

function daysUntil(date: string) {
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function DashboardSidebar({
  courses,
  overview,
  flashcardDue = 0,
  flashcardDeckId,
  flashcardPreview,
  isLoading
}: DashboardSidebarProps) {
  const upcomingCourses = [...courses]
    .filter((course) => course.exam_date)
    .sort((a, b) => new Date(a.exam_date!).getTime() - new Date(b.exam_date!).getTime())
    .slice(0, 3);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SidebarSection
        title="Progress snapshot"
        description="How your recent practice is trending."
        defaultOpen
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <SidebarMetric label="Mock average" value={`${overview?.average_score ?? 0}%`} tone="success" />
            <SidebarMetric label="Quizzes taken" value={String(overview?.quizzes_taken ?? 0)} />
            <SidebarMetric label="Weak topics" value={String(overview?.weak_topics.length ?? 0)} tone="danger" />
            <SidebarMetric label="Cards due" value={String(flashcardDue)} tone="warning" />
          </div>
          <Progress value={overview?.average_score ?? 0} className="h-2" />
          {overview?.recommendations?.[0] ? (
            <p className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <Sparkles className="mb-1 inline h-3.5 w-3.5 text-primary" />
              {overview.recommendations[0]}
            </p>
          ) : null}
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={asRoute("/progress")}>Open progress</Link>
          </Button>
        </div>
      </SidebarSection>

      <SidebarSection
        title="Flashcards"
        description={
          flashcardDue
            ? `${flashcardDue} cards waiting for review.`
            : "Generate decks or study existing ones to build retention."
        }
        icon={<Layers className="h-4 w-4" />}
        defaultOpen={flashcardDue > 0}
        badge={flashcardDue > 0 ? <Badge variant="secondary">{flashcardDue}</Badge> : undefined}
      >
        <div className="space-y-3">
          {flashcardPreview ? (
            <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm leading-relaxed">
              {flashcardPreview}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {flashcardDeckId ? (
              <Button asChild size="sm" className="gap-2">
                <Link href={asRoute(`/flashcards/${flashcardDeckId}/study`)}>
                  Study now
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href={asRoute("/flashcards")}>All decks</Link>
            </Button>
          </div>
        </div>
      </SidebarSection>

      <SidebarSection
        title="Your courses"
        description="Jump back into a workspace or course chat."
        icon={<BookOpen className="h-4 w-4" />}
        defaultOpen
        contentClassName="flex min-h-0 flex-col"
      >
        <div className="scrollbar-hover max-h-48 space-y-3 overflow-y-auto overscroll-contain">
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a course to organize materials and practice.</p>
          ) : (
            (upcomingCourses.length ? upcomingCourses : courses.slice(0, 3)).map((course) => {
              const days = course.exam_date ? daysUntil(course.exam_date) : null;
              return (
                <Link
                  key={course.id}
                  href={asRoute(`/courses/${course.id}`)}
                  className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/30 hover:bg-accent/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{course.title}</p>
                      {course.exam_date ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {new Date(course.exam_date).toLocaleDateString()}
                          {days !== null ? ` · ${days}d left` : null}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">No exam date set</p>
                      )}
                    </div>
                    {course.confidence_level ? (
                      <Badge variant="outline" className="shrink-0 capitalize">
                        {course.confidence_level}
                      </Badge>
                    ) : null}
                  </div>
                </Link>
              );
            })
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="mt-3 w-full shrink-0">
          <Link href={asRoute("/courses")}>Manage courses</Link>
        </Button>
      </SidebarSection>
    </div>
  );
}

function SidebarMetric({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === "success"
            ? "mt-0.5 text-base font-medium tabular-nums text-success"
            : tone === "warning"
              ? "mt-0.5 text-base font-medium tabular-nums text-warning"
              : tone === "danger"
                ? "mt-0.5 text-base font-medium tabular-nums text-danger"
                : "mt-0.5 text-base font-medium tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  );
}
