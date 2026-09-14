"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_SEARCH_RESULT_FILTERS,
  filterSearchResults,
  hasActiveResultFilters,
  paginateItems,
  SEARCH_RESULTS_PAGE_SIZE,
  type SearchResultFilters,
  uniqueResultMaterials,
  uniqueResultSources
} from "@/lib/search-results";
import type { SearchResult } from "@/lib/search";

export function useSearchResultsView(results: SearchResult[], activeSearchQuery: string) {
  const [filters, setFilters] = useState<SearchResultFilters>(DEFAULT_SEARCH_RESULT_FILTERS);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    setFilters(DEFAULT_SEARCH_RESULT_FILTERS);
  }, [activeSearchQuery]);

  const filteredResults = useMemo(() => filterSearchResults(results, filters), [filters, results]);
  const paginatedResults = useMemo(
    () => paginateItems(filteredResults, page, SEARCH_RESULTS_PAGE_SIZE),
    [filteredResults, page]
  );
  const availableSources = useMemo(() => uniqueResultSources(results), [results]);
  const availableMaterials = useMemo(() => uniqueResultMaterials(results), [results]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredResults.length / SEARCH_RESULTS_PAGE_SIZE));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [filteredResults.length, page]);

  const updateFilter = useCallback(
    <K extends keyof SearchResultFilters>(key: K, value: SearchResultFilters[K]) => {
      setFilters((current) => ({ ...current, [key]: value }));
      setPage(1);
    },
    []
  );

  const clearResultFilters = useCallback(() => {
    setFilters(DEFAULT_SEARCH_RESULT_FILTERS);
    setPage(1);
  }, []);

  return {
    filters,
    page,
    pageSize: SEARCH_RESULTS_PAGE_SIZE,
    filteredResults,
    paginatedResults,
    availableSources,
    availableMaterials,
    hasActiveResultFilters: hasActiveResultFilters(filters),
    updateFilter,
    setPage,
    clearResultFilters
  };
}
