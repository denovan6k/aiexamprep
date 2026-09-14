"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { QuizPreviewPanel } from "@/components/quiz/quiz-preview-panel";
import {
  QuizSettingsForm,
  type QuizSettingsFormValues
} from "@/components/quiz/quiz-settings-form";
import { useRegenerateQuizMutation, useUpdateQuizMutation } from "@/hooks/use-quizzes";
import { parseQuizTimerMinutes } from "@/hooks/use-quiz-countdown";
import { type Quiz, type QuizGenerationSettings } from "@/lib/study";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

type QuizSetupModalProps = {
  quiz: Quiz;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuizUpdated: (quiz: Quiz) => void;
  onStart: (quiz: Quiz) => void | Promise<void>;
  isStarting?: boolean;
};

function valuesFromQuiz(quiz: Quiz): QuizSettingsFormValues {
  const config = quiz.config ?? {};
  return {
    count: typeof config.count === "number" ? config.count : quiz.questions.length || 10,
    timerMinutes: typeof config.timer_minutes === "number" ? config.timer_minutes : "",
    topicFocus: typeof config.topic_focus === "string" ? config.topic_focus : "",
    selectedTypes:
      Array.isArray(config.question_types) && config.question_types.length > 0
        ? (config.question_types as string[])
        : ["mcq"],
    shuffleQuestions: Boolean(config.shuffle_questions),
    shuffleOptions: config.shuffle_options !== false,
    optionsCount: typeof config.options_count === "number" ? config.options_count : 4
  };
}

export function QuizSetupModal({
  quiz,
  open,
  onOpenChange,
  onQuizUpdated,
  onStart,
  isStarting = false
}: QuizSetupModalProps) {
  const updateMutation = useUpdateQuizMutation();
  const regenerateMutation = useRegenerateQuizMutation();
  const config = quiz.config ?? {};

  const [formValues, setFormValues] = useState<QuizSettingsFormValues>(() => valuesFromQuiz(quiz));

  const savedTimerMinutes = parseQuizTimerMinutes(config);
  const isExamMode = typeof formValues.timerMinutes === "number" && formValues.timerMinutes > 0;
  const timerUnsaved =
    isExamMode &&
    (savedTimerMinutes === null || savedTimerMinutes !== formValues.timerMinutes);
  const isSaving = updateMutation.isPending;
  const isRegenerating = regenerateMutation.isPending;
  const isBusy = isSaving || isRegenerating || isStarting;

  useEffect(() => {
    if (open) {
      setFormValues(valuesFromQuiz(quiz));
    }
  }, [open, quiz]);

  function buildPatchSettings() {
    return {
      timer_minutes: typeof formValues.timerMinutes === "number" ? formValues.timerMinutes : null,
      shuffle_questions: formValues.shuffleQuestions,
      shuffle_options: formValues.shuffleOptions
    };
  }

  async function handleStart() {
    if (quiz.questions.length === 0 || isBusy) return;
    try {
      const updated = await updateMutation.mutateAsync({
        quizId: quiz.id,
        settings: buildPatchSettings()
      });
      onQuizUpdated(updated);
      onOpenChange(false);
      await onStart(updated);
    } catch (err) {
      showError(err, "Failed to start quiz.");
    }
  }

  function handleSaveSettings() {
    updateMutation.mutate(
      { quizId: quiz.id, settings: buildPatchSettings() },
      {
        onSuccess: (updated) => {
          onQuizUpdated(updated);
          showSuccess("Quiz settings saved.");
        },
        onError: (err) => showError(err, "Failed to save quiz settings.")
      }
    );
  }

  function handleRegenerate() {
    const types = formValues.selectedTypes.length > 0 ? formValues.selectedTypes : ["mcq"];
    const settings: QuizGenerationSettings = {
      count: formValues.count,
      question_types: types,
      timer_minutes: typeof formValues.timerMinutes === "number" ? formValues.timerMinutes : undefined,
      shuffle_questions: formValues.shuffleQuestions,
      shuffle_options: formValues.shuffleOptions,
      topic_focus: formValues.topicFocus.trim() || undefined
    };

    updateMutation.mutate(
      { quizId: quiz.id, settings: buildPatchSettings() },
      {
        onSuccess: () => {
          regenerateMutation.mutate(
            {
              quizId: quiz.id,
              settings: {
                count: settings.count,
                question_types: settings.question_types,
                topic_focus: settings.topic_focus,
                timer_minutes: settings.timer_minutes,
                shuffle_questions: settings.shuffle_questions,
                shuffle_options: settings.shuffle_options
              }
            },
            {
              onSuccess: (updated) => {
                onQuizUpdated(updated);
                showSuccess(`Regenerated ${updated.questions.length} new questions.`);
              },
              onError: (err) => showError(err, "Failed to regenerate questions.")
            }
          );
        },
        onError: (err) => showError(err, "Failed to save settings before regenerating.")
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-6">
            <DialogTitle className="text-left">{quiz.title}</DialogTitle>
            <Badge variant={isExamMode ? "default" : "secondary"}>
              {isExamMode ? "Exam mode" : "Practice mode"}
            </Badge>
          </div>
          <DialogDescription className="text-left">
            Configure question types, shuffle behavior, and timer before you start. Regenerate to
            pull fresh questions from your materials.
          </DialogDescription>
        </DialogHeader>

        <QuizSettingsForm
          values={formValues}
          onChange={setFormValues}
          showAdvancedTypes
          idPrefix="setup"
        />

        <QuizPreviewPanel questions={quiz.questions} />

        {timerUnsaved ? (
          <p className="text-sm text-muted-foreground">
            Timer settings will be saved automatically when you start the quiz.
          </p>
        ) : null}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleSaveSettings} disabled={isBusy}>
              {isSaving ? "Saving…" : "Save settings"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRegenerate}
              disabled={isBusy}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isRegenerating ? "Regenerating…" : "Regenerate"}
            </Button>
          </div>
          <Button
            type="button"
            className="w-full sm:ml-auto sm:w-auto"
            onClick={() => void handleStart()}
            disabled={quiz.questions.length === 0 || isBusy}
          >
            {isStarting ? "Starting…" : "Start quiz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type QuizSetupLandingProps = {
  quiz: Quiz;
  onOpenSettings: () => void;
  onQuickStart: () => void | Promise<void>;
  isStarting?: boolean;
};

export function QuizSetupLanding({
  quiz,
  onOpenSettings,
  onQuickStart,
  isStarting = false
}: QuizSetupLandingProps) {
  const config = quiz.config ?? {};
  const timerMinutes = parseQuizTimerMinutes(config);
  const isExamMode = Boolean(timerMinutes && timerMinutes > 0);
  const questionCount = quiz.questions.length;
  const types = Array.isArray(config.question_types)
    ? (config.question_types as string[])
    : [...new Set(quiz.questions.map((q) => q.type))];

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-xl bg-card p-6 ring-1 ring-border sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{quiz.title}</h1>
          <Badge variant={isExamMode ? "default" : "secondary"}>
            {isExamMode ? "Exam mode" : "Practice mode"}
          </Badge>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {questionCount > 0
            ? `${questionCount} questions ready. Customize settings or start right away.`
            : "No questions yet. Open settings to regenerate from your materials."}
        </p>

        {types.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {types.map((type) => (
              <Badge key={type} variant="outline" className="capitalize">
                {type.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="gap-2 sm:flex-1"
            onClick={onOpenSettings}
          >
            <Settings2 className="h-4 w-4" />
            Customize
          </Button>
          <Button
            type="button"
            className="sm:flex-1"
            disabled={questionCount === 0 || isStarting}
            onClick={() => void onQuickStart()}
          >
            {isStarting ? "Starting…" : "Start quiz"}
          </Button>
        </div>
      </div>
      <div className="mt-4">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href={asRoute("/quizzes")}>
            <ArrowLeft className="h-4 w-4" />
            Back to quizzes
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** @deprecated Use QuizSetupModal + QuizSetupLanding instead. Kept for backward compatibility. */
export function QuizSetup({
  quiz,
  onQuizUpdated,
  onStart,
  isStarting = false
}: Omit<QuizSetupModalProps, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <QuizSetupLanding
        quiz={quiz}
        onOpenSettings={() => setOpen(true)}
        onQuickStart={() => onStart(quiz)}
        isStarting={isStarting}
      />
      <QuizSetupModal
        quiz={quiz}
        open={open}
        onOpenChange={setOpen}
        onQuizUpdated={onQuizUpdated}
        onStart={onStart}
        isStarting={isStarting}
      />
    </>
  );
}
