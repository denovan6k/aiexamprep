"use client";

import { SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { SearchResultFilters } from "@/lib/search-results";

const ALL_VALUE = "__all__";

type SearchResultsToolbarProps = {
  filters: SearchResultFilters;
  availableSources: string[];
  availableMaterials: string[];
  totalCount: number;
  filteredCount: number;
  hasActiveResultFilters: boolean;
  onFilterChange: <K extends keyof SearchResultFilters>(
    key: K,
    value: SearchResultFilters[K]
  ) => void;
  onClearFilters: () => void;
};

function formatSourceLabel(source: string) {
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function SearchResultsToolbar({
  filters,
  availableSources,
  availableMaterials,
  totalCount,
  filteredCount,
  hasActiveResultFilters,
  onFilterChange,
  onClearFilters
}: SearchResultsToolbarProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Refine results
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {hasActiveResultFilters
            ? `${filteredCount} of ${totalCount} passages`
            : `${totalCount} passage${totalCount === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="search-result-source">Source</Label>
          <Select
            value={filters.source || ALL_VALUE}
            onValueChange={(value) =>
              onFilterChange("source", value === ALL_VALUE ? "" : value)
            }
          >
            <SelectTrigger id="search-result-source">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All sources</SelectItem>
              {availableSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {formatSourceLabel(source)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="search-result-score">Min match</Label>
          <Select
            value={String(filters.minScore)}
            onValueChange={(value) => onFilterChange("minScore", Number(value))}
          >
            <SelectTrigger id="search-result-score">
              <SelectValue placeholder="Any match" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any match</SelectItem>
              <SelectItem value="0.5">50% or higher</SelectItem>
              <SelectItem value="0.75">75% or higher</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="search-result-material">Material</Label>
          <Select
            value={filters.materialTitle || ALL_VALUE}
            onValueChange={(value) =>
              onFilterChange("materialTitle", value === ALL_VALUE ? "" : value)
            }
          >
            <SelectTrigger id="search-result-material">
              <SelectValue placeholder="All materials" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All materials</SelectItem>
              {availableMaterials.map((material) => (
                <SelectItem key={material} value={material}>
                  {material}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="search-result-sort">Sort by</Label>
          <Select
            value={filters.sort}
            onValueChange={(value) =>
              onFilterChange("sort", value as SearchResultFilters["sort"])
            }
          >
            <SelectTrigger id="search-result-sort">
              <SelectValue placeholder="Best match" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Best match</SelectItem>
              <SelectItem value="material">Material A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasActiveResultFilters ? (
        <Button type="button" variant="outline" size="sm" onClick={onClearFilters} className="gap-2">
          <X className="h-4 w-4" />
          Clear result filters
        </Button>
      ) : null}
    </div>
  );
}
