"use client";

import { useEffect, useState } from "react";

import { QuizReview } from "@/components/quiz/quiz-review";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getQuizReview, type QuizReview as QuizReviewData } from "@/lib/study";

function QuizReviewSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-7 w-64" />
        </CardContent>
      </Card>
      {[1, 2, 3].map((item) => (
        <Card key={item}>
          <CardHeader className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function QuizReviewPage({ attemptId }: { attemptId: string }) {
  const { token } = useAuth();
  const [review, setReview] = useState<QuizReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !attemptId) return;

    let cancelled = false;
    async function load(sessionToken: string, id: string) {
      try {
        const loadedReview = await getQuizReview(sessionToken, id);
        if (!cancelled) {
          setReview(loadedReview);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load review");
      }
    }

    void load(token, attemptId);
    return () => {
      cancelled = true;
    };
  }, [token, attemptId]);

  return (
    <div className="mx-auto max-w-3xl py-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {review ? <QuizReview review={review} /> : null}
      {!review && !error ? <QuizReviewSkeleton /> : null}
    </div>
  );
}
