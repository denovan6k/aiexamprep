"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createOnboardingCourse,
  createRemediation,
  createStudyPlanItem,
  getCourseWorkspace,
  getOnboarding,
  getRemediationOptions,
  getStudyFeed,
  getTodayStudyPlan,
  refreshTodayStudyPlan,
  updateOnboarding,
  updateStudyPlanItem,
  type OnboardingCourseInput,
  type OnboardingProfilePatch,
  type RemediationAction,
  type StudyPlanAction,
  type StudyPlanItemCreate
} from "@/lib/core-study";
import { queryKeys } from "@/lib/query-keys";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useOnboardingQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.onboarding.state(),
    queryFn: () => getOnboarding(token!),
    enabled: isAuthenticated(token)
  });
}

export function useUpdateOnboardingMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: OnboardingProfilePatch) => updateOnboarding(token!, patch),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.onboarding.state(), data)
  });
}

export function useCreateOnboardingCourseMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OnboardingCourseInput) => createOnboardingCourse(token!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
    }
  });
}

export function useCourseWorkspaceQuery(courseId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.courses.workspace(courseId!),
    queryFn: () => getCourseWorkspace(token!, courseId!),
    enabled: isAuthenticated(token) && Boolean(courseId)
  });
}

export function useTodayStudyPlanQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.study.today(),
    queryFn: () => getTodayStudyPlan(token!),
    enabled: isAuthenticated(token)
  });
}

export function useStudyFeedQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.study.feed(),
    queryFn: () => getStudyFeed(token!),
    enabled: isAuthenticated(token)
  });
}

export function useRefreshTodayStudyPlanMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => refreshTodayStudyPlan(token!),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.study.today(), data)
  });
}

export function useStudyPlanItemMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, action }: { itemId: string; action: StudyPlanAction }) =>
      updateStudyPlanItem(token!, itemId, action),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.study.today() })
  });
}

export function useCreateStudyPlanItemMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StudyPlanItemCreate) => createStudyPlanItem(token!, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.study.today() })
  });
}

export function useRemediationOptionsQuery(attemptId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.quizzes.remediation(attemptId!),
    queryFn: () => getRemediationOptions(token!, attemptId!),
    enabled: isAuthenticated(token) && Boolean(attemptId)
  });
}

export function useCreateRemediationMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attemptId,
      action,
      topics
    }: {
      attemptId: string;
      action: RemediationAction;
      topics?: string[];
    }) => createRemediation(token!, attemptId, action, topics),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.quizzes.remediation(variables.attemptId)
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.study.today() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.all });
    }
  });
}
