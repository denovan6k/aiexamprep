"use client";

import { useMutation } from "@tanstack/react-query";

import { sendProductEventBatch, type ProductEvent } from "@/lib/analytics";
import { queryKeys } from "@/lib/query-keys";

import { useAuthToken } from "./use-auth-token";

export function useProductAnalyticsBatchMutation() {
  const token = useAuthToken();
  return useMutation({
    mutationKey: [...queryKeys.analytics.events(), "batch"],
    mutationFn: (events: ProductEvent[]) => sendProductEventBatch(token!, events)
  });
}
