"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { createCourse, listCourses } from "@/lib/study";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useCoursesQuery() {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.courses.list(),
    queryFn: () => listCourses(token!),
    enabled: isAuthenticated(token)
  });
}

export function useCreateCourseMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, description }: { title: string; description?: string }) =>
      createCourse(token!, title, description),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
    }
  });
}
