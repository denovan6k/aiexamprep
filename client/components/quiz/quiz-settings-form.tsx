"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { QUIZ_QUESTION_TYPE_OPTIONS } from "@/lib/study";
import { cn } from "@/lib/utils";

/** Primary question types shown prominently in setup UI. */
export const QUIZ_PRIMARY_QUESTION_TYPES = [
  "mcq",
  "true_false",
  "matching",
  "short_answer"
] as const;

export type QuizSettingsFormValues = {
  count: number;
  timerMinutes: number | "";
  topicFocus: string;
  selectedTypes: string[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  optionsCount?: number;
};

type QuizSettingsFormProps = {
  values: QuizSettingsFormValues;
  onChange: (values: QuizSettingsFormValues) => void;
  showCount?: boolean;
  showTimer?: boolean;
  showTopicFocus?: boolean;
  showQuestionTypes?: boolean;
  showShuffle?: boolean;
  showOptionsCount?: boolean;
  showAdvancedTypes?: boolean;
  idPrefix?: string;
  className?: string;
};

export function QuizSettingsForm({
  values,
  onChange,
  showCount = true,
  showTimer = true,
  showTopicFocus = true,
  showQuestionTypes = true,
  showShuffle = true,
  showOptionsCount = false,
  showAdvancedTypes = false,
  idPrefix = "quiz-settings",
  className
}: QuizSettingsFormProps) {
  function patch(partial: Partial<QuizSettingsFormValues>) {
    onChange({ ...values, ...partial });
  }

  function toggleType(typeId: string) {
    const next = values.selectedTypes.includes(typeId)
      ? values.selectedTypes.filter((item) => item !== typeId)
      : [...values.selectedTypes, typeId];
    patch({ selectedTypes: next.length > 0 ? next : ["mcq"] });
  }

  const primaryTypes = QUIZ_QUESTION_TYPE_OPTIONS.filter((type) =>
    (QUIZ_PRIMARY_QUESTION_TYPES as readonly string[]).includes(type.id)
  );
  const advancedTypes = QUIZ_QUESTION_TYPE_OPTIONS.filter(
    (type) => !(QUIZ_PRIMARY_QUESTION_TYPES as readonly string[]).includes(type.id)
  );

  return (
    <div className={cn("space-y-5", className)}>
      {(showCount || showTimer) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {showCount ? (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-count`}>Question count</Label>
              <Input
                id={`${idPrefix}-count`}
                type="number"
                min={1}
                max={50}
                value={values.count}
                onChange={(event) => patch({ count: Number(event.target.value) })}
              />
            </div>
          ) : null}
          {showTimer ? (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-timer`}>Timer (minutes)</Label>
              <Input
                id={`${idPrefix}-timer`}
                type="number"
                min={1}
                max={180}
                value={values.timerMinutes}
                onChange={(event) =>
                  patch({ timerMinutes: event.target.value ? Number(event.target.value) : "" })
                }
                placeholder="No timer"
              />
            </div>
          ) : null}
        </div>
      )}

      {showOptionsCount ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-options-count`}>Options per question</Label>
          <Input
            id={`${idPrefix}-options-count`}
            type="number"
            min={2}
            max={6}
            value={values.optionsCount ?? 4}
            onChange={(event) => patch({ optionsCount: Number(event.target.value) })}
          />
        </div>
      ) : null}

      {showTopicFocus ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-topic`}>Topic focus (optional)</Label>
          <Input
            id={`${idPrefix}-topic`}
            type="text"
            value={values.topicFocus}
            onChange={(event) => patch({ topicFocus: event.target.value })}
            placeholder="topic or chapter"
          />
        </div>
      ) : null}

      {showQuestionTypes ? (
        <div className="space-y-3">
          <Label>Question types</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {primaryTypes.map((type) => (
              <label
                key={type.id}
                htmlFor={`${idPrefix}-type-${type.id}`}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                  values.selectedTypes.includes(type.id)
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:bg-muted/40"
                )}
              >
                <Checkbox
                  id={`${idPrefix}-type-${type.id}`}
                  checked={values.selectedTypes.includes(type.id)}
                  onCheckedChange={() => toggleType(type.id)}
                />
                <span className="text-sm">{type.label}</span>
              </label>
            ))}
          </div>
          {showAdvancedTypes && advancedTypes.length > 0 ? (
            <>
              <Separator />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Advanced
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {advancedTypes.map((type) => (
                  <label
                    key={type.id}
                    htmlFor={`${idPrefix}-type-${type.id}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                      values.selectedTypes.includes(type.id)
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <Checkbox
                      id={`${idPrefix}-type-${type.id}`}
                      checked={values.selectedTypes.includes(type.id)}
                      onCheckedChange={() => toggleType(type.id)}
                    />
                    <span className="text-sm">{type.label}</span>
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {showShuffle ? (
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <label
            htmlFor={`${idPrefix}-shuffle-questions`}
            className="flex cursor-pointer items-center gap-2"
          >
            <Checkbox
              id={`${idPrefix}-shuffle-questions`}
              checked={values.shuffleQuestions}
              onCheckedChange={(checked) => patch({ shuffleQuestions: checked === true })}
            />
            <span className="text-sm">Shuffle question order</span>
          </label>
          <label
            htmlFor={`${idPrefix}-shuffle-options`}
            className="flex cursor-pointer items-center gap-2"
          >
            <Checkbox
              id={`${idPrefix}-shuffle-options`}
              checked={values.shuffleOptions}
              onCheckedChange={(checked) => patch({ shuffleOptions: checked === true })}
            />
            <span className="text-sm">Shuffle answer options</span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
