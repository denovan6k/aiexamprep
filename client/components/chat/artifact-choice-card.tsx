"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export type ArtifactChoice = {
  id: string;
  label: string;
};

type ArtifactChoiceCardProps = {
  choices: ArtifactChoice[];
  attachmentNames?: string[];
  disabled?: boolean;
  onSelect: (artifactType: string) => void;
};

export function ArtifactChoiceCard({
  choices,
  attachmentNames = [],
  disabled = false,
  onSelect
}: ArtifactChoiceCardProps) {
  const attachmentLabel =
    attachmentNames.length > 0 ? attachmentNames.join(", ") : "your material";

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">What next?</p>
            <p className="text-xs text-muted-foreground">From {attachmentLabel}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 p-4">
        {choices.map((choice) => (
          <Button
            key={choice.id}
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={disabled}
            onClick={() => onSelect(choice.id)}
          >
            {choice.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
