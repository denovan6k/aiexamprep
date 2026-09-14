import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_CHAT_THREAD_TITLE = "New chat";

export type ServerChatThread = {
  id: string;
  title: string;
  course_id: string | null;
  professor_agent_id: string | null;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

type CreateThreadInput = {
  title?: string;
  course_id?: string | null;
  professor_agent_id?: string | null;
};

function apiBaseUrl() {
  return (
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

async function requireSessionToken() {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

async function authFetch(path: string, init: RequestInit = {}) {
  const token = await requireSessionToken();
  if (!token) {
    throw new Error("Missing session token.");
  }
  return fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });
}

export async function listThreadsServer(includeArchived = true): Promise<ServerChatThread[]> {
  const query = includeArchived ? "?include_archived=true" : "";
  const response = await authFetch(`/chat/threads${query}`);
  if (!response.ok) throw new Error("Failed to list chat threads.");
  return (await response.json()) as ServerChatThread[];
}

export async function createThreadServer(input?: CreateThreadInput): Promise<ServerChatThread> {
  const payload: CreateThreadInput = {};
  if (input?.title) payload.title = input.title;
  if (input?.course_id) payload.course_id = input.course_id;
  if (input?.professor_agent_id && isUuid(input.professor_agent_id)) {
    payload.professor_agent_id = input.professor_agent_id;
  }
  const response = await authFetch("/chat/threads", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create chat thread.");
  return (await response.json()) as ServerChatThread;
}

export function findReusableEmptyThreadServer(
  threads: ServerChatThread[],
  courseId?: string | null
): ServerChatThread | null {
  return (
    threads.find(
      (thread) =>
        thread.title === DEFAULT_CHAT_THREAD_TITLE &&
        (courseId ? thread.course_id === courseId : thread.course_id == null)
    ) ?? null
  );
}

export function findCourseThreadServer(
  threads: ServerChatThread[],
  courseId: string
): ServerChatThread | null {
  const courseThreads = threads.filter((thread) => thread.course_id === courseId);
  return findReusableEmptyThreadServer(courseThreads, courseId) ?? courseThreads[0] ?? null;
}

export function sanitizeUuid(input: string | string[] | undefined): string | null {
  const value = typeof input === "string" ? input : null;
  return isUuid(value) ? value : null;
}
