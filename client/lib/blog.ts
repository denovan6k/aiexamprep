import { API_BASE_URL, apiRequest } from "@/lib/api";

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content?: string | null;
  category: string | null;
  category_id?: string | null;
  author: string | null;
  author_id?: string | null;
  tags: string[];
  status?: string | null;
  cover_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  reading_time_minutes?: number | null;
  comment_count?: number;
  published_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type BlogComment = {
  id: string;
  post_id: string;
  parent_id?: string | null;
  body: string;
  author_name: string;
  author_id: string;
  author_avatar_url?: string | null;
  score?: number;
  user_vote?: number | null;
  created_at: string;
  updated_at: string;
};

export type BlogPostInput = {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  category_id?: string;
  tags?: string[];
  cover_image_url?: string;
  seo_title?: string;
  seo_description?: string;
};

export type BlogImageUpload = {
  url: string;
  filename: string;
};

export async function listBlogPosts() {
  return apiRequest<BlogPost[]>("/blog/posts", { cache: "no-store" });
}

export async function listAdminBlogPosts(token: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<BlogPost[]>(`/blog/admin/posts${query}`, { token });
}

export async function searchBlogPosts(query: string) {
  return apiRequest<BlogPost[]>(`/blog/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
}

export async function getBlogPost(slug: string) {
  return apiRequest<BlogPost>(`/blog/posts/${slug}`, { cache: "no-store" });
}

export async function getRelatedBlogPosts(slug: string) {
  return apiRequest<BlogPost[]>(`/blog/posts/${slug}/related`, { cache: "no-store" });
}

export async function listBlogCategories() {
  return apiRequest<BlogCategory[]>("/blog/categories");
}

export async function createBlogPost(token: string, payload: BlogPostInput) {
  return apiRequest<BlogPost>("/blog/posts", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function uploadBlogImage(token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const upload = await apiRequest<BlogImageUpload>("/blog/uploads/images", {
    method: "POST",
    token,
    body: formData
  });
  return {
    ...upload,
    url: upload.url.startsWith("/") ? `${API_BASE_URL}${upload.url}` : upload.url
  };
}

export async function updateBlogPost(token: string, postId: string, payload: Partial<BlogPostInput>) {
  return apiRequest<BlogPost>(`/blog/posts/${postId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload)
  });
}

export async function deleteBlogPost(token: string, postId: string) {
  return apiRequest<void>(`/blog/posts/${postId}`, { method: "DELETE", token });
}

export async function publishBlogPost(token: string, postId: string) {
  return apiRequest<BlogPost>(`/blog/posts/${postId}/publish`, { method: "POST", token });
}

export async function archiveBlogPost(token: string, postId: string) {
  return apiRequest<BlogPost>(`/blog/posts/${postId}/archive`, { method: "POST", token });
}

export async function unpublishBlogPost(token: string, postId: string) {
  return apiRequest<BlogPost>(`/blog/posts/${postId}/unpublish`, { method: "POST", token });
}

export async function createBlogCategory(token: string, name: string, description?: string) {
  return apiRequest<BlogCategory>("/blog/categories", {
    method: "POST",
    token,
    body: JSON.stringify({ name, description })
  });
}

export async function listBlogComments(slug: string, token?: string | null) {
  return apiRequest<BlogComment[]>(`/blog/posts/${slug}/comments`, { token: token ?? undefined });
}

export async function createBlogComment(
  token: string,
  slug: string,
  body: string,
  parentId?: string | null
) {
  return apiRequest<BlogComment>(`/blog/posts/${slug}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ body, parent_id: parentId ?? null })
  });
}

export async function voteBlogComment(token: string, commentId: string, vote: 1 | -1 | 0) {
  return apiRequest<BlogComment>(`/blog/comments/${commentId}/vote`, {
    method: "POST",
    token,
    body: JSON.stringify({ vote })
  });
}

export async function deleteBlogComment(token: string, commentId: string) {
  return apiRequest<void>(`/blog/comments/${commentId}`, { method: "DELETE", token });
}
