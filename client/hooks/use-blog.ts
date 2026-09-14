"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveBlogPost,
  createBlogCategory,
  createBlogComment,
  createBlogPost,
  deleteBlogComment,
  deleteBlogPost,
  getBlogPost,
  getRelatedBlogPosts,
  listAdminBlogPosts,
  listBlogCategories,
  listBlogComments,
  listBlogPosts,
  publishBlogPost,
  searchBlogPosts,
  unpublishBlogPost,
  updateBlogPost,
  uploadBlogImage,
  voteBlogComment,
  type BlogPostInput
} from "@/lib/blog";
import { queryKeys } from "@/lib/query-keys";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useBlogPostsQuery() {
  return useQuery({
    queryKey: queryKeys.blog.posts(),
    queryFn: () => listBlogPosts()
  });
}

export function useAdminBlogPostsQuery(status?: string) {
  const token = useAuthToken();
  return useQuery({
    queryKey: [...queryKeys.blog.posts({ admin: true }), status ?? "all"] as const,
    queryFn: () => listAdminBlogPosts(token!, status),
    enabled: isAuthenticated(token)
  });
}

export function useBlogPostQuery(slug: string | null) {
  return useQuery({
    queryKey: queryKeys.blog.post(slug!),
    queryFn: () => getBlogPost(slug!),
    enabled: Boolean(slug)
  });
}

export function useRelatedBlogPostsQuery(slug: string | null) {
  return useQuery({
    queryKey: [...queryKeys.blog.post(slug!), "related"] as const,
    queryFn: () => getRelatedBlogPosts(slug!),
    enabled: Boolean(slug)
  });
}

export function useBlogCategoriesQuery() {
  return useQuery({
    queryKey: [...queryKeys.blog.all, "categories"] as const,
    queryFn: () => listBlogCategories()
  });
}

export function useBlogCommentsQuery(slug: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: [...queryKeys.blog.post(slug!), "comments"] as const,
    queryFn: () => listBlogComments(slug!, token),
    enabled: Boolean(slug)
  });
}

export function useSearchBlogPostsMutation() {
  return useMutation({
    mutationFn: (query: string) => searchBlogPosts(query)
  });
}

export function useCreateBlogPostMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BlogPostInput) => createBlogPost(token!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.blog.all });
    }
  });
}

export function useUpdateBlogPostMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, payload }: { postId: string; payload: Partial<BlogPostInput> }) =>
      updateBlogPost(token!, postId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.blog.all });
    }
  });
}

export function useDeleteBlogPostMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deleteBlogPost(token!, postId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.blog.all });
    }
  });
}

export function usePublishBlogPostMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => publishBlogPost(token!, postId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.blog.all });
    }
  });
}

export function useArchiveBlogPostMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => archiveBlogPost(token!, postId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.blog.all });
    }
  });
}

export function useUnpublishBlogPostMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => unpublishBlogPost(token!, postId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.blog.all });
    }
  });
}

export function useUploadBlogImageMutation() {
  const token = useAuthToken();
  return useMutation({
    mutationFn: (file: File) => uploadBlogImage(token!, file)
  });
}

export function useCreateBlogCategoryMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      createBlogCategory(token!, name, description),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.blog.all, "categories"] });
    }
  });
}

export function useCreateBlogCommentMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      body,
      parentId
    }: {
      slug: string;
      body: string;
      parentId?: string;
    }) => createBlogComment(token!, slug, body, parentId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.blog.post(variables.slug), "comments"]
      });
    }
  });
}

export function useVoteBlogCommentMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      commentId,
      slug,
      vote
    }: {
      commentId: string;
      slug: string;
      vote: 1 | -1 | 0;
    }) => voteBlogComment(token!, commentId, vote),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.blog.post(variables.slug), "comments"]
      });
    }
  });
}

export function useDeleteBlogCommentMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, slug }: { commentId: string; slug: string }) =>
      deleteBlogComment(token!, commentId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.blog.post(variables.slug), "comments"]
      });
    }
  });
}
