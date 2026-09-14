"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createMaterialChatSession,
  deleteChatMedia,
  deleteMaterial,
  getMaterialStatus,
  listMaterials,
  reprocessMaterial,
  sendMaterialChatMessage,
  updateMaterialTitle,
  uploadMaterial
} from "@/lib/materials";
import type { ListParams } from "@/lib/pagination";
import { queryKeys } from "@/lib/query-keys";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

function invalidateMaterialLists(
  queryClient: ReturnType<typeof useQueryClient>,
  courseId?: string | null
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.materials.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all });
  if (courseId) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.courses.workspace(courseId)
    });
  }
}

export function useMaterialsQuery(params: ListParams & { courseId?: string } = {}) {
  const token = useAuthToken();
  const normalized = { limit: 12, offset: 0, ...params };
  return useQuery({
    queryKey: [...queryKeys.materials.list(), normalized],
    queryFn: () => listMaterials(token!, normalized),
    enabled: isAuthenticated(token)
  });
}

export function useMaterialStatusQuery(materialId: string | null, options?: { refetchInterval?: number | false }) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.materials.status(materialId!),
    queryFn: () => getMaterialStatus(token!, materialId!),
    enabled: isAuthenticated(token) && Boolean(materialId),
    refetchInterval: options?.refetchInterval
  });
}

export function useUploadMaterialMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      courseId,
      title
    }: {
      file: File;
      courseId?: string;
      title?: string;
    }) => uploadMaterial(token!, file, { courseId, title }),
    onSuccess: (_data, variables) => {
      invalidateMaterialLists(queryClient, variables.courseId);
    }
  });
}

export function useDeleteMaterialMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      materialId,
      source
    }: {
      materialId: string;
      courseId?: string | null;
      source?: "material" | "chat";
    }) =>
      source === "chat"
        ? deleteChatMedia(token!, materialId)
        : deleteMaterial(token!, materialId),
    onSuccess: (_data, variables) => {
      invalidateMaterialLists(queryClient, variables.courseId);
    }
  });
}

export function useReprocessMaterialMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ materialId }: { materialId: string; courseId?: string | null }) =>
      reprocessMaterial(token!, materialId),
    onSuccess: (_data, variables) => {
      invalidateMaterialLists(queryClient, variables.courseId);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.materials.status(variables.materialId)
      });
    }
  });
}

export function useUpdateMaterialMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      materialId,
      title
    }: {
      materialId: string;
      title: string;
      courseId?: string | null;
    }) => updateMaterialTitle(token!, materialId, title),
    onSuccess: (_data, variables) => {
      invalidateMaterialLists(queryClient, variables.courseId);
    }
  });
}

export function useCreateMaterialChatSessionMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ materialId, title }: { materialId: string; title?: string }) =>
      createMaterialChatSession(token!, materialId, title),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.materials.chat.sessions(variables.materialId)
      });
    }
  });
}

export function useSendMaterialChatMessageMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      materialId,
      sessionId,
      content,
      model
    }: {
      materialId: string;
      sessionId: string;
      content: string;
      model?: string | null;
    }) => sendMaterialChatMessage(token!, materialId, sessionId, content, model),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.materials.chat.messages(variables.materialId, variables.sessionId)
      });
    }
  });
}
