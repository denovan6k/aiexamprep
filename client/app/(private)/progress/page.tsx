"use client";

import Link from "next/link";
import { BookOpen, Sparkles } from "lucide-react";

import { ExamSessionShell } from "@/components/session/exam-session-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ItemCard, PageHeader, PrimaryLink, SectionGrid, SectionTitle, Stat } from "@/components/page-kit";
import { useFlashcardStudyStatsQuery, useProgressOverviewQuery } from "@/hooks/use-billing";
import { asRoute } from "@/lib/utils";

export default function ProgressPage() {
  const { data: overview, error: overviewError } = useProgressOverviewQuery();
  const { data: flashcardStats, error: statsError } = useFlashcardStudyStatsQuery();
  const error = overviewError ?? statsError;

  const readiness = overview?.average_score ?? 0;
  const topicScores = overview?.topic_scores ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Progress"
        title="Topic mastery overview"
        description="Attempts, average score, weak topics, and recommended next actions from your quiz history."
        actions={<PrimaryLink href="/quizzes">Practice weak topics</PrimaryLink>}
      />
      {error ? <p className="mb-4 text-sm text-danger">{error.message}</p> : null}
      <SectionGrid cols={4}>
        <Stat label="Quizzes taken" value={String(overview?.quizzes_taken ?? 0)} />
        <Stat label="Mock average" value={`${overview?.average_score ?? 0}%`} tone="success" />
        <Stat label="Weak topics" value={String(overview?.weak_topics.length ?? 0)} tone="danger" />
        <Stat label="Cards due" value={String(flashcardStats?.cards_due ?? 0)} tone="warning" />
      </SectionGrid>

      <SectionTitle title="Course readiness" />
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Overall readiness</CardTitle>
            <span className="text-2xl font-semibold">{readiness}%</span>
          </div>
          <CardDescription>Based on submitted quiz attempt scores.</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={readiness} className="h-3" />
        </CardContent>
      </Card>

      <SectionTitle title="Topic breakdown" />
      {topicScores.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Complete a few quizzes to see topic-level scores here.
          </CardContent>
        </Card>
      ) : (
        <SectionGrid>
          {topicScores.map((topic) => (
            <ItemCard
              key={topic.topic}
              eyebrow="Topic"
              title={topic.topic}
              description={`${topic.score_pct}% mastery`}
              meta={topic.score_pct < 60 ? "Needs review" : "On track"}
            />
          ))}
        </SectionGrid>
      )}

      <SectionTitle title="Next actions" />
      <SectionGrid cols={2}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Practice weak topics
            </CardTitle>
            <CardDescription>Run another quiz focused on your lowest-scoring areas.</CardDescription>
          </CardHeader>
          <CardContent>
            <PrimaryLink href="/quizzes">Open quizzes</PrimaryLink>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Review flashcards
            </CardTitle>
            <CardDescription>
              {flashcardStats?.cards_due
                ? `${flashcardStats.cards_due} cards due for spaced repetition.`
                : "Generate or study flashcards to reinforce weak areas."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PrimaryLink href="/flashcards">Open flashcards</PrimaryLink>
          </CardContent>
        </Card>
      </SectionGrid>

      {flashcardStats?.next_up ? (
        <>
          <SectionTitle title="Suggested next card" />
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-medium">{flashcardStats.next_up.label}</p>
                <p className="text-xs text-muted-foreground">{flashcardStats.next_up.topic ?? "General review"}</p>
              </div>
              <PrimaryLink href={asRoute(`/flashcards/${flashcardStats.next_up.deck_id}/study`)}>
                Study now
              </PrimaryLink>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
