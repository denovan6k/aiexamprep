"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-kit";

import { useCreateManualFlashcardDeckMutation } from "@/hooks/use-flashcards";
import { asRoute } from "@/lib/utils";
import type { FlashcardDeckCreateInput } from "@/lib/study";

export default function FlashcardsNewPage() {
  const router = useRouter();
  const createMutation = useCreateManualFlashcardDeckMutation();

  const [title, setTitle] = useState("Manual deck");
  const [cardCount, setCardCount] = useState(12);

  async function handleCreate() {
    const cards = Array.from({ length: cardCount }).map((_, idx) => ({
      front: "",
      back: "",
      topic: null as string | null,
      difficulty: null as string | null
    }));

    const payload: FlashcardDeckCreateInput = {
      title: title.trim() || "Manual deck",
      cards
    };

    const created = await createMutation.mutateAsync(payload);
    router.push(asRoute(`/flashcards/${created.id}/edit`));
  }

  return (
    <div className="mx-auto max-w-3xl py-4">
      <PageHeader
        eyebrow="Manual builder"
        title="Create flashcards"
        description="Author front/back cards, optionally fill from materials, then save."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={asRoute("/flashcards")}>Back</Link>
          </Button>
        }
      />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Deck settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deck-title">Title</Label>
            <Input id="deck-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Card count</Label>
            <Select value={String(cardCount)} onValueChange={(v) => setCardCount(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[6, 8, 10, 12, 15, 20].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleCreate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create draft"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

