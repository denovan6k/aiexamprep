import { asRoute } from "@/lib/utils";

export const ALL_COURSES = "__all__";

export type SearchUrlState = {
  courseId: string | null;
  materialIds: string[];
  q: string;
};

export function buildSearchParams(state: SearchUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.courseId) {
    params.set("course_id", state.courseId);
  }
  if (state.materialIds.length > 0) {
    params.set("material_ids", state.materialIds.join(","));
  }
  const trimmed = state.q.trim();
  if (trimmed) {
    params.set("q", trimmed);
  }
  return params;
}

export function buildSearchHref(state: SearchUrlState): string {
  const params = buildSearchParams(state);
  const query = params.toString();
  return asRoute(query ? `/search?${query}` : "/search");
}

export function parseMaterialIds(value: string | null): string[] {
  if (!value?.trim()) return [];
  return value.split(",").map((id) => id.trim()).filter(Boolean);
}
