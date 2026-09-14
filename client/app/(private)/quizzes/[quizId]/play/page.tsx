import { QuizPlayPage } from "@/components/quiz/quiz-play-page";

export default async function QuizPlayRoute({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  return <QuizPlayPage quizId={quizId} />;
}
