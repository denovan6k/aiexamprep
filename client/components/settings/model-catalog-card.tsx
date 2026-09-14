"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

import { SettingsCardFieldsSkeleton } from "@/components/settings/settings-card-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useAiModelsQuery } from "@/hooks/use-ai-models";
import type { AiModel, AiProviderModels } from "@/lib/ai";
import { flattenProviderModels } from "@/lib/ai";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";

const PAGE_SIZE = DEFAULT_PAGE_SIZE;
const ALL_PROVIDERS = "__all__";

type CatalogFilters = {
  query: string;
  providerId: string;
  freeOnly: boolean;
  reasoningOnly: boolean;
};

function matchesFilters(model: AiModel, filters: CatalogFilters): boolean {
  if (filters.providerId !== ALL_PROVIDERS && model.provider !== filters.providerId) {
    return false;
  }
  if (filters.freeOnly && !model.is_free) {
    return false;
  }
  if (filters.reasoningOnly && !model.supports_reasoning) {
    return false;
  }
  const q = filters.query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [model.id, model.name, model.description ?? ""].join(" ").toLowerCase();
  return haystack.includes(q);
}

export function ModelCatalogCard() {
  const { data: modelsData, isLoading } = useAiModelsQuery();
  const [query, setQuery] = useState("");
  const [providerId, setProviderId] = useState(ALL_PROVIDERS);
  const [freeOnly, setFreeOnly] = useState(false);
  const [reasoningOnly, setReasoningOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const providers: AiProviderModels[] = modelsData?.providers ?? [];
  const flatModels = useMemo(
    () => (modelsData ? flattenProviderModels(modelsData) : []),
    [modelsData]
  );

  const filters: CatalogFilters = {
    query: deferredQuery,
    providerId,
    freeOnly,
    reasoningOnly
  };

  const filtered = useMemo(
    () => flatModels.filter((model) => matchesFilters(model, filters)),
    [flatModels, filters.query, filters.providerId, filters.freeOnly, filters.reasoningOnly]
  );

  useEffect(() => {
    setOffset(0);
  }, [deferredQuery, providerId, freeOnly, reasoningOnly]);

  useEffect(() => {
    if (offset > 0 && offset >= filtered.length) {
      setOffset(0);
    }
  }, [filtered.length, offset]);

  const pageModels = filtered.slice(offset, offset + PAGE_SIZE);
  const providerNameById = useMemo(
    () => Object.fromEntries(providers.map((provider) => [provider.id, provider.name])),
    [providers]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">System model catalog</CardTitle>
        <CardDescription>
          Live view of AI models configured on this server. Search and filter when the list is large.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <SettingsCardFieldsSkeleton />
        ) : flatModels.length === 0 ? (
          <p className="text-sm text-muted-foreground">No models configured on this server.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="model-catalog-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="model-catalog-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter by name, id, or description"
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="model-catalog-provider">Provider</Label>
                <Select value={providerId} onValueChange={setProviderId}>
                  <SelectTrigger id="model-catalog-provider">
                    <SelectValue placeholder="All providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_PROVIDERS}>All providers</SelectItem>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quick filters</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <FilterChip active={freeOnly} onClick={() => setFreeOnly((prev) => !prev)}>
                    Free
                  </FilterChip>
                  <FilterChip
                    active={reasoningOnly}
                    onClick={() => setReasoningOnly((prev) => !prev)}
                  >
                    Reasoning
                  </FilterChip>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {filtered.length === flatModels.length
                ? `${flatModels.length} models available`
                : `${filtered.length} of ${flatModels.length} models match`}
              {modelsData?.default_provider && modelsData.default_model
                ? ` · Default: ${modelsData.default_provider} / ${modelsData.default_model}`
                : null}
            </p>

            {pageModels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No models match these filters.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {pageModels.map((model) => (
                  <div
                    key={`${model.provider ?? "platform"}:${model.id}`}
                    className="flex flex-col justify-between gap-2 rounded-lg border border-border bg-card/50 p-3 transition-colors hover:bg-accent/10"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold">{model.name}</span>
                        {model.is_free ? (
                          <Badge variant="success" className="h-4 px-1 py-0 text-[9px]">
                            Free
                          </Badge>
                        ) : null}
                        {model.supports_reasoning ? (
                          <Badge variant="secondary" className="h-4 px-1 py-0 text-[9px]">
                            Reasoning
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate font-mono text-[10px] text-muted-foreground" title={model.id}>
                        {model.id}
                      </p>
                      {model.provider ? (
                        <p className="text-[10px] capitalize text-muted-foreground">
                          {providerNameById[model.provider] ?? model.provider}
                        </p>
                      ) : null}
                      {model.description ? (
                        <p className="line-clamp-2 pt-0.5 text-[11px] text-muted-foreground">
                          {model.description}
                        </p>
                      ) : null}
                    </div>
                    {model.context_length ? (
                      <div className="mt-auto border-t border-border/50 pt-1.5 text-[10px] text-muted-foreground">
                        Context: {model.context_length.toLocaleString()} tokens
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            <PaginationControls
              total={filtered.length}
              limit={PAGE_SIZE}
              offset={offset}
              onPageChange={setOffset}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-accent/40"
      )}
    >
      {children}
    </button>
  );
}
