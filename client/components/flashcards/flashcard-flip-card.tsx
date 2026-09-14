"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RotateCw } from "lucide-react";

import { cn } from "@/lib/utils";

type FlashcardFlipCardProps = {
  cardId: string;
  front: string;
  back: string;
  topic?: string | null;
  flipped: boolean;
  slideDirection: 1 | -1;
  reviewFeedback?: "again" | "known" | null;
  onFlip: () => void;
  className?: string;
};

const slideTransition = { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };
const flipTransition = { duration: 0.55, ease: [0.4, 0, 0.2, 1] as const };

export function FlashcardFlipCard({
  cardId,
  front,
  back,
  topic,
  flipped,
  slideDirection,
  reviewFeedback = null,
  onFlip,
  className
}: FlashcardFlipCardProps) {
  const reduceMotion = useReducedMotion();
  const exitX = reviewFeedback ? (reviewFeedback === "known" ? 120 : -120) : slideDirection * -48;

  return (
    <div className={cn("relative flex flex-col [perspective:1200px]", className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={cardId}
          className="flex min-h-0 flex-1 flex-col"
          initial={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, x: slideDirection * 48, scale: 0.97, filter: "blur(4px)" }
          }
          animate={
            reviewFeedback
              ? reduceMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    x: exitX,
                    scale: 0.94,
                    rotate: reviewFeedback === "known" ? 4 : -4
                  }
              : { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }
          }
          exit={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, x: exitX, scale: 0.94, filter: "blur(4px)" }
          }
          transition={slideTransition}
        >
          <motion.button
            type="button"
            onClick={onFlip}
            aria-pressed={flipped}
            aria-label={flipped ? "Show question" : "Show answer"}
            whileHover={reduceMotion ? undefined : { scale: 1.01 }}
            whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            className={cn(
              "group relative w-full flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              reviewFeedback === "known" && "ring-2 ring-success/40",
              reviewFeedback === "again" && "ring-2 ring-warning/40"
            )}
          >
            <motion.div
              className="relative h-full min-h-56 w-full [transform-style:preserve-3d] sm:min-h-64"
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={reduceMotion ? { duration: 0 } : flipTransition}
            >
              <div
                className={cn(
                  "absolute inset-0 flex flex-col rounded-xl border border-border bg-background p-6 shadow-subtle [backface-visibility:hidden]",
                  "transition-shadow duration-300 group-hover:shadow-elevated"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Front</p>
                  {!flipped && !reduceMotion ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80 animate-text-blink">
                      <RotateCw className="h-3.5 w-3.5" />
                      Tap to flip
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 flex-1 text-lg leading-relaxed sm:text-xl">{front}</p>
                {topic ? <p className="mt-4 text-sm text-muted-foreground">Topic: {topic}</p> : null}
              </div>

              <div
                className={cn(
                  "absolute inset-0 flex flex-col rounded-xl border border-border bg-muted/40 p-6 shadow-subtle [backface-visibility:hidden] [transform:rotateY(180deg)]",
                  "transition-shadow duration-300 group-hover:shadow-elevated"
                )}
              >
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Back</p>
                <p className="mt-4 flex-1 text-lg leading-relaxed sm:text-xl">{back}</p>
                {topic ? <p className="mt-4 text-sm text-muted-foreground">Topic: {topic}</p> : null}
              </div>
            </motion.div>
          </motion.button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
