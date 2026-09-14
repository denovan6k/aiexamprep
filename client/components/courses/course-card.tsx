"use client";

import {
  CalendarDays,
  GraduationCap,
  MessageSquare,
  Search,
  Sparkles
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { Course } from "@/lib/study";
import { asRoute, cn } from "@/lib/utils";

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function examLabel(examDate: string) {
  const days = daysUntil(examDate);
  if (days < 0) return "Exam passed";
  if (days === 0) return "Exam today";
  if (days === 1) return "Exam tomorrow";
  if (days <= 14) return `${days} days to exam`;
  return new Date(examDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

const confidenceTone: Record<NonNullable<Course["confidence_level"]>, "secondary" | "warning" | "success"> = {
  low: "warning",
  medium: "secondary",
  high: "success"
};

type CourseCardProps = {
  course: Course;
};

export function CourseCard({ course }: CourseCardProps) {
  const examDays = course.exam_date ? daysUntil(course.exam_date) : null;
  const examSoon = examDays !== null && examDays >= 0 && examDays <= 14;

  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <Badge variant="outline" className="mb-2 w-fit border-primary/20 text-primary">
                Course
              </Badge>
              <CardTitle className="truncate text-base">{course.title}</CardTitle>
              <CardDescription className="mt-1 line-clamp-2 leading-relaxed">
                {course.description?.trim() || "No description yet — open the workspace to add context."}
              </CardDescription>
            </div>
          </div>
          {course.confidence_level ? (
            <Badge variant={confidenceTone[course.confidence_level]} className="shrink-0 capitalize">
              {course.confidence_level}
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="mt-auto space-y-3 pb-3">
        {course.exam_date ? (
          <p
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
              examSoon
                ? "border-warning/30 bg-warning/10 text-warning"
                : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">{examLabel(course.exam_date)}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No exam date set</p>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
        <Link
          href={asRoute(`/courses/${course.id}`)}
          className={cn(buttonVariants({ size: "sm" }), "w-full sm:flex-1")}
        >
          <Sparkles className="mr-2 h-3.5 w-3.5" />
          Open workspace
        </Link>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Link href={asRoute(`/chat?course_id=${course.id}`)}>
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:ml-1.5">Chat</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Link href={asRoute(`/search?course_id=${course.id}`)}>
              <Search className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:ml-1.5">Search</span>
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
