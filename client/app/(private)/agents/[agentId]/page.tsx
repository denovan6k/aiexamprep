"use client";

import { useParams } from "next/navigation";

import { AgentChatLauncher } from "@/components/agents/agent-chat-launcher";
import { AgentMcpPanel } from "@/components/agents/agent-mcp-panel";
import { AgentProfileHeader } from "@/components/agents/agent-profile-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-kit";
import { useAgentQuery } from "@/hooks/use-agents";

export default function AgentProfilePage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const { data: agent, isLoading, error } = useAgentQuery(agentId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !agent) {
    return <p className="text-sm text-danger">{error?.message ?? "Agent not found."}</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader eyebrow="Agent profile" title={agent.name} description="Persona, tools, and chat shortcuts." />
      <AgentProfileHeader agent={agent} />

      <section className="rounded-xl border border-border p-6">
        <h2 className="mb-3 text-lg font-semibold">Persona details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Favorite topics</p>
            <p className="mt-1 text-sm">{(agent.favorite_topics ?? []).join(", ") || "None yet"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Common traps</p>
            <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
              {(agent.common_traps ?? []).length
                ? agent.common_traps!.map((trap) => <li key={trap}>· {trap}</li>)
                : "None yet"}
            </ul>
          </div>
        </div>
        {agent.intro_message ? (
          <div className="mt-4 rounded-lg bg-muted/40 p-4 text-sm">{agent.intro_message}</div>
        ) : null}
        <div className="mt-4">
          <AgentChatLauncher agentId={agent.id} />
        </div>
      </section>

      <section className="rounded-xl border border-border p-6">
        <AgentMcpPanel agentId={agent.id} />
      </section>
    </div>
  );
}
