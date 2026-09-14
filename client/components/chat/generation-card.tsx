import Link from "next/link";
import { ListChecks } from "lucide-react";

import { QuestionRating } from "@/components/chat/question-rating";
import { Button } from "@/components/ui/button";
import {
  Steps,
  StepsContent,
  StepsItem,
  StepsTrigger
} from "@/components/ui/steps";
import type { QuizPreview } from "@/lib/chat";
import { asRoute } from "@/lib/utils";

type GenerationCardProps = {
  quiz: QuizPreview;
};

function optionLabel(option: { id?: string; label?: string; text?: string }) {
  return option.label ?? option.text ?? option.id ?? "";
}

export function GenerationCard({ quiz }: GenerationCardProps) {
  const preview = quiz.questions.slice(0, 3);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{quiz.title}</p>
            <p className="text-xs text-muted-foreground">
              {quiz.questions.length} questions · {quiz.status}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="rounded-full">
              <Link href={asRoute(`/quizzes/${quiz.id}/play`)}>Start quiz</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link href={asRoute("/quizzes")}>All quizzes</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <Steps defaultOpen className="mb-1">
          <StepsTrigger leftIcon={<ListChecks className="size-4" />}>
            Next steps
          </StepsTrigger>
          <StepsContent>
            <StepsItem>1. Customize timer, shuffle, and question count</StepsItem>
            <StepsItem>2. Regenerate if you want fresh questions</StepsItem>
            <StepsItem>3. Start the quiz and review weak topics after</StepsItem>
          </StepsContent>
        </Steps>

        <div className="space-y-3">
          {preview.map((question, index) => (
            <div key={question.id} className="rounded-xl border border-border/60 bg-background p-3">
              <p className="text-xs font-medium text-muted-foreground">Question {index + 1}</p>
              <p className="mt-1 text-sm">{question.prompt}</p>
              {question.options?.length ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {question.options.map((option, optionIndex) => (
                    <li key={optionIndex}>
                      {String.fromCharCode(65 + optionIndex)}. {optionLabel(option)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <QuestionRating questionId={question.id} className="mt-2" />
            </div>
          ))}
        </div>

        {quiz.questions.length > preview.length ? (
          <p className="text-xs text-muted-foreground">
            +{quiz.questions.length - preview.length} more in full quiz
          </p>
        ) : null}
      </div>
    </div>
  );
}
