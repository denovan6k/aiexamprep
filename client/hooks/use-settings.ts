"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  createApiKey,
  deleteApiKey,
  getModelDefaults,
  listApiKeys,
  updateModelDefaults,
  type ApiKeyCreatePayload,
  type ModelDefaults
} from "@/lib/settings";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useApiKeysQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.settings.apiKeys(),
    queryFn: () => listApiKeys(token!),
    enabled: isAuthenticated(token)
  });
}

export function useCreateApiKeyMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ApiKeyCreatePayload) => createApiKey(token!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
    }
  });
}

export function useDeleteApiKeyMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => deleteApiKey(token!, keyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
    }
  });
}

export function useModelDefaultsQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.settings.modelDefaults(),
    queryFn: () => getModelDefaults(token!),
    enabled: isAuthenticated(token)
  });
}

export function useUpdateModelDefaultsMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModelDefaults) => updateModelDefaults(token!, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.settings.modelDefaults(), data);
    }
  });
}
