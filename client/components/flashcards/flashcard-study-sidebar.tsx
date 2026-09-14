"use client";

import { BookOpen, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { SidebarSection } from "@/components/sidebar/sidebar-section";
import type { Flashcard } from "@/lib/study";
import { cn } from "@/lib/utils";

type FlashcardStudySidebarProps = {
  cards: Flashcard[];
  index: number;
  studiedCount: number;
  knownCount: number;
  againCount: number;
};

function StatTile({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "default" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "flex min-h-[4.5rem] flex-col items-center justify-center rounded-lg border p-3 text-center",
        tone === "default" && "border-border bg-background",
        tone === "success" && "border-success/20 bg-success/10",
        tone === "warning" && "border-warning/20 bg-warning/10"
      )}
    >
      <p
        className={cn(
          "text-xl font-medium tabular-nums",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning"
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function FlashcardStudySidebar({
  cards,
  index,
  studiedCount,
  knownCount,
  againCount
}: FlashcardStudySidebarProps) {
  const reduceMotion = useReducedMotion();
  const nextCard = index < cards.length - 1 ? cards[index + 1] : null;
  const isLastCard = index === cards.length - 1;
  const progressPct = cards.length ? (studiedCount / cards.length) * 100 : 0;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="flex h-full min-h-0 flex-col gap-4 lg:min-h-[540px]"
    >
      <SidebarSection title="This session" defaultOpen contentClassName="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <StatTile label="Known" value={knownCount} tone="success" />
          <StatTile label="Again" value={againCount} tone="warning" />
          <StatTile label="Left" value={cards.length - studiedCount} tone="default" />
        </div>
      </SidebarSection>

      <SidebarSection title="Progress" defaultOpen contentClassName="p-0">
        <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Cards reviewed</span>
            <span className="tabular-nums">
              {studiedCount}/{cards.length}
            </span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </SidebarSection>

      {nextCard || isLastCard ? (
        <SidebarSection title="Up next" defaultOpen={Boolean(nextCard)} contentClassName="p-0">
          {nextCard ? (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
              <p className="line-clamp-4 text-sm leading-relaxed">{nextCard.front}</p>
              {nextCard.topic ? <p className="mt-2 text-xs text-muted-foreground">{nextCard.topic}</p> : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
              <BookOpen className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Final card</p>
              <p className="mt-1 text-xs text-muted-foreground">Mark this card to finish your session.</p>
            </div>
          )}
        </SidebarSection>
      ) : null}

      <SidebarSection title="Tip" icon={<Sparkles className="h-3.5 w-3.5" />} defaultOpen={false}>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Space · flip · ← → navigate. Mark &quot;Review again&quot; to keep cards in your due queue.
        </p>
      </SidebarSection>
    </motion.div>
  );
}
