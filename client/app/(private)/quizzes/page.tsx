"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, CheckCircle2, Link2, ListChecks, Plus, ToggleLeft } from "lucide-react";

import { StudyBuilderDialog } from "@/components/study-builder/study-builder-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemCard, PageHeader, SectionGrid, SectionTitle, Stat } from "@/components/page-kit";
import { useListPageState } from "@/hooks/use-list-page-state";
import { useQuizzesQuery } from "@/hooks/use-quizzes";
import { siteConfig } from "@/lib/site";
import { asRoute } from "@/lib/utils";

export default function QuizzesPage() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const listState = useListPageState();
  const { data, isLoading, error } = useQuizzesQuery({
    limit: listState.limit,
    offset: listState.offset,
    q: listState.query || undefined,
    status: listState.status || undefined
  });
  const quizzes = data?.items ?? [];
  const total = data?.total ?? 0;
  const readyCount = typeof data?.meta?.ready_count === "number" ? data.meta.ready_count : 0;

  return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Quizzes"
          title="Focused practice sets"
          description="Quizzes generated from your materials and chat sessions. Start a timed attempt or review past results."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-2" onClick={() => setBuilderOpen(true)}>
                <Plus className="h-4 w-4" />
                Create
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link href={asRoute("/chat")}>Generate in chat</Link>
              </Button>
            </div>
          }
        />

        <ListToolbar
          searchValue={listState.searchInput}
          onSearchValueChange={listState.setSearchInput}
          onSearchSubmit={listState.applySearch}
          searchPlaceholder="Search quizzes..."
        >
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={listState.status}
            onChange={(event) => listState.updateStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ready">Ready</option>
            <option value="draft">Draft</option>
            <option value="generating">Generating</option>
          </select>
        </ListToolbar>

        {error ? <p className="mb-4 text-sm text-danger">{error.message}</p> : null}
        <SectionGrid>
          <Stat
            label="Ready quizzes"
            value={isLoading ? "—" : String(readyCount)}
            icon={CheckCircle2}
            tone="success"
          />
          <Stat label="Total quizzes" value={isLoading ? "—" : String(total)} icon={BookOpen} />
          <Stat
            label="Question types"
            icon={ListChecks}
            tone="success"
            items={[
              { label: "MCQ", icon: ListChecks },
              { label: "T/F", icon: ToggleLeft },
              { label: "Matching", icon: Link2 }
            ]}
          />
        </SectionGrid>

        <SectionTitle title="Your practice sets" />
        {isLoading ? (
          <SectionGrid>
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-44 w-full rounded-xl" />
            ))}
          </SectionGrid>
        ) : quizzes.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={listState.query || listState.status ? "No quizzes match your filters" : "No quizzes yet"}
            description={
              listState.query || listState.status
                ? "Try a different search or clear filters."
                : `Generate your first quiz in chat. ${siteConfig.name} builds questions from your uploaded materials.`
            }
            action={
              listState.query || listState.status ? (
                <Button variant="outline" onClick={listState.resetFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setBuilderOpen(true)}>Create a quiz</Button>
              )
            }
          />
        ) : (
          <>
            <SectionGrid>
              {quizzes.map((quiz) => (
                <ItemCard
                  key={quiz.id}
                  eyebrow={quiz.status}
                  title={quiz.title}
                  description={`${quiz.question_count} questions`}
                  meta={quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : ""}
                  href={asRoute(`/quizzes/${quiz.id}/${quiz.status === "draft" ? "edit" : "play"}`)}
                />
              ))}
            </SectionGrid>
            <PaginationControls
              className="mt-6"
              total={total}
              limit={listState.limit}
              offset={listState.offset}
              onPageChange={listState.setOffset}
            />
          </>
        )}

        <StudyBuilderDialog open={builderOpen} onOpenChange={setBuilderOpen} defaultTab="quiz" />
      </div>
  );
}
