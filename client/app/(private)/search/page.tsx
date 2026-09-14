"use client";

import { Suspense } from "react";

import { PageHeader } from "@/components/page-kit";
import { SearchFiltersPanel } from "@/components/search/search-filters-panel";
import { SearchQueryPanel } from "@/components/search/search-query-panel";
import { SearchResultsPanel } from "@/components/search/search-results-panel";
import { SearchSidebar } from "@/components/search/search-sidebar";
import { Loader } from "@/components/ui/loader";
import { useStudySearch } from "@/hooks/use-study-search";

export default function StudySearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-6xl min-h-[20rem] items-center justify-center">
          <Loader variant="typing" size="md" />
        </div>
      }
    >
      <StudySearchContent />
    </Suspense>
  );
}

function StudySearchContent() {
  const search = useStudySearch();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Search"
        description={
          search.courseTitle
            ? `Find passages and cited answers in ${search.courseTitle}.`
            : "Search your processed materials or ask for a cited answer."
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="space-y-5">
          <SearchFiltersPanel
            courses={search.courses.data ?? []}
            coursesLoading={search.courses.isLoading}
            selectedCourseId={search.selectedCourseId}
            selectedMaterialIds={search.selectedMaterialIds}
            processedMaterials={search.processedMaterials}
            materialsLoading={search.materials.isLoading}
            hasActiveFilters={search.hasActiveFilters}
            onCourseChange={search.handleCourseChange}
            onToggleMaterial={search.toggleMaterial}
            onClearFilters={search.clearFilters}
          />

          <SearchQueryPanel
            mode={search.mode}
            query={search.query}
            isLoading={search.isLoading}
            onQueryChange={search.handleQueryChange}
            onModeChange={(nextMode) =>
              nextMode === "search" ? search.switchToSearchMode() : search.switchToAskMode()
            }
            onApplyPrompt={search.applyPrompt}
            onSubmit={search.handleSubmit}
          />

          <SearchResultsPanel
            mode={search.mode}
            isLoading={search.isLoading}
            error={search.error}
            results={search.results}
            activeSearchQuery={search.activeSearchQuery}
            hasSubmitted={search.hasSubmitted}
            courseTitle={search.courseTitle}
            answer={search.answer}
            searchableInScope={search.searchableInScope}
          />
        </div>

        <SearchSidebar selectedCourseId={search.selectedCourseId} />
      </div>
    </div>
  );
}
