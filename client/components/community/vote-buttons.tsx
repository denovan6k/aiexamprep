"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VoteButtonsProps = {
  score: number;
  userVote?: number | null;
  disabled?: boolean;
  onVote: (vote: 1 | -1 | 0) => void;
  size?: "sm" | "default";
};

export function VoteButtons({ score, userVote, disabled, onVote, size = "sm" }: VoteButtonsProps) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonSize = size === "sm" ? "icon" : "icon" as const;

  function handleVote(next: 1 | -1) {
    if (disabled) return;
    onVote(userVote === next ? 0 : next);
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size={buttonSize}
        className={cn("h-7 w-7", userVote === 1 && "text-primary")}
        disabled={disabled}
        onClick={() => handleVote(1)}
        aria-label="Upvote"
      >
        <ChevronUp className={iconClass} />
      </Button>
      <span className={cn("text-xs font-medium tabular-nums", score > 0 && "text-primary", score < 0 && "text-destructive")}>
        {score}
      </span>
      <Button
        type="button"
        variant="ghost"
        size={buttonSize}
        className={cn("h-7 w-7", userVote === -1 && "text-destructive")}
        disabled={disabled}
        onClick={() => handleVote(-1)}
        aria-label="Downvote"
      >
        <ChevronDown className={iconClass} />
      </Button>
    </div>
  );
}
