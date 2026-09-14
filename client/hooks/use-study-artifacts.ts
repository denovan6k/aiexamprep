"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  getStudyArtifact,
  updateStudyArtifact,
  type StudyArtifactUpdateInput
} from "@/lib/study-artifacts";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useStudyArtifactQuery(artifactId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.studyArtifacts.artifact(artifactId!),
    queryFn: () => getStudyArtifact(token!, artifactId!),
    enabled: isAuthenticated(token) && Boolean(artifactId)
  });
}

export function useUpdateStudyArtifactMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      artifactId,
      input
    }: {
      artifactId: string;
      input: StudyArtifactUpdateInput;
    }) => updateStudyArtifact(token!, artifactId, input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.studyArtifacts.artifact(data.id)
      });
    }
  });
}
