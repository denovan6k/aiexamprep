"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { RemediationPanel } from "@/components/quiz/remediation-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PagePaginationControls } from "@/components/ui/pagination-controls";
import {
  formatQuizCorrectAnswer,
  formatQuizUserAnswer,
  getQuizAnswerStatus,
  getQuizSourceMaterialNames,
  isObjectiveQuestionType,
  type QuizAnswerStatus
} from "@/lib/quiz-answer-display";
import type { QuizAnswer, QuizQuestion, QuizReview as QuizReviewData } from "@/lib/study";
import { asRoute, cn } from "@/lib/utils";

const PAGE_SIZE = 5;

type QuizReviewProps = {
  review: QuizReviewData;
};

type ReviewFilter = "all" | "incorrect";

function statusBadge(status: QuizAnswerStatus) {
  switch (status) {
    case "correct":
      return <Badge variant="success">Correct</Badge>;
    case "incorrect":
      return <Badge variant="danger">Incorrect</Badge>;
    case "partial":
      return <Badge variant="warning">Partial credit</Badge>;
    default:
      return <Badge variant="secondary">Reviewed</Badge>;
  }
}

function QuestionReviewCard({
  question,
  answer,
  index
}: {
  question: QuizQuestion;
  answer: QuizAnswer | undefined;
  index: number;
}) {
  const status = getQuizAnswerStatus(answer);
  const userAnswer = formatQuizUserAnswer(question, answer?.answer);
  const correctAnswer = formatQuizCorrectAnswer(question);
  const sourceMaterials = getQuizSourceMaterialNames(question);
  const showCorrectAnswer = isObjectiveQuestionType(question.type) && correctAnswer;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm">Question {index + 1}</CardTitle>
          {statusBadge(status)}
        </div>
        <p className="break-words text-sm leading-relaxed">{question.prompt}</p>
        {question.topic ? (
          <div className="pt-1">
            <Badge variant="outline" className="text-xs">
              {question.topic}
            </Badge>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div
          className={cn(
            "rounded-lg border px-3 py-2.5",
            status === "correct" && "border-success/30 bg-success/5",
            status === "incorrect" && "border-danger/30 bg-danger/5",
            status === "partial" && "border-warning/30 bg-warning/5",
            status === "reviewed" && "border-border bg-muted/20"
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your answer</p>
          <p className="mt-1 leading-relaxed">{userAnswer}</p>
        </div>

        {showCorrectAnswer ? (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Correct answer</p>
            <p className="mt-1 leading-relaxed">{correctAnswer}</p>
          </div>
        ) : null}

        {answer?.feedback ? <p className="text-muted-foreground">{answer.feedback}</p> : null}

        {question.explanation ? (
          <p>
            <span className="font-medium">Explanation: </span>
            {question.explanation}
          </p>
        ) : null}

        {sourceMaterials.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Source material
            </span>
            {sourceMaterials.map((material) => (
              <Badge key={material} variant="secondary" className="text-xs">
                {material}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function QuizReview({ review }: QuizReviewProps) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [page, setPage] = useState(1);

  const answersByQuestion = useMemo(
    () => Object.fromEntries(review.answers.map((answer) => [answer.question_id, answer])),
    [review.answers]
  );

  const incorrectIds = useMemo(
    () => new Set(review.incorrect_question_ids ?? []),
    [review.incorrect_question_ids]
  );

  const filteredQuestions = useMemo(() => {
    if (filter === "incorrect") {
      return review.questions.filter((question) => incorrectIds.has(question.id));
    }
    return review.questions;
  }, [filter, incorrectIds, review.questions]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedQuestions = filteredQuestions.slice(pageStart, pageStart + PAGE_SIZE);

  const score = review.attempt.score ? Number(review.attempt.score) : 0;
  const maxScore = review.attempt.max_score ? Number(review.attempt.max_score) : review.questions.length;
  const pct = maxScore ? Math.round((score / maxScore) * 100) : 0;

  function handleFilterChange(nextFilter: ReviewFilter) {
    setFilter(nextFilter);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quiz results</CardTitle>
          <p className="text-sm text-muted-foreground">
            Score: {score}/{maxScore} ({pct}%)
          </p>
        </CardHeader>
        {review.weak_topics.length > 0 ? (
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Weak topics</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {review.weak_topics.map((topic) => (
                <Badge key={topic} variant="danger">
                  {topic}
                </Badge>
              ))}
            </div>
          </CardContent>
        ) : null}
      </Card>

      <RemediationPanel attemptId={review.attempt.id} />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredQuestions.length} question{filteredQuestions.length === 1 ? "" : "s"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => handleFilterChange("all")}
          >
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "incorrect" ? "default" : "outline"}
            onClick={() => handleFilterChange("incorrect")}
            disabled={incorrectIds.size === 0}
          >
            Incorrect only
          </Button>
        </div>
      </div>

      {filteredQuestions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No incorrect answers to review.
          </CardContent>
        </Card>
      ) : (
        <>
          <PagePaginationControls
            total={filteredQuestions.length}
            page={currentPage}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />

          <div className="space-y-4">
            {pagedQuestions.map((question) => {
              const globalIndex = review.questions.findIndex((item) => item.id === question.id);
              const questionKey = question.id?.trim() ? question.id : `question-${globalIndex}`;
              return (
                <QuestionReviewCard
                  key={questionKey}
                  question={question}
                  answer={answersByQuestion[question.id]}
                  index={globalIndex}
                />
              );
            })}
          </div>

          <PagePaginationControls
            total={filteredQuestions.length}
            page={currentPage}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={asRoute("/quizzes")}>Back to quizzes</Link>
        </Button>
        <Button asChild size="sm">
          <Link href={asRoute("/chat")}>Return to chat</Link>
        </Button>
      </div>
    </div>
  );
}
