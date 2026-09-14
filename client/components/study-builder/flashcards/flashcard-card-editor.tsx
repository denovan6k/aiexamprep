"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FlashcardCardEditorProps = {
  front: string;
  back: string;
  topic: string | null | undefined;
  onChange: (next: { front: string; back: string; topic: string | null }) => void;
};

export function FlashcardCardEditor({ front, back, topic, onChange }: FlashcardCardEditorProps) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Front</Label>
        <Textarea value={front} onChange={(e) => onChange({ front: e.target.value, back, topic: topic ?? null })} />
      </div>
      <div className="space-y-1">
        <Label className="text-sm font-medium">Back</Label>
        <Textarea value={back} onChange={(e) => onChange({ front, back: e.target.value, topic: topic ?? null })} />
      </div>
      <div className="space-y-1">
        <Label className="text-sm font-medium">Topic (optional)</Label>
        <Input value={topic ?? ""} onChange={(e) => onChange({ front, back, topic: e.target.value || null })} />
      </div>
    </div>
  );
}

