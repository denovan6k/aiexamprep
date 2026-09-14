"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createGenerationProfile,
  deleteGenerationProfile,
  listGenerationProfiles,
  updateGenerationProfile,
  type GenerationProfilePayload
} from "@/lib/generation-profiles";
import { queryKeys } from "@/lib/query-keys";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useGenerationProfilesQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.settings.generationProfiles(),
    queryFn: () => listGenerationProfiles(token!),
    enabled: isAuthenticated(token)
  });
}

export function useCreateGenerationProfileMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerationProfilePayload) => createGenerationProfile(token!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.generationProfiles() });
    }
  });
}

export function useUpdateGenerationProfileMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, payload }: { profileId: string; payload: GenerationProfilePayload }) =>
      updateGenerationProfile(token!, profileId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.generationProfiles() });
    }
  });
}

export function useDeleteGenerationProfileMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => deleteGenerationProfile(token!, profileId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.generationProfiles() });
    }
  });
}
