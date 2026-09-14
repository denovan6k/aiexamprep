"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { rateQuestion } from "@/lib/study";
import { cn } from "@/lib/utils";

type QuestionRatingProps = {
  questionId: string;
  className?: string;
};

export function QuestionRating({ questionId, className }: QuestionRatingProps) {
  const { token } = useAuth();
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(value: "up" | "down") {
    if (!token || isSubmitting || rating) return;
    setIsSubmitting(true);
    try {
      await rateQuestion(token, questionId, value);
      setRating(value);
    } catch {
      // Keep UI unobtrusive on failure
    } finally {
      setIsSubmitting(false);
    }
  }

  if (rating) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        {rating === "up" ? "Thanks for the feedback." : "Noted — we'll improve agent quality."}
      </p>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="mr-1 text-[11px] text-muted-foreground">Rate this question</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={isSubmitting}
        aria-label="Good question"
        onClick={() => void submit("up")}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={isSubmitting}
        aria-label="Poor question"
        onClick={() => void submit("down")}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
