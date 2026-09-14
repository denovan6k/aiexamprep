"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCvTailoring,
  deleteCvDocument,
  deleteCvTailoring,
  downloadTailoredCv,
  getCvTailoring,
  listCvDocuments,
  listCvTailorings,
  uploadCvDocument,
  type CreateTailoringInput
} from "@/lib/cv";
import type { ListParams } from "@/lib/pagination";
import { queryKeys } from "@/lib/query-keys";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useCvDocumentsQuery(params: ListParams = {}) {
  const token = useAuthToken();
  const normalized = { limit: 12, offset: 0, ...params };
  return useQuery({
    queryKey: [...queryKeys.cv.documents(), normalized],
    queryFn: () => listCvDocuments(token!, normalized),
    enabled: isAuthenticated(token)
  });
}

export function useCvTailoringsQuery(params: (ListParams & { cvDocumentId?: string }) = {}) {
  const token = useAuthToken();
  const normalized = { limit: 12, offset: 0, ...params };
  return useQuery({
    queryKey: [...queryKeys.cv.tailorings(), normalized],
    queryFn: () => listCvTailorings(token!, normalized),
    enabled: isAuthenticated(token)
  });
}

export function useCvTailoringQuery(tailoringId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.cv.tailoring(tailoringId!),
    queryFn: () => getCvTailoring(token!, tailoringId!),
    enabled: isAuthenticated(token) && Boolean(tailoringId)
  });
}

export function useUploadCvDocumentMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, title }: { file: File; title?: string }) => uploadCvDocument(token!, file, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.documents() });
    }
  });
}

export function useCreateCvTailoringMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTailoringInput) => createCvTailoring(token!, input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.tailorings() });
      void queryClient.setQueryData(queryKeys.cv.tailoring(data.id), data);
    }
  });
}

export function useDeleteCvDocumentMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => deleteCvDocument(token!, documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.all });
    }
  });
}

export function useDeleteCvTailoringMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tailoringId: string) => deleteCvTailoring(token!, tailoringId),
    onSuccess: (_data, tailoringId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.tailorings() });
      queryClient.removeQueries({ queryKey: queryKeys.cv.tailoring(tailoringId) });
    }
  });
}

export function useDownloadTailoredCvMutation() {
  const token = useAuthToken();
  return useMutation({
    mutationFn: (tailoringId: string) => downloadTailoredCv(token!, tailoringId)
  });
}
