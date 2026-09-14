import { redirect } from "next/navigation";

import { DashboardChat } from "@/components/chat/dashboard-chat";

import {
  createThreadServer,
  findCourseThreadServer,
  listThreadsServer,
  sanitizeUuid
} from "@/lib/chat-server";

export default async function ChatPage({
  searchParams
}: {
  searchParams: Promise<{ course_id?: string; agent?: string }>;
}) {
  const params = await searchParams;
  const requestedCourseId = sanitizeUuid(params.course_id);
  const requestedAgentId = sanitizeUuid(params.agent);

  // Deep links that carry explicit context keep eager thread creation.
  if (requestedCourseId) {
    const threads = await listThreadsServer(true);
    const existing = findCourseThreadServer(threads, requestedCourseId);
    const thread = existing ?? (await createThreadServer({ course_id: requestedCourseId }));
    redirect(`/chat/${thread.id}`);
  }

  if (requestedAgentId) {
    const thread = await createThreadServer({ professor_agent_id: requestedAgentId });
    redirect(`/chat/${thread.id}`);
  }

  // Bare `/chat` is an ephemeral "new chat": no thread exists until the first
  // message is sent, mirroring ChatGPT's behavior.
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <DashboardChat />
    </div>
  );
}
