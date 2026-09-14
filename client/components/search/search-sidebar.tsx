"use client";

import Link from "next/link";
import { BookOpen, ChevronDown, Lightbulb, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { asRoute, cn } from "@/lib/utils";

type SearchSidebarProps = {
  selectedCourseId: string | null;
};

export function SearchSidebar({ selectedCourseId }: SearchSidebarProps) {
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <details className="group rounded-xl border border-border/70 bg-muted/20 lg:open:border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            Search help
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 lg:hidden" />
        </summary>
        <div className="space-y-4 border-t border-border/60 px-4 py-4 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Search</span> finds exact passages using hybrid
            keyword + semantic retrieval.
          </p>
          <p>
            <span className="font-medium text-foreground">Ask</span> runs multi-step retrieval and returns a
            synthesized answer with source citations.
          </p>
          <p>Scope to one course or a few materials when you need focused results for an exam topic.</p>
          <div className={cn("flex flex-col gap-2 pt-1")}>
            <Button asChild variant="outline" size="sm" className="justify-start gap-2">
              <Link href={asRoute("/courses")}>
                <BookOpen className="h-4 w-4" />
                Manage courses
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="justify-start gap-2">
              <Link href={asRoute(selectedCourseId ? `/chat?course_id=${selectedCourseId}` : "/chat")}>
                <MessageSquare className="h-4 w-4" />
                Open course chat
              </Link>
            </Button>
          </div>
        </div>
      </details>
    </aside>
  );
}
