"use client";

import { useEffect, useMemo, useState } from "react";

import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-kit";

import { MaterialPicker } from "@/components/study-builder/material-picker";
import { McqQuestionEditor, type McqOption } from "@/components/study-builder/quiz/mcq-question-editor";
import { ShortAnswerQuestionEditor } from "@/components/study-builder/quiz/short-answer-question-editor";

import { asRoute } from "@/lib/utils";
import { showError, showSuccess } from "@/lib/toast";
import { useQuizEditorQuery, usePopulateQuizMutation, useUpdateQuizContentMutation } from "@/hooks/use-quizzes";
import type {
  QuizManualMCQQuestionInput,
  QuizManualQuestionInput,
  QuizManualShortAnswerQuestionInput
} from "@/lib/study";

export default function QuizEditPage() {
  const params = useParams<{ quizId: string }>();
  const id = params.quizId;

  const { data, isLoading, error, refetch } = useQuizEditorQuery(id);
  const updateMutation = useUpdateQuizContentMutation();
  const populateMutation = usePopulateQuizMutation();

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"draft" | "ready">("draft");
  const [shortAnswerGrading, setShortAnswerGrading] = useState<"provided_answers" | "ai_correctness">(
    "provided_answers"
  );
  const [optionsCount, setOptionsCount] = useState<number>(4);
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuizManualQuestionInput[]>([]);

  const questionType = useMemo(() => {
    const cfg = data?.config as unknown as { question_types?: unknown };
    const qt = cfg?.question_types;
    if (Array.isArray(qt) && qt.length) return String(qt[0]);

    const qs = (data as unknown as { questions?: unknown }).questions;
    if (Array.isArray(qs) && qs.length && typeof (qs[0] as any)?.type === "string") {
      return (qs[0] as any).type as string;
    }

    return undefined;
  }, [data]);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title ?? "");
    setStatus(data.status === "ready" ? "ready" : "draft");

    if (typeof data.config?.short_answer_grading === "string") {
      setShortAnswerGrading(data.config.short_answer_grading as typeof shortAnswerGrading);
    }
    if (typeof data.config?.options_count === "number") {
      setOptionsCount(data.config.options_count);
    } else if (data.questions?.[0]?.type === "mcq" && Array.isArray(data.questions[0].options)) {
      setOptionsCount(data.questions[0].options.length);
    }

    const mapped: QuizManualQuestionInput[] = (data.questions ?? []).map((q) => {
      if (q.type === "mcq" || q.type === "multi_select") {
        const mcqOpts =
          (Array.isArray(q.options) ? q.options : [])?.map((o: any) => ({ id: o.id as string, text: o.text as string })) ??
          [];
        const correct = Array.isArray(q.correct_answers) && q.correct_answers.length ? String(q.correct_answers[0]) : "";
        return {
          type: "mcq",
          prompt: q.prompt ?? "",
          options: mcqOpts,
          correct_option_id: correct,
          explanation: q.explanation ?? null
        } satisfies QuizManualMCQQuestionInput;
      }

      const modelAnswers = Array.isArray(q.correct_answers) ? q.correct_answers.map((x) => String(x)) : [];
      return {
        type: "short_answer",
        prompt: q.prompt ?? "",
        model_answers: modelAnswers,
        explanation: q.explanation ?? null
      } satisfies QuizManualShortAnswerQuestionInput;
    });
    setQuestions(mapped);
  }, [data]);

  async function handleSave(nextStatus: "draft" | "ready") {
    if (!id || !questions.length) return;
    try {
      await updateMutation.mutateAsync({
        quizId: id,
        input: {
          status: nextStatus,
          title,
          short_answer_grading: questionType === "short_answer" ? shortAnswerGrading : undefined,
          options_count: questionType === "mcq" ? optionsCount : undefined,
          questions
        }
      });
      setStatus(nextStatus);
      showSuccess(nextStatus === "ready" ? "Quiz published." : "Draft saved.");
      await refetch();
    } catch (err) {
      showError(err, "Failed to save quiz.");
    }
  }

  async function handlePopulate() {
    if (!id || !questions.length) return;
    if (materialIds.length === 0) {
      showError(new Error("Select at least one material."), "Fill from materials failed.");
      return;
    }
    try {
      await populateMutation.mutateAsync({
        quizId: id,
        input: {
          material_ids: materialIds,
          count: questions.length,
          options_count: questionType === "mcq" ? optionsCount : undefined,
          topic_focus: title
        }
      });
      await refetch();
      showSuccess("Filled from materials.");
    } catch (err) {
      showError(err, "Fill from materials failed.");
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl py-8">
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">Loading quiz…</CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl py-8">
        <p className="text-danger">Failed to load quiz: {error.message}</p>
      </div>
    );
  }

  const isLocked = status === "ready";

  return (
    <div className="mx-auto max-w-5xl py-4">
      <PageHeader
        eyebrow={isLocked ? "Ready" : "Draft"}
        title={title || "Manual quiz"}
        description="Edit the authored questions. AI fill updates the draft; nothing is playable until you publish."
        actions={
          <Button asChild size="sm" variant="outline">
            <a href={asRoute(`/quizzes/${id}/play`)}>{isLocked ? "Play" : "Preview"}</a>
          </Button>
        }
      />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Quiz content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quiz-title">Title</Label>
            <Input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {questionType === "short_answer" ? (
            <div className="space-y-2">
              <Label>Short-answer grading</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={shortAnswerGrading}
                onChange={(e) => setShortAnswerGrading(e.target.value as any)}
                disabled={isLocked}
              >
                <option value="provided_answers">Keyword heuristic (author answers)</option>
                <option value="ai_correctness">AI correctness (against author answers)</option>
              </select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Fill from materials</Label>
            <MaterialPicker selectedMaterialIds={materialIds} onChange={setMaterialIds} disabled={isLocked} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void handlePopulate()} disabled={isLocked || populateMutation.isPending}>
                {populateMutation.isPending ? "Filling…" : "Fill from materials"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {questions.map((q, idx) => {
              if (q.type === "mcq") {
                return (
                  <McqQuestionEditor
                    key={idx}
                    prompt={q.prompt}
                    options={q.options.map((o) => o as McqOption)}
                    correctOptionId={q.correct_option_id}
                    explanation={q.explanation}
                    onChange={(next) => {
                      const updated = [...questions];
                      updated[idx] = { ...updated[idx], ...next } as QuizManualQuestionInput;
                      setQuestions(updated);
                    }}
                  />
                );
              }

              return (
                <ShortAnswerQuestionEditor
                  key={idx}
                  prompt={q.prompt}
                  modelAnswers={q.model_answers}
                  explanation={q.explanation}
                  onChange={(next) => {
                    const updated = [...questions];
                    updated[idx] = { ...updated[idx], ...next } as QuizManualQuestionInput;
                    setQuestions(updated);
                  }}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSave("draft")}
              disabled={updateMutation.isPending}
            >
              Save draft
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave("ready")}
              disabled={updateMutation.isPending || questions.length === 0}
            >
              Publish
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLocked ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Published quizzes can’t be edited after an attempt is submitted.
        </p>
      ) : null}
    </div>
  );
}

