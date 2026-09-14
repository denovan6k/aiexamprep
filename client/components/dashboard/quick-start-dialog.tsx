"use client";

import { BookOpen, Layers, MessageSquare, Search, Sparkles, Upload, Zap } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { asRoute } from "@/lib/utils";

type QuickStartDialogProps = {
  firstCourseId?: string | null;
  flashcardDeckId?: string | null;
  trigger?: ReactNode;
};

const actions = [
  {
    key: "chat",
    label: "Ask in chat",
    description: "Upload notes, generate quizzes, or get explanations.",
    href: "/chat",
    icon: MessageSquare
  },
  {
    key: "quiz",
    label: "Take a quiz",
    description: "Practice with AI-generated or saved quizzes.",
    href: "/quizzes",
    icon: BookOpen
  },
  {
    key: "flashcards",
    label: "Review flashcards",
    description: "Run spaced repetition on your decks.",
    href: "/flashcards",
    icon: Layers
  },
  {
    key: "search",
    label: "Search materials",
    description: "Find passages or ask grounded questions.",
    href: "/search",
    icon: Search
  }
] as const;

export function QuickStartDialog({ firstCourseId, flashcardDeckId, trigger }: QuickStartDialogProps) {
  const [open, setOpen] = useState(false);

  function hrefFor(action: (typeof actions)[number]) {
    if (action.key === "chat" && firstCourseId) return `/chat?course_id=${firstCourseId}`;
    if (action.key === "flashcards" && flashcardDeckId) return `/flashcards/${flashcardDeckId}/study`;
    if (action.key === "search" && firstCourseId) return `/search?course_id=${firstCourseId}`;
    return action.href;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2">
            <Zap className="h-4 w-4" />
            Quick start
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick start</DialogTitle>
          <DialogDescription>Jump straight into the study flow that fits your next block.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          {actions.map((action) => (
            <Link
              key={action.key}
              href={asRoute(hrefFor(action))}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/30 hover:bg-accent/40"
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <action.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{action.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{action.description}</p>
              </div>
            </Link>
          ))}
          {firstCourseId ? (
            <Link
              href={asRoute(`/courses/${firstCourseId}?tab=materials`)}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-lg border border-dashed border-border p-3 transition-colors hover:border-primary/30 hover:bg-accent/40"
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Upload to course</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Add PDFs or notes to your active course workspace.
                </p>
              </div>
            </Link>
          ) : null}
        </div>
        <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="mb-1 inline h-3.5 w-3.5 text-primary" /> Tip: use Quick start before a focused
          session, then work through your Today plan below.
        </div>
      </DialogContent>
    </Dialog>
  );
}
