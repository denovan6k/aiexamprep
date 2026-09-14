"use client";

import Link from "next/link";
import { useState } from "react";
import { Layers, Plus } from "lucide-react";

import { StudyBuilderDialog } from "@/components/study-builder/study-builder-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemCard, PageHeader, SectionGrid, SectionTitle, Stat } from "@/components/page-kit";
import { useFlashcardDecksQuery } from "@/hooks/use-flashcards";
import { useListPageState } from "@/hooks/use-list-page-state";
import { asRoute } from "@/lib/utils";

export default function FlashcardsPage() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const listState = useListPageState();
  const { data, isLoading, error } = useFlashcardDecksQuery({
    limit: listState.limit,
    offset: listState.offset,
    q: listState.query || undefined
  });
  const decks = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalCards =
    typeof data?.meta?.total_cards === "number"
      ? data.meta.total_cards
      : decks.reduce((sum, deck) => sum + deck.card_count, 0);

  return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Flashcards"
          title="Active recall decks"
          description="Study generated flashcard decks from your materials and quiz weak areas."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-2" onClick={() => setBuilderOpen(true)}>
                <Plus className="h-4 w-4" />
                Create deck
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link href={asRoute("/chat")}>Generate from chat</Link>
              </Button>
            </div>
          }
        />

        <ListToolbar
          searchValue={listState.searchInput}
          onSearchValueChange={listState.setSearchInput}
          onSearchSubmit={listState.applySearch}
          searchPlaceholder="Search decks..."
        />

        {error ? <p className="mb-4 text-sm text-danger">{error.message}</p> : null}
        <SectionGrid>
          <Stat label="Decks" value={isLoading ? "—" : String(total)} />
          <Stat label="Total cards" value={isLoading ? "—" : String(totalCards)} tone="success" />
        </SectionGrid>

        <SectionTitle title="Your decks" />
        {isLoading ? (
          <SectionGrid>
            {[1, 2].map((item) => (
              <Skeleton key={item} className="h-40 w-full rounded-xl" />
            ))}
          </SectionGrid>
        ) : decks.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={listState.query ? "No decks match your search" : "No decks yet"}
            description={
              listState.query
                ? "Try a different search or clear filters."
                : "Generate flashcards in chat from your study materials."
            }
            action={
              listState.query ? (
                <Button variant="outline" onClick={listState.resetFilters}>
                  Clear search
                </Button>
              ) : (
                <Button onClick={() => setBuilderOpen(true)}>Create a deck</Button>
              )
            }
          />
        ) : (
          <>
            <SectionGrid>
              {decks.map((deck) => (
                <ItemCard
                  key={deck.id}
                  eyebrow="Deck"
                  title={deck.title}
                  description={`${deck.card_count} cards`}
                  meta={deck.created_at ? new Date(deck.created_at).toLocaleDateString() : ""}
                  href={asRoute(`/flashcards/${deck.id}/study`)}
                />
              ))}
            </SectionGrid>
            <PaginationControls
              className="mt-6"
              total={total}
              limit={listState.limit}
              offset={listState.offset}
              onPageChange={listState.setOffset}
            />
          </>
        )}

        <StudyBuilderDialog open={builderOpen} onOpenChange={setBuilderOpen} defaultTab="flashcards" />
      </div>
  );
}
