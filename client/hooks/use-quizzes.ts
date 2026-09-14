"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import type { ListParams } from "@/lib/pagination";
import {
  flagQuizAnswer,
  generateQuiz,
  getQuiz,
  getQuizAttempt,
  getQuizReview,
  getQuizSessionContext,
  createManualQuiz,
  getQuizEditor,
  listQuizzes,
  rateQuestion,
  regenerateQuiz,
  saveQuizAnswer,
  populateQuiz,
  startQuizAttempt,
  submitQuizAttempt,
  updateQuizContent,
  updateQuiz,
  type QuizGenerationInput,
  type QuizManualContentUpdateInput,
  type QuizManualCreateInput,
  type QuizPopulateInput,
  type QuizRegenerateSettings,
  type QuizUpdateSettings
} from "@/lib/study";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useQuizzesQuery(params: ListParams = {}) {
  const token = useAuthToken();
  const normalized = { limit: 12, offset: 0, ...params };
  return useQuery({
    queryKey: [...queryKeys.quizzes.list(), normalized],
    queryFn: () => listQuizzes(token!, normalized),
    enabled: isAuthenticated(token)
  });
}

export function useQuizQuery(quizId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.quizzes.quiz(quizId!),
    queryFn: () => getQuiz(token!, quizId!),
    enabled: isAuthenticated(token) && Boolean(quizId)
  });
}

export function useQuizEditorQuery(quizId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.quizzes.editor(quizId!),
    queryFn: () => getQuizEditor(token!, quizId!),
    enabled: isAuthenticated(token) && Boolean(quizId)
  });
}

export function useQuizAttemptQuery(attemptId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.quizzes.attempt(attemptId!),
    queryFn: () => getQuizAttempt(token!, attemptId!),
    enabled: isAuthenticated(token) && Boolean(attemptId)
  });
}

export function useQuizReviewQuery(attemptId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: [...queryKeys.quizzes.attempt(attemptId!), "review"] as const,
    queryFn: () => getQuizReview(token!, attemptId!),
    enabled: isAuthenticated(token) && Boolean(attemptId)
  });
}

export function useQuizSessionContextQuery(
  attemptId: string | null,
  options?: {
    refetchInterval?: number | false;
    refetchOnMount?: boolean | "always";
  }
) {
  const token = useAuthToken();
  return useQuery({
    queryKey: [...queryKeys.quizzes.attempt(attemptId!), "context"] as const,
    queryFn: () => getQuizSessionContext(token!, attemptId!),
    enabled: isAuthenticated(token) && Boolean(attemptId),
    refetchInterval: options?.refetchInterval,
    refetchOnMount: options?.refetchOnMount
  });
}

export function useUpdateQuizMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, settings }: { quizId: string; settings: QuizUpdateSettings }) =>
      updateQuiz(token!, quizId, settings),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.quizzes.quiz(data.id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.list() });
    }
  });
}

export function useCreateManualQuizMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: QuizManualCreateInput) => createManualQuiz(token!, input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.quizzes.quiz(data.id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.editor(data.id) });
    }
  });
}

export function useUpdateQuizContentMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, input }: { quizId: string; input: QuizManualContentUpdateInput }) =>
      updateQuizContent(token!, quizId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.quizzes.quiz(data.id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.editor(data.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.list() });
    }
  });
}

export function usePopulateQuizMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, input }: { quizId: string; input: QuizPopulateInput }) =>
      populateQuiz(token!, quizId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.quizzes.quiz(data.id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.editor(data.id) });
    }
  });
}

export function useGenerateQuizMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: QuizGenerationInput) => generateQuiz(token!, input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.quizzes.quiz(data.id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
    }
  });
}

export function useRegenerateQuizMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      quizId,
      settings
    }: {
      quizId: string;
      settings?: QuizRegenerateSettings;
    }) => regenerateQuiz(token!, quizId, settings),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.quizzes.quiz(data.id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.list() });
    }
  });
}

export function useStartQuizAttemptMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quizId: string) => startQuizAttempt(token!, quizId),
    onSuccess: (_data, quizId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.attempts(quizId) });
    }
  });
}

export function useSaveQuizAnswerMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attemptId,
      questionId,
      answer
    }: {
      attemptId: string;
      questionId: string;
      answer: unknown;
    }) => saveQuizAnswer(token!, attemptId, questionId, answer),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.attempt(variables.attemptId) });
    }
  });
}

export function useFlagQuizAnswerMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attemptId,
      questionId,
      flagged
    }: {
      attemptId: string;
      questionId: string;
      flagged: boolean;
    }) => flagQuizAnswer(token!, attemptId, questionId, flagged),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.attempt(variables.attemptId) });
    }
  });
}

export function useSubmitQuizAttemptMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attemptId: string) => submitQuizAttempt(token!, attemptId),
    onSuccess: (_data, attemptId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.attempt(attemptId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.all });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.quizzes.all, "progress"] });
    }
  });
}

export function useRateQuestionMutation() {
  const token = useAuthToken();
  return useMutation({
    mutationFn: ({ questionId, rating }: { questionId: string; rating: "up" | "down" }) =>
      rateQuestion(token!, questionId, rating)
  });
}
