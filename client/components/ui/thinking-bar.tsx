"use client"

import { ChevronRight } from "lucide-react"

import { TextShimmer } from "@/components/ui/text-shimmer"
import { cn } from "@/lib/utils"

type ThinkingBarProps = {
  className?: string
  text?: string
  onStop?: () => void
  stopLabel?: string
  onClick?: () => void
}

export function ThinkingBar({
  className,
  text = "Thinking",
  onStop,
  stopLabel = "Answer now",
  onClick
}: ThinkingBarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm",
        className
      )}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex items-center gap-1 text-sm text-foreground transition-colors hover:text-primary"
        >
          <TextShimmer>{text}</TextShimmer>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      ) : (
        <TextShimmer className="text-sm">{text}</TextShimmer>
      )}
      {onStop ? (
        <button
          type="button"
          onClick={onStop}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {stopLabel}
        </button>
      ) : null}
    </div>
  )
}
