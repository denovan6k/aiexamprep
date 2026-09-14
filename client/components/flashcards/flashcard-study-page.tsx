"use client";

import { FlashcardStudy } from "@/components/flashcards/flashcard-study";
import { Skeleton } from "@/components/ui/skeleton";
import { useFlashcardDeckQuery } from "@/hooks/use-flashcards";

export function FlashcardStudyPage({ deckId }: { deckId: string }) {
  const { data: deck, isLoading, error } = useFlashcardDeckQuery(deckId);

  if (error) {
    return <p className="py-4 text-sm text-danger">{error.message}</p>;
  }

  if (isLoading || !deck) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[540px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="py-4">
      <FlashcardStudy deckId={deck.id} deckTitle={deck.title} cards={deck.flashcards} />
    </div>
  );
}
