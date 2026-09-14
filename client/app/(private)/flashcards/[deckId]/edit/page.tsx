"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-kit";

import { MaterialPicker } from "@/components/study-builder/material-picker";
import { FlashcardCardEditor } from "@/components/study-builder/flashcards/flashcard-card-editor";

import { asRoute } from "@/lib/utils";
import { showError, showSuccess } from "@/lib/toast";
import { useFlashcardDeckQuery, usePopulateManualFlashcardDeckMutation, useUpdateManualFlashcardDeckMutation } from "@/hooks/use-flashcards";
import type { Flashcard, FlashcardDeckPopulateInput, FlashcardDeckUpdateInput } from "@/lib/study";

export default function FlashcardEditPage() {
  const router = useRouter();
  const params = useParams<{ deckId: string }>();
  const deckId = params.deckId;
  const { data: deck, isLoading, error, refetch } = useFlashcardDeckQuery(deckId);
  const updateMutation = useUpdateManualFlashcardDeckMutation();
  const populateMutation = usePopulateManualFlashcardDeckMutation();

  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [materialIds, setMaterialIds] = useState<string[]>([]);

  useEffect(() => {
    if (!deck) return;
    setTitle(deck.title ?? "");
    setCards(deck.flashcards ?? []);
  }, [deck]);

  async function handleSave() {
    if (!deckId) return;
    try {
      const payload: FlashcardDeckUpdateInput = {
        title: title.trim() || "Deck",
        cards: cards.map((c) => ({
          front: c.front,
          back: c.back,
          topic: c.topic,
          difficulty: c.difficulty
        }))
      };

      await updateMutation.mutateAsync({ deckId, input: payload });
      showSuccess("Deck saved.");
    } catch (err) {
      showError(err, "Failed to save deck.");
    }
  }

  async function handlePopulate() {
    if (materialIds.length === 0) {
      showError(new Error("Select at least one material."), "Fill from materials failed.");
      return;
    }
    if (!deckId) return;
    try {
      const payload: FlashcardDeckPopulateInput = {
        material_ids: materialIds,
        count: cards.length,
        title: title.trim() || undefined
      };
      await populateMutation.mutateAsync({ deckId, input: payload });
      await refetch();
      showSuccess("Filled from materials.");
    } catch (err) {
      showError(err, "Fill from materials failed.");
    }
  }

  const isBusy = updateMutation.isPending || populateMutation.isPending;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl py-8">
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">Loading deck…</CardContent>
        </Card>
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="mx-auto max-w-5xl py-8">
        <p className="text-danger">Failed to load deck.</p>
      </div>
    );
  }

  const cardsCount = cards.length;

  return (
    <div className="mx-auto max-w-5xl py-4">
      <PageHeader
        eyebrow="Flashcards"
        title={title || "Flashcard deck"}
        description="Edit card content. Optionally fill from materials, then save."
        actions={
          <Button asChild size="sm" variant="outline">
            <a href={asRoute(`/flashcards/${deckId}/study`)}>Study</a>
          </Button>
        }
      />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Deck builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deck-title">Title</Label>
            <Input id="deck-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Fill from materials</Label>
            <MaterialPicker selectedMaterialIds={materialIds} onChange={setMaterialIds} disabled={isBusy} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void handlePopulate()} disabled={isBusy || !cardsCount}>
                {populateMutation.isPending ? "Filling…" : "Fill from materials"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {cards.map((c, idx) => (
              <FlashcardCardEditor
                key={c.id ?? idx}
                front={c.front}
                back={c.back}
                topic={c.topic}
                onChange={(next) => {
                  const updated = [...cards];
                  updated[idx] = {
                    ...updated[idx],
                    front: next.front,
                    back: next.back,
                    topic: next.topic
                  };
                  setCards(updated);
                }}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleSave()} disabled={isBusy || cards.length === 0}>
              Save deck
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push(asRoute(`/flashcards/${deckId}/study`))}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

