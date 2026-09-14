"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getJob } from "@/lib/jobs";
import { queryKeys } from "@/lib/query-keys";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useJobQuery(
  jobId: string | null,
  options?: { refetchInterval?: number | false; enabled?: boolean }
) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.jobs.job(jobId!),
    queryFn: () => getJob(token!, jobId!),
    enabled: isAuthenticated(token) && Boolean(jobId) && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval
  });
}

export function useInvalidateJob() {
  const queryClient = useQueryClient();
  return (jobId: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.job(jobId) });
  };
}
