"use client";

import { Badge } from "@/components/ui/badge";
import type { QuizQuestion } from "@/lib/study";
import { cn } from "@/lib/utils";

type QuizPreviewPanelProps = {
  questions: QuizQuestion[];
  maxItems?: number;
  className?: string;
};

function formatType(type: string) {
  return type.replace(/_/g, " ");
}

export function QuizPreviewPanel({ questions, maxItems = 3, className }: QuizPreviewPanelProps) {
  if (questions.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center",
          className
        )}
      >
        <p className="text-sm font-medium">No questions yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Regenerate from your materials or chat history to populate this quiz.
        </p>
      </div>
    );
  }

  const preview = questions.slice(0, maxItems);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
        <Badge variant="secondary" className="text-xs">
          {questions.length} question{questions.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-3">
        {preview.map((question, index) => (
          <div
            key={question.id}
            className="rounded-md bg-background/80 px-3 py-2.5 ring-1 ring-border/50"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Q{index + 1}</span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {formatType(question.type)}
              </Badge>
              {question.topic ? (
                <Badge variant="secondary" className="text-[10px]">
                  {question.topic}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm leading-snug">{question.prompt}</p>
          </div>
        ))}
        {questions.length > maxItems ? (
          <p className="pt-1 text-center text-xs text-muted-foreground">
            +{questions.length - maxItems} more question{questions.length - maxItems === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
