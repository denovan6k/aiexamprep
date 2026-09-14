export const DEFAULT_PAGE_SIZE = 12;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  meta?: Record<string, unknown> | null;
};

export type ListParams = {
  limit?: number;
  offset?: number;
  q?: string;
  status?: string;
  course_id?: string;
  source?: string;
  difficulty?: string;
  subject_area?: string;
};

export function buildListQuery(params?: ListParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  if (typeof params.offset === "number") search.set("offset", String(params.offset));
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.status) search.set("status", params.status);
  if (params.course_id) search.set("course_id", params.course_id);
  if (params.source) search.set("source", params.source);
  if (params.difficulty) search.set("difficulty", params.difficulty);
  if (params.subject_area) search.set("subject_area", params.subject_area);
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function pageCount(total: number, limit: number): number {
  if (limit <= 0) return 1;
  return Math.max(1, Math.ceil(total / limit));
}

export function pageOffset(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export function currentPage(offset: number, limit: number): number {
  return Math.floor(offset / limit) + 1;
}
