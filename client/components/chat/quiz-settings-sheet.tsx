"use client";

import { Settings2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import {
  QuizSettingsForm,
  type QuizSettingsFormValues
} from "@/components/quiz/quiz-settings-form";
import { QuotaTooltip } from "@/components/billing/quota-tooltip";
import { type QuizGenerationSettings } from "@/lib/study";

type QuizSettingsSheetProps = {
  onGenerate: (message: string, settings: QuizGenerationSettings) => void;
  disabled?: boolean;
  disabledReason?: string | null;
  trigger?: ReactNode;
};

export function QuizSettingsSheet({ onGenerate, disabled, disabledReason, trigger }: QuizSettingsSheetProps) {
  const quotaDisabled = Boolean(disabledReason);
  const isDisabled = disabled || quotaDisabled;
  const [open, setOpen] = useState(false);
  const [formValues, setFormValues] = useState<QuizSettingsFormValues>({
    count: 10,
    timerMinutes: "",
    topicFocus: "",
    selectedTypes: ["mcq"],
    shuffleQuestions: false,
    shuffleOptions: true,
    optionsCount: 4
  });

  function handleGenerate() {
    const types = formValues.selectedTypes.length > 0 ? formValues.selectedTypes : ["mcq"];
    const typeLabel = types.map((type) => type.replace("_", " ")).join(", ");
    const timerPart =
      typeof formValues.timerMinutes === "number" && formValues.timerMinutes > 0
        ? ` with a ${formValues.timerMinutes} minute timer`
        : "";
    const topicPart = formValues.topicFocus.trim()
      ? ` on ${formValues.topicFocus.trim()}`
      : "";

    onGenerate(`Generate ${formValues.count} ${typeLabel} questions${topicPart}${timerPart}`, {
      count: formValues.count,
      question_types: types,
      timer_minutes: typeof formValues.timerMinutes === "number" ? formValues.timerMinutes : undefined,
      shuffle_questions: formValues.shuffleQuestions,
      shuffle_options: formValues.shuffleOptions,
      options_count: formValues.optionsCount,
      topic_focus: formValues.topicFocus.trim() || undefined
    });
    setOpen(false);
  }

  const defaultTrigger = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 text-xs text-muted-foreground"
      disabled={isDisabled}
    >
      <Settings2 className="h-3.5 w-3.5" />
      Quiz settings
    </Button>
  );

  const triggerNode = trigger ?? defaultTrigger;

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && quotaDisabled) return;
        setOpen(nextOpen);
      }}
    >
      {quotaDisabled ? (
        <QuotaTooltip reason={disabledReason}>{triggerNode}</QuotaTooltip>
      ) : (
        <SheetTrigger asChild disabled={disabled}>
          {triggerNode}
        </SheetTrigger>
      )}
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Quiz settings</SheetTitle>
          <SheetDescription>
            Configure question count, types, topic focus, and shuffle behavior before generating.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex-1">
          <QuizSettingsForm
            values={formValues}
            onChange={setFormValues}
            showOptionsCount
            showAdvancedTypes
            idPrefix="chat-quiz"
          />
        </div>

        <SheetFooter className="sticky bottom-0 mt-8 border-t bg-background pt-4">
          <Button type="button" onClick={handleGenerate} disabled={isDisabled} className="w-full">
            Generate with settings
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
