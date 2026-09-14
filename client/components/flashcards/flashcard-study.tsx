"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { FlashcardFlipCard } from "@/components/flashcards/flashcard-flip-card";
import { FlashcardSessionSummary } from "@/components/flashcards/flashcard-session-summary";
import { FlashcardStudySidebar } from "@/components/flashcards/flashcard-study-sidebar";
import { StudySessionLayout } from "@/components/session/study-session-layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { reviewFlashcard, type Flashcard } from "@/lib/study";
import { showError } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

type FlashcardStudyProps = {
  deckId: string;
  deckTitle: string;
  cards: Flashcard[];
};

type StudyPhase = "studying" | "complete";

const FEEDBACK_DURATION_MS = 320;

export function FlashcardStudy({ deckId, deckTitle, cards }: FlashcardStudyProps) {
  const { token } = useAuth();
  const reduceMotion = useReducedMotion();
  const sessionStartRef = useRef(Date.now());

  const [phase, setPhase] = useState<StudyPhase>("studying");
  const [activeCards, setActiveCards] = useState(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [reviewFeedback, setReviewFeedback] = useState<"again" | "known" | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [confidence, setConfidence] = useState<Record<string, "again" | "known">>({});
  const [sessionDurationMs, setSessionDurationMs] = useState(0);

  const card = activeCards[index];
  const studiedCount = Object.keys(confidence).length;
  const knownCount = Object.values(confidence).filter((value) => value === "known").length;
  const againCount = Object.values(confidence).filter((value) => value === "again").length;
  const progressValue = activeCards.length ? ((index + 1) / activeCards.length) * 100 : 0;

  const goTo = useCallback(
    (nextIndex: number) => {
      setSlideDirection(nextIndex > index ? 1 : -1);
      setReviewFeedback(null);
      setIndex(nextIndex);
      setFlipped(false);
    },
    [index]
  );

  const toggleFlip = useCallback(() => {
    if (isAdvancing) return;
    setFlipped((value) => !value);
  }, [isAdvancing]);

  const resetSession = useCallback((nextCards: Flashcard[]) => {
    setActiveCards(nextCards);
    setIndex(0);
    setFlipped(false);
    setSlideDirection(1);
    setReviewFeedback(null);
    setConfidence({});
    setPhase("studying");
    sessionStartRef.current = Date.now();
  }, []);

  const restartFull = useCallback(() => {
    resetSession(cards);
  }, [cards, resetSession]);

  const restartMissed = useCallback(() => {
    const missedIds = new Set(
      Object.entries(confidence)
        .filter(([, value]) => value === "again")
        .map(([id]) => id)
    );
    const missed = cards.filter((item) => missedIds.has(item.id));
    if (missed.length === 0) return;
    resetSession(missed);
  }, [cards, confidence, resetSession]);

  useEffect(() => {
    if (phase !== "studying") return;

    function onKeyDown(event: KeyboardEvent) {
      if (isAdvancing) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        toggleFlip();
      } else if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        goTo(index - 1);
      } else if (event.key === "ArrowRight" && index < activeCards.length - 1) {
        event.preventDefault();
        goTo(index + 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCards.length, goTo, index, isAdvancing, phase, toggleFlip]);

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">This deck has no cards yet.</p>;
  }

  async function mark(value: "again" | "known") {
    if (isAdvancing || !card) return;

    setIsAdvancing(true);
    setReviewFeedback(value);
    const nextConfidence = { ...confidence, [card.id]: value };
    setConfidence(nextConfidence);

    if (token) {
      try {
        await reviewFlashcard(token, deckId, card.id, value);
      } catch (err) {
        showError(err, "Failed to save review.");
        setIsAdvancing(false);
        setReviewFeedback(null);
        setConfidence(confidence);
        return;
      }
    }

    if (!reduceMotion) {
      await new Promise((resolve) => window.setTimeout(resolve, FEEDBACK_DURATION_MS));
    }

    const allReviewed = Object.keys(nextConfidence).length >= activeCards.length;
    const isLastCard = index >= activeCards.length - 1;
    if (allReviewed || isLastCard) {
      setSessionDurationMs(Date.now() - sessionStartRef.current);
      setReviewFeedback(null);
      setPhase("complete");
    } else {
      goTo(index + 1);
    }

    setIsAdvancing(false);
  }

  if (phase === "complete") {
    return (
      <StudySessionLayout
        title={deckTitle}
        subtitle="Session summary"
        backHref={asRoute("/flashcards")}
        backLabel="All decks"
      >
        <FlashcardSessionSummary
          deckTitle={deckTitle}
          cards={activeCards}
          confidence={confidence}
          durationMs={sessionDurationMs}
          onRestartFull={restartFull}
          onRestartMissed={restartMissed}
        />
      </StudySessionLayout>
    );
  }

  return (
    <StudySessionLayout
      title={deckTitle}
      subtitle="Flashcard review"
      backHref={asRoute("/flashcards")}
      backLabel="All decks"
      aside={
        <FlashcardStudySidebar
          cards={activeCards}
          index={index}
          studiedCount={studiedCount}
          knownCount={knownCount}
          againCount={againCount}
        />
      }
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:min-h-[540px]"
      >
        <div className="shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Card {index + 1} of {activeCards.length}
            </p>
            <p className="text-sm tabular-nums text-muted-foreground">{studiedCount} reviewed</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${progressValue}%` }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>

        {card ? (
          <FlashcardFlipCard
            cardId={card.id}
            front={card.front}
            back={card.back}
            topic={card.topic}
            flipped={flipped}
            slideDirection={slideDirection}
            reviewFeedback={reviewFeedback}
            onFlip={toggleFlip}
            className="mt-6 min-h-0 flex-1"
          />
        ) : null}

        <div className="mt-6 grid shrink-0 grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10"
            disabled={index === 0 || isAdvancing}
            onClick={() => goTo(index - 1)}
          >
            Previous
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-10" disabled={isAdvancing} onClick={toggleFlip}>
            Flip card
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-10"
            disabled={index >= activeCards.length - 1 || isAdvancing}
            onClick={() => goTo(index + 1)}
          >
            Next
          </Button>
        </div>

        <div className="mt-auto grid shrink-0 grid-cols-2 gap-3 pt-5">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full gap-2"
            disabled={isAdvancing}
            onClick={() => void mark("again")}
          >
            <RotateCcw className="h-4 w-4" />
            Review again
          </Button>
          <Button
            type="button"
            size="lg"
            className="h-12 w-full gap-2"
            disabled={isAdvancing}
            onClick={() => void mark("known")}
          >
            <CheckCircle2 className="h-4 w-4" />
            I know this
          </Button>
        </div>
      </motion.div>
    </StudySessionLayout>
  );
}
