"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Layers, Sparkles } from "lucide-react";

import { MaterialPicker } from "@/components/study-builder/material-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateManualFlashcardDeckMutation, usePopulateManualFlashcardDeckMutation } from "@/hooks/use-flashcards";
import { useCreateManualQuizMutation, usePopulateQuizMutation } from "@/hooks/use-quizzes";
import type {
  FlashcardDeckCreateInput,
  QuizManualCreateInput,
  QuizManualMCQQuestionInput,
  QuizManualShortAnswerQuestionInput,
  ShortAnswerGradingMode
} from "@/lib/study";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

type StudyBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "quiz" | "flashcards";
};

function makeOptionId(index: number) {
  return String.fromCharCode(97 + index);
}

export function StudyBuilderDialog({
  open,
  onOpenChange,
  defaultTab = "quiz"
}: StudyBuilderDialogProps) {
  const router = useRouter();
  const createQuizMutation = useCreateManualQuizMutation();
  const populateQuizMutation = usePopulateQuizMutation();
  const createDeckMutation = useCreateManualFlashcardDeckMutation();
  const populateDeckMutation = usePopulateManualFlashcardDeckMutation();

  const [tab, setTab] = useState<"quiz" | "flashcards">(defaultTab);
  const [materialIds, setMaterialIds] = useState<string[]>([]);

  // Quiz state
  const [quizTitle, setQuizTitle] = useState("Manual quiz");
  const [quizFormat, setQuizFormat] = useState<"mcq" | "short_answer">("mcq");
  const [questionCount, setQuestionCount] = useState(10);
  const [optionsCount, setOptionsCount] = useState(4);
  const [shortAnswerGrading, setShortAnswerGrading] = useState<ShortAnswerGradingMode>("provided_answers");

  // Flashcard state
  const [deckTitle, setDeckTitle] = useState("Manual deck");
  const [cardCount, setCardCount] = useState(12);

  const quizQuestions = useMemo(() => {
    if (quizFormat === "mcq") {
      const opts = Array.from({ length: optionsCount }).map((_, i) => ({
        id: makeOptionId(i),
        text: ""
      }));
      return Array.from({ length: questionCount }).map<QuizManualMCQQuestionInput>(() => ({
        type: "mcq",
        prompt: "",
        options: opts,
        correct_option_id: "",
        explanation: null,
        topic: null,
        difficulty: null
      }));
    }
    return Array.from({ length: questionCount }).map<QuizManualShortAnswerQuestionInput>(() => ({
      type: "short_answer",
      prompt: "",
      model_answers: [],
      explanation: null,
      topic: null,
      difficulty: null
    }));
  }, [quizFormat, optionsCount, questionCount]);

  const isBusy =
    createQuizMutation.isPending ||
    populateQuizMutation.isPending ||
    createDeckMutation.isPending ||
    populateDeckMutation.isPending;

  async function handleCreateQuiz(fillFromMaterials: boolean) {
    const payload: QuizManualCreateInput = {
      title: quizTitle.trim() || "Manual quiz",
      questions: quizQuestions,
      short_answer_grading: shortAnswerGrading,
      options_count: quizFormat === "mcq" ? optionsCount : null,
      shuffle_questions: false,
      shuffle_options: true
    };

    try {
      const created = await createQuizMutation.mutateAsync(payload);

      if (fillFromMaterials) {
        if (materialIds.length === 0) {
          showError(new Error("Select at least one material."), "Fill from materials failed.");
          router.push(asRoute(`/quizzes/${created.id}/edit`));
          onOpenChange(false);
          return;
        }
        await populateQuizMutation.mutateAsync({
          quizId: created.id,
          input: {
            material_ids: materialIds,
            count: questionCount,
            options_count: quizFormat === "mcq" ? optionsCount : undefined,
            question_types: [quizFormat === "mcq" ? "mcq" : "short_answer"]
          }
        });
        showSuccess("Quiz created and filled from materials.");
      } else {
        showSuccess("Quiz draft created.");
      }

      onOpenChange(false);
      router.push(asRoute(`/quizzes/${created.id}/edit`));
    } catch (err) {
      showError(err, "Failed to create quiz.");
    }
  }

  async function handleCreateDeck(fillFromMaterials: boolean) {
    const cards = Array.from({ length: cardCount }).map(() => ({
      front: "",
      back: "",
      topic: null as string | null,
      difficulty: null as string | null
    }));

    const payload: FlashcardDeckCreateInput = {
      title: deckTitle.trim() || "Manual deck",
      cards
    };

    try {
      const created = await createDeckMutation.mutateAsync(payload);

      if (fillFromMaterials) {
        if (materialIds.length === 0) {
          showError(new Error("Select at least one material."), "Fill from materials failed.");
          router.push(asRoute(`/flashcards/${created.id}/edit`));
          onOpenChange(false);
          return;
        }
        await populateDeckMutation.mutateAsync({
          deckId: created.id,
          input: { material_ids: materialIds, count: cardCount }
        });
        showSuccess("Deck created and filled from materials.");
      } else {
        showSuccess("Flashcard deck created.");
      }

      onOpenChange(false);
      router.push(asRoute(`/flashcards/${created.id}/edit`));
    } catch (err) {
      showError(err, "Failed to create flashcard deck.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create study material</DialogTitle>
          <DialogDescription>
            Build a quiz or flashcard deck manually, or upload materials and let AI populate it
            based on your settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quiz" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Quiz
            </TabsTrigger>
            <TabsTrigger value="flashcards" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Flashcards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quiz" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="builder-quiz-title">Title</Label>
              <Input
                id="builder-quiz-title"
                value={quizTitle}
                onChange={(event) => setQuizTitle(event.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={quizFormat} onValueChange={(v) => setQuizFormat(v as typeof quizFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple choice</SelectItem>
                    <SelectItem value="short_answer">Short answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="builder-question-count">Question count</Label>
                <Input
                  id="builder-question-count"
                  type="number"
                  min={1}
                  max={50}
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value))}
                />
              </div>
            </div>

            {quizFormat === "mcq" ? (
              <div className="space-y-2">
                <Label htmlFor="builder-options-count">Options per question</Label>
                <Input
                  id="builder-options-count"
                  type="number"
                  min={2}
                  max={6}
                  value={optionsCount}
                  onChange={(event) => setOptionsCount(Number(event.target.value))}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Short-answer grading</Label>
                <Select
                  value={shortAnswerGrading}
                  onValueChange={(v) => setShortAnswerGrading(v as ShortAnswerGradingMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="provided_answers">
                      Keyword match (author-provided answers)
                    </SelectItem>
                    <SelectItem value="ai_correctness">
                      AI grading (correctness vs author answers)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose whether short answers are graded by keyword matching or AI correctness
                  against the answers you provide.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="flashcards" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="builder-deck-title">Title</Label>
              <Input
                id="builder-deck-title"
                value={deckTitle}
                onChange={(event) => setDeckTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Card count</Label>
              <Select value={String(cardCount)} onValueChange={(v) => setCardCount(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[6, 8, 10, 12, 15, 20, 30].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} cards
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-4">
          <Label className="text-sm font-medium">Materials (optional)</Label>
          <p className="text-xs text-muted-foreground">
            Upload or select processed materials. AI will generate content based on your settings
            above.
          </p>
          <MaterialPicker selectedMaterialIds={materialIds} onChange={setMaterialIds} disabled={isBusy} />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() =>
              void (tab === "quiz" ? handleCreateQuiz(false) : handleCreateDeck(false))
            }
          >
            Create blank draft
          </Button>
          <Button
            type="button"
            disabled={isBusy}
            className="gap-1.5"
            onClick={() =>
              void (tab === "quiz" ? handleCreateQuiz(true) : handleCreateDeck(true))
            }
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isBusy ? "Creating…" : "Create & fill from materials"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
