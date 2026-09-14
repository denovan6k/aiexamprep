import type { SearchResult } from "@/lib/search";

export const SEARCH_RESULTS_PAGE_SIZE = 5;
export const SEARCH_FETCH_LIMIT = 20;

export type SearchResultSort = "score" | "material";

export type SearchResultFilters = {
  source: string;
  minScore: number;
  materialTitle: string;
  sort: SearchResultSort;
};

export const DEFAULT_SEARCH_RESULT_FILTERS: SearchResultFilters = {
  source: "",
  minScore: 0,
  materialTitle: "",
  sort: "score"
};

export function filterSearchResults(
  results: SearchResult[],
  filters: SearchResultFilters
): SearchResult[] {
  let filtered = results;

  if (filters.source) {
    filtered = filtered.filter((result) => result.source === filters.source);
  }
  if (filters.minScore > 0) {
    filtered = filtered.filter((result) => result.score >= filters.minScore);
  }
  if (filters.materialTitle) {
    filtered = filtered.filter((result) => result.material_title === filters.materialTitle);
  }

  const sorted = [...filtered];
  if (filters.sort === "material") {
    sorted.sort((a, b) => a.material_title.localeCompare(b.material_title));
  } else {
    sorted.sort((a, b) => b.score - a.score);
  }
  return sorted;
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function uniqueResultSources(results: SearchResult[]): string[] {
  return [...new Set(results.map((result) => result.source))].sort();
}

export function uniqueResultMaterials(results: SearchResult[]): string[] {
  return [...new Set(results.map((result) => result.material_title))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function hasActiveResultFilters(filters: SearchResultFilters): boolean {
  return (
    Boolean(filters.source) ||
    filters.minScore > 0 ||
    Boolean(filters.materialTitle) ||
    filters.sort !== DEFAULT_SEARCH_RESULT_FILTERS.sort
  );
}
