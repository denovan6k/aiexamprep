"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ShortAnswerQuestionEditorProps = {
  prompt: string;
  modelAnswers: string[];
  explanation: string | null | undefined;
  onChange: (next: {
    prompt: string;
    modelAnswers: string[];
    explanation: string | null;
  }) => void;
};

export function ShortAnswerQuestionEditor({
  prompt,
  modelAnswers,
  explanation,
  onChange
}: ShortAnswerQuestionEditorProps) {
  const answersText = modelAnswers.join("\n");

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Prompt</Label>
        <Textarea
          value={prompt}
          onChange={(e) => onChange({ prompt: e.target.value, modelAnswers, explanation: explanation ?? null })}
          placeholder="Type the question prompt…"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-sm font-medium">Model answers (one per line)</Label>
        <Textarea
          value={answersText}
          onChange={(e) => {
            const next = e.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            onChange({ prompt, modelAnswers: next, explanation: explanation ?? null });
          }}
          placeholder="e.g. gravity&#10;mass"
        />
        <div className="text-xs text-muted-foreground">
          These answers are used when grading with either keyword heuristic or AI correctness.
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-sm font-medium">Explanation (optional)</Label>
        <Textarea
          value={explanation ?? ""}
          onChange={(e) =>
            onChange({
              prompt,
              modelAnswers,
              explanation: e.target.value || null
            })
          }
          placeholder="Optional feedback shown after submit…"
        />
      </div>
    </div>
  );
}

