"use client";

import { useEffect, useState } from "react";

import { QuizPlayer } from "@/components/quiz/quiz-player";
import { QuizSetupLanding, QuizSetupModal } from "@/components/quiz/quiz-setup";
import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveQuizAttempt, getQuiz, startQuizAttempt, type Quiz, type QuizAttempt } from "@/lib/study";

function QuizPlaySkeleton() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export function QuizPlayPage({ quizId }: { quizId: string }) {
  const { token } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!token || !quizId) return;

    let cancelled = false;
    async function load(sessionToken: string, id: string) {
      try {
        const [loadedQuiz, activeAttempt] = await Promise.all([
          getQuiz(sessionToken, id),
          getActiveQuizAttempt(sessionToken, id)
        ]);
        if (!cancelled) {
          setQuiz(loadedQuiz);
          setAttempt(activeAttempt);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load quiz");
      }
    }

    void load(token, quizId);
    return () => {
      cancelled = true;
    };
  }, [token, quizId]);

  async function handleStart(updatedQuiz: Quiz) {
    if (!token || isStarting) return;
    setIsStarting(true);
    setError(null);
    try {
      const loadedAttempt = await startQuizAttempt(token, updatedQuiz.id);
      setAttempt(loadedAttempt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start quiz");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <>
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {quiz && !attempt ? (
        <>
          <QuizSetupLanding
            quiz={quiz}
            onOpenSettings={() => setSettingsOpen(true)}
            onQuickStart={() => handleStart(quiz)}
            isStarting={isStarting}
          />
          <QuizSetupModal
            quiz={quiz}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            onQuizUpdated={setQuiz}
            onStart={handleStart}
            isStarting={isStarting}
          />
        </>
      ) : null}

      {quiz && attempt ? <QuizPlayer quiz={quiz} attempt={attempt} /> : null}

      {!quiz && !error ? <QuizPlaySkeleton /> : null}
    </>
  );
}
