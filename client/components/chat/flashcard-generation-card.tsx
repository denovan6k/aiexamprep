import Link from "next/link";
import { Layers, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Steps,
  StepsContent,
  StepsItem,
  StepsTrigger
} from "@/components/ui/steps";
import { asRoute } from "@/lib/utils";

export type FlashcardPreview = {
  deck_id: string;
  card_count: number;
  cards: Array<{ front: string; back: string; topic?: string | null }>;
};

type FlashcardGenerationCardProps = {
  deck: FlashcardPreview;
};

export function FlashcardGenerationCard({ deck }: FlashcardGenerationCardProps) {
  const preview = deck.cards.slice(0, 3);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Flashcard deck ready</p>
            <p className="text-xs text-muted-foreground">
              {deck.card_count} cards · spaced repetition study
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="rounded-full">
              <Link href={asRoute(`/flashcards/${deck.deck_id}/study`)}>Study now</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link href={asRoute("/flashcards")}>All decks</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <Steps defaultOpen className="mb-1">
          <StepsTrigger leftIcon={<ListChecks className="size-4" />}>
            Study tips
          </StepsTrigger>
          <StepsContent>
            <StepsItem>1. Flip through cards and rate how well you knew each answer</StepsItem>
            <StepsItem>2. Cards you miss come back sooner in spaced repetition</StepsItem>
            <StepsItem>3. Ask for another deck if you want cards on a different topic</StepsItem>
          </StepsContent>
        </Steps>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((card, index) => (
            <div
              key={index}
              className="flex min-h-[7.5rem] flex-col rounded-xl border border-border/60 bg-background p-3"
            >
              <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Layers className="size-3" />
                Card {index + 1}
              </p>
              <p className="mt-2 text-sm font-medium leading-snug text-foreground">{card.front}</p>
              <p className="mt-auto pt-3 text-xs leading-relaxed text-muted-foreground">{card.back}</p>
            </div>
          ))}
        </div>

        {deck.card_count > preview.length ? (
          <p className="text-xs text-muted-foreground">
            +{deck.card_count - preview.length} more cards in the full deck
          </p>
        ) : null}
      </div>
    </div>
  );
}
