import { QuizReviewPage } from "@/components/quiz/quiz-review-page";

export default async function QuizReviewRoute({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <QuizReviewPage attemptId={attemptId} />;
}
