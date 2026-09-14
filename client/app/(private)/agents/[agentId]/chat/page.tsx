import { notFound, redirect } from "next/navigation";

import { createThreadServer, sanitizeUuid } from "@/lib/chat-server";

export default async function AgentChatPage({
  params
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const normalizedAgentId = sanitizeUuid(agentId);
  if (!normalizedAgentId) {
    notFound();
  }

  const thread = await createThreadServer({ professor_agent_id: normalizedAgentId });
  redirect(`/chat/${thread.id}`);
}
