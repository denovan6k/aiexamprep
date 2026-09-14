"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type McqOption = { id: string; text: string };

type McqQuestionEditorProps = {
  prompt: string;
  options: McqOption[];
  correctOptionId: string;
  explanation: string | null | undefined;
  onChange: (next: {
    prompt: string;
    options: McqOption[];
    correct_option_id: string;
    explanation: string | null;
  }) => void;
};

export function McqQuestionEditor({
  prompt,
  options,
  correctOptionId,
  explanation,
  onChange
}: McqQuestionEditorProps) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Question prompt</Label>
        <Input
          value={prompt}
          onChange={(e) =>
            onChange({ prompt: e.target.value, options, correct_option_id: correctOptionId, explanation: explanation ?? null })
          }
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Options</Label>
        <div className="space-y-2">
          {options.map((opt) => (
            <div key={opt.id} className="flex items-start gap-3">
              <input
                type="radio"
                name="mcq-correct"
                checked={correctOptionId === opt.id}
                onChange={() => onChange({ prompt, options, correct_option_id: opt.id, explanation: explanation ?? null })}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">{opt.id}</div>
                <Input
                  value={opt.text}
                  onChange={(e) => {
                    const nextOptions = options.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o));
                    onChange({ prompt, options: nextOptions, correct_option_id: correctOptionId, explanation: explanation ?? null });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-sm font-medium">Explanation (optional)</Label>
        <Textarea
          value={explanation ?? ""}
          onChange={(e) =>
            onChange({ prompt, options, correct_option_id: correctOptionId, explanation: e.target.value || null })
          }
          placeholder="Why is this the right answer?"
        />
      </div>
    </div>
  );
}

