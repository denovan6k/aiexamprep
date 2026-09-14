"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-kit";

import { useCreateManualQuizMutation } from "@/hooks/use-quizzes";
import { asRoute } from "@/lib/utils";
import type {
  QuizManualCreateInput,
  QuizManualMCQQuestionInput,
  QuizManualShortAnswerQuestionInput,
  ShortAnswerGradingMode
} from "@/lib/study";

function makeOptionId(index: number) {
  return String.fromCharCode(97 + index);
}

export default function QuizzesNewPage() {
  const router = useRouter();
  const createMutation = useCreateManualQuizMutation();

  const [title, setTitle] = useState("Manual quiz");
  const [format, setFormat] = useState<"mcq" | "short_answer">("mcq");
  const [questionCount, setQuestionCount] = useState(5);
  const [optionsCount, setOptionsCount] = useState(4);
  const [shortAnswerGrading, setShortAnswerGrading] = useState<ShortAnswerGradingMode>("provided_answers");

  const questions = useMemo(() => {
    if (format === "mcq") {
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
  }, [format, optionsCount, questionCount]);

  async function handleCreate() {
    const payload: QuizManualCreateInput = {
      title: title.trim() || "Manual quiz",
      questions,
      short_answer_grading: shortAnswerGrading,
      options_count: format === "mcq" ? optionsCount : null,
      shuffle_questions: false,
      shuffle_options: true
    };

    const created = await createMutation.mutateAsync(payload);
    router.push(asRoute(`/quizzes/${created.id}/edit`));
  }

  return (
    <div className="mx-auto max-w-3xl py-4">
      <PageHeader
        eyebrow="Manual builder"
        title="Create a quiz"
        description="Author MCQ or short-answer questions. Optionally fill from your processed materials, then edit and publish."
      />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Quiz settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quiz-title">Title</Label>
            <Input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as "mcq" | "short_answer")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">MCQ</SelectItem>
                  <SelectItem value="short_answer">Short answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="question-count">Question count</Label>
              <Input
                id="question-count"
                type="number"
                min={1}
                max={50}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
              />
            </div>
          </div>

          {format === "mcq" ? (
            <div className="space-y-2">
              <Label htmlFor="options-count">Options per question</Label>
              <Input
                id="options-count"
                type="number"
                min={2}
                max={6}
                value={optionsCount}
                onChange={(e) => setOptionsCount(Number(e.target.value))}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Short-answer grading</Label>
              <Select value={shortAnswerGrading} onValueChange={(v) => setShortAnswerGrading(v as ShortAnswerGradingMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="provided_answers">Keyword heuristic (author answers)</SelectItem>
                  <SelectItem value="ai_correctness">AI correctness (against author answers)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleCreate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create draft"}
            </Button>
            <Button asChild variant="outline">
              <Link href={asRoute("/chat")}>Back to chat</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder: materials are selected in the edit screen */}
      <div className="mt-6 text-sm text-muted-foreground">
        Materials are selected on the next screen (“Fill from materials”).
      </div>
    </div>
  );
}

