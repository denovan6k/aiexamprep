"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, Layers, RotateCcw, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import type { Flashcard } from "@/lib/study";
import { asRoute, cn } from "@/lib/utils";

type FlashcardSessionSummaryProps = {
  deckTitle: string;
  cards: Flashcard[];
  confidence: Record<string, "again" | "known">;
  durationMs: number;
  onRestartFull: () => void;
  onRestartMissed: () => void;
};

function formatDuration(ms: number) {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 1);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function SummaryStat({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 text-center",
        tone === "default" && "border-border bg-background",
        tone === "success" && "border-success/20 bg-success/10",
        tone === "warning" && "border-warning/20 bg-warning/10"
      )}
    >
      <p
        className={cn(
          "text-3xl font-medium tabular-nums tracking-tight",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function FlashcardSessionSummary({
  deckTitle,
  cards,
  confidence,
  durationMs,
  onRestartFull,
  onRestartMissed
}: FlashcardSessionSummaryProps) {
  const reduceMotion = useReducedMotion();
  const reviewedCount = Object.keys(confidence).length;
  const knownCount = Object.values(confidence).filter((value) => value === "known").length;
  const againCount = Object.values(confidence).filter((value) => value === "again").length;
  const masteryPct = reviewedCount ? Math.round((knownCount / reviewedCount) * 100) : 0;
  const missedCards = cards.filter((card) => confidence[card.id] === "again");
  const unreviewedCount = cards.length - reviewedCount;

  const masteryMessage =
    masteryPct >= 90
      ? "Excellent recall — you're ready to move on."
      : masteryPct >= 70
        ? "Solid session. A quick refresh on missed cards will lock it in."
        : "Keep going — spaced repetition works best with repeat passes.";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-2xl space-y-6"
    >
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <h2 className="mt-4 text-2xl font-medium tracking-tight">Session complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">{deckTitle}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-muted" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                className="stroke-success transition-all duration-700"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${masteryPct} 100`}
              />
            </svg>
            <span className="absolute text-2xl font-medium tabular-nums">{masteryPct}%</span>
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-sm font-medium">Mastery score</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{masteryMessage}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDuration(durationMs)} study time
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryStat label="Reviewed" value={`${reviewedCount}/${cards.length}`} />
          <SummaryStat label="Known" value={knownCount} tone="success" />
          <SummaryStat label="Review again" value={againCount} tone={againCount > 0 ? "warning" : "default"} />
        </div>
        {unreviewedCount > 0 ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {unreviewedCount} card{unreviewedCount === 1 ? "" : "s"} skipped — study the deck again to cover them.
          </p>
        ) : null}
      </div>

      {missedCards.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-warning" />
            <p className="text-sm font-medium">Cards to revisit</p>
          </div>
          <ul className="mt-4 space-y-2">
            {missedCards.map((card) => (
              <li
                key={card.id}
                className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed"
              >
                {card.front}
                {card.topic ? (
                  <span className="mt-1 block text-xs text-muted-foreground">Topic: {card.topic}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-success/20 bg-success/5 p-5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <div>
            <p className="text-sm font-medium">All cards marked known</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Great work. These cards will stay out of your due queue until you need a refresh.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {missedCards.length > 0 ? (
          <Button type="button" className="gap-2 sm:flex-1" onClick={onRestartMissed}>
            <RotateCcw className="h-4 w-4" />
            Review missed ({missedCards.length})
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="gap-2 sm:flex-1" onClick={onRestartFull}>
          <Layers className="h-4 w-4" />
          Study deck again
        </Button>
        <Button type="button" variant="ghost" className="gap-2 sm:flex-1" asChild>
          <Link href={asRoute("/flashcards")}>
            <ArrowLeft className="h-4 w-4" />
            All decks
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
