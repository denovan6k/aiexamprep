"use client";

import { useQuery } from "@tanstack/react-query";

import { listAiModels } from "@/lib/ai";
import { queryKeys } from "@/lib/query-keys";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useAiModelsQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.settings.aiModels(),
    queryFn: () => listAiModels(token!),
    enabled: isAuthenticated(token),
    staleTime: 60_000
  });
}
