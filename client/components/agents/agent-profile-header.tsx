"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";

import { AgentAvatar } from "@/components/agents/agent-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeleteAgentMutation } from "@/hooks/use-agents";
import type { Agent } from "@/lib/study";
import { showError, showSuccess } from "@/lib/toast";

type AgentProfileHeaderProps = {
  agent: Agent;
};

export function AgentProfileHeader({ agent }: AgentProfileHeaderProps) {
  const router = useRouter();
  const deleteMutation = useDeleteAgentMutation();

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <AgentAvatar name={agent.name} avatarUrl={agent.avatar_url} size="lg" className="h-20 w-20 text-xl" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
            <p className="mt-1 text-muted-foreground">
              {agent.capabilities_summary || agent.subject_area || "Professor-style study agent"}
            </p>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {agent.description ?? "No description provided."}
          </p>
          <div className="flex flex-wrap gap-2">
            {agent.difficulty ? <Badge variant="secondary">{agent.difficulty}</Badge> : null}
            {agent.marking_strictness ? <Badge variant="outline">{agent.marking_strictness} marking</Badge> : null}
            {agent.feedback_tone ? <Badge variant="outline">{agent.feedback_tone} tone</Badge> : null}
            {agent.mcp_connection_count > 0 ? (
              <Badge variant="outline">{agent.mcp_connection_count} MCP connections</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild className="gap-2">
            <Link href={`/chat?agent=${agent.id}`}>
              <MessageSquare className="h-4 w-4" />
              Chat
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/agents/${agent.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="icon"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (confirm(`Delete ${agent.name}?`)) {
                deleteMutation.mutate(agent.id, {
                  onSuccess: () => {
                    showSuccess("Agent deleted.");
                    router.push("/agents");
                  },
                  onError: (err) => showError(err, "Failed to delete agent.")
                });
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
