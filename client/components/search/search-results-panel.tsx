"use client";

import { Search, Sparkles } from "lucide-react";

import { SearchResultCard } from "@/components/search/search-result-card";
import { SearchResultsToolbar } from "@/components/search/search-results-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchResultsSkeleton } from "@/components/search/search-results-skeleton";
import { PagePaginationControls } from "@/components/ui/pagination-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchResultsView } from "@/hooks/use-search-results-view";
import type { StudySearchMode } from "@/hooks/use-study-search";
import type { AskSearchResponse, SearchResult } from "@/lib/search";

type SearchResultsPanelProps = {
  mode: StudySearchMode;
  isLoading: boolean;
  error: string | null;
  results: SearchResult[];
  activeSearchQuery: string;
  hasSubmitted: boolean;
  courseTitle: string | null;
  answer: AskSearchResponse | null;
  searchableInScope?: number;
};

export function SearchResultsPanel({
  mode,
  isLoading,
  error,
  results,
  activeSearchQuery,
  hasSubmitted,
  courseTitle,
  answer,
  searchableInScope = 0
}: SearchResultsPanelProps) {
  const resultsView = useSearchResultsView(results, activeSearchQuery);
  const rankOffset = (resultsView.page - 1) * resultsView.pageSize;

  return (
    <>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {!isLoading && searchableInScope === 0 ? (
        <EmptyState
          icon={Search}
          title="No processed materials yet"
          description="Upload course or chat materials with extracted text. Search uses those chunks (including chat uploads like lecture PDFs)."
          action={
            <Button asChild type="button" variant="outline">
              <a href="/courses">Open courses</a>
            </Button>
          }
        />
      ) : null}

      {isLoading ? <SearchResultsSkeleton mode={mode} /> : null}

      {!isLoading && answer ? <AskAnswerPanel answer={answer} /> : null}

      {!isLoading && !answer && searchableInScope > 0 && results.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">
              {results.length} result{results.length === 1 ? "" : "s"}
            </h2>
            <Badge variant="outline" className="tabular-nums">
              Query: {activeSearchQuery}
            </Badge>
          </div>

          <SearchResultsToolbar
            filters={resultsView.filters}
            availableSources={resultsView.availableSources}
            availableMaterials={resultsView.availableMaterials}
            totalCount={results.length}
            filteredCount={resultsView.filteredResults.length}
            hasActiveResultFilters={resultsView.hasActiveResultFilters}
            onFilterChange={resultsView.updateFilter}
            onClearFilters={resultsView.clearResultFilters}
          />

          {resultsView.filteredResults.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No results match your filters"
              description="Try lowering the minimum match score or clearing result filters."
              action={
                <Button type="button" variant="outline" onClick={resultsView.clearResultFilters}>
                  Clear result filters
                </Button>
              }
            />
          ) : (
            <>
              <div className="space-y-2">
                {resultsView.paginatedResults.map((result, index) => (
                  <SearchResultCard
                    key={result.chunk_id}
                    result={result}
                    rank={rankOffset + index + 1}
                  />
                ))}
              </div>
              <PagePaginationControls
                total={resultsView.filteredResults.length}
                page={resultsView.page}
                pageSize={resultsView.pageSize}
                onPageChange={resultsView.setPage}
              />
            </>
          )}
        </section>
      ) : null}

      {!isLoading && !answer && searchableInScope > 0 && hasSubmitted && results.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching passages"
          description={
            courseTitle
              ? `Nothing in ${courseTitle} matched that query yet. Upload or finish processing course materials, then try again.`
              : "Nothing in your library matched that query yet. Upload or finish processing materials, then try again."
          }
        />
      ) : null}

      {!isLoading && !answer && searchableInScope > 0 && !hasSubmitted ? (
        <EmptyState
          icon={Search}
          title="Search your study library"
          description={
            mode === "search"
              ? "Enter at least two characters to retrieve the most relevant passages from processed materials."
              : "Enter a question to retrieve the most relevant passages and receive a cited answer."
          }
        />
      ) : null}
    </>
  );
}

function AskAnswerPanel({ answer }: { answer: AskSearchResponse }) {
  return (
    <section className="rounded-xl border border-primary/20 bg-card">
      <Tabs defaultValue="answer">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 pt-4">
          <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
            <TabsTrigger value="answer" className="gap-1.5 data-[state=active]:bg-muted">
              <Sparkles className="h-3.5 w-3.5" />
              Answer
            </TabsTrigger>
            <TabsTrigger value="plan">Retrieval plan</TabsTrigger>
            <TabsTrigger value="citations">
              Citations{answer.citations.length > 0 ? ` (${answer.citations.length})` : ""}
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2 pb-2">
            {answer.used_fallback ? <Badge variant="warning">Fallback answer</Badge> : null}
            {answer.truncated ? <Badge variant="secondary">Context trimmed</Badge> : null}
            {answer.token_estimate ? <Badge variant="outline">{answer.token_estimate} tokens</Badge> : null}
          </div>
        </div>

        <TabsContent value="answer" className="space-y-4 px-4 py-4">
          <p className="whitespace-pre-wrap text-sm leading-7">{answer.answer || "Drafting answer..."}</p>
          {answer.citations.length > 0 ? (
            <Badge variant="success">{answer.citations.length} sources cited</Badge>
          ) : null}
        </TabsContent>

        <TabsContent value="plan" className="space-y-3 px-4 py-4">
          {answer.plan.length === 0 ? (
            <p className="text-sm text-muted-foreground">Planning retrieval...</p>
          ) : (
            answer.plan.map((step, index) => (
              <div key={`${step.query}-${index}`} className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">{step.query}</p>
                <p className="mt-1 text-xs text-muted-foreground">{step.reason}</p>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="citations" className="space-y-3 px-4 py-4">
          {answer.citations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching sources found.</p>
          ) : (
            answer.citations.map((citation) => (
              <div key={citation.chunk_id} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">[{citation.index}]</Badge>
                  <p className="text-sm font-medium">{citation.material_title}</p>
                  <Badge variant="outline">{citation.source}</Badge>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{citation.excerpt}</p>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
