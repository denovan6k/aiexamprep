"use client";

import { MessageSquare, Plus, Search, Upload } from "lucide-react";
import Link from "next/link";

import { CreateCourseDialog } from "@/components/courses/create-course-dialog";
import { Button } from "@/components/ui/button";
import { asRoute, cn } from "@/lib/utils";

type CoursesQuickActionsProps = {
  firstCourseId?: string | null;
};

const actions = [
  {
    id: "upload",
    label: "Upload material",
    icon: Upload,
    href: (courseId?: string | null) =>
      courseId ? asRoute(`/courses/${courseId}?tab=materials`) : asRoute("/courses")
  },
  {
    id: "search",
    label: "Search notes",
    icon: Search,
    href: (courseId?: string | null) =>
      courseId ? asRoute(`/search?course_id=${courseId}`) : asRoute("/search")
  },
  {
    id: "chat",
    label: "Course chat",
    icon: MessageSquare,
    href: (courseId?: string | null) =>
      courseId ? asRoute(`/chat?course_id=${courseId}`) : asRoute("/chat")
  }
] as const;

export function CoursesQuickActions({ firstCourseId }: CoursesQuickActionsProps) {
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      <CreateCourseDialog
        trigger={
          <button
            type="button"
            className="flex min-w-[8.5rem] shrink-0 flex-col items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10"
          >
            <span className="rounded-lg bg-primary/15 p-2 text-primary">
              <Plus className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium">Add course</span>
          </button>
        }
      />
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.id}
            href={action.href(firstCourseId)}
            className="flex min-w-[8.5rem] shrink-0 flex-col items-start gap-2 rounded-xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-accent/20"
          >
            <span className={cn("rounded-lg bg-primary/10 p-2 text-primary")}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium">{action.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
