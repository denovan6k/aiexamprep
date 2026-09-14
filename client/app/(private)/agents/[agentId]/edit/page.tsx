"use client";

import { useParams, useRouter } from "next/navigation";

import { AgentEditForm } from "@/components/agents/agent-edit-form";
import { AgentMcpPanel } from "@/components/agents/agent-mcp-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-kit";
import { useAgentQuery } from "@/hooks/use-agents";

export default function AgentEditPage() {
  const router = useRouter();
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const { data: agent, isLoading, error } = useAgentQuery(agentId);

  if (isLoading) {
    return <Skeleton className="mx-auto h-96 max-w-3xl rounded-xl" />;
  }

  if (error || !agent) {
    return <p className="text-sm text-danger">{error?.message ?? "Agent not found."}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Edit agent" title={agent.name} description="Update persona, avatar, and group intro copy." />
      <div className="rounded-xl border border-border p-6">
        <AgentEditForm agent={agent} onSaved={() => router.push(`/agents/${agent.id}`)} />
      </div>
      <div className="rounded-xl border border-border p-6">
        <AgentMcpPanel agentId={agent.id} />
      </div>
    </div>
  );
}
