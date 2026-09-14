"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { askMaterials, askMaterialsStream, searchMaterials, type SearchRequest } from "@/lib/search";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

const MIN_SEARCH_QUERY_LENGTH = 2;

export function useSearchMaterialsQuery(
  request: SearchRequest | null,
  options?: { enabled?: boolean }
) {
  const token = useAuthToken();
  const trimmed = request?.query.trim() ?? "";
  const enabled =
    (options?.enabled ?? true) &&
    isAuthenticated(token) &&
    Boolean(request) &&
    trimmed.length >= MIN_SEARCH_QUERY_LENGTH;

  return useQuery({
    queryKey: queryKeys.search.results(trimmed, {
      course_id: request?.course_id ?? null,
      material_ids: request?.material_ids ?? [],
      limit: request?.limit ?? 10
    }),
    queryFn: () => searchMaterials(token!, request!),
    enabled,
    staleTime: 30_000,
    retry: 1,
    placeholderData: keepPreviousData
  });
}

export function useSearchMaterialsMutation() {
  const token = useAuthToken();
  return useMutation({
    mutationFn: (request: SearchRequest) => searchMaterials(token!, request)
  });
}

export function useAskMaterialsMutation() {
  const token = useAuthToken();
  return useMutation({
    mutationFn: (request: SearchRequest & { max_subqueries?: number }) => askMaterials(token!, request),
    mutationKey: queryKeys.search.ask("mutation")
  });
}

export function useAskMaterialsStreamMutation() {
  const token = useAuthToken();
  return useMutation({
    mutationFn: async ({
      request,
      onEvent
    }: {
      request: SearchRequest & { max_subqueries?: number };
      onEvent: Parameters<typeof askMaterialsStream>[2];
    }) => askMaterialsStream(token!, request, onEvent)
  });
}
