"use client";

import Link from "next/link";
import { MessageSquare, Pencil } from "lucide-react";

import { AgentAvatar } from "@/components/agents/agent-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { Agent } from "@/lib/study";
import { cn } from "@/lib/utils";

type AgentCardProps = {
  agent: Agent;
  className?: string;
};

export function AgentCard({ agent, className }: AgentCardProps) {
  const tagline = agent.capabilities_summary || agent.subject_area || "Custom examiner profile";

  return (
    <Card className={cn("group transition-shadow hover:shadow-md", className)}>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
        <AgentAvatar name={agent.name} avatarUrl={agent.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <Link href={`/agents/${agent.id}`} className="font-semibold hover:text-primary">
            {agent.name}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tagline}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        <p className="line-clamp-3 text-sm text-muted-foreground">{agent.description ?? "No description yet."}</p>
        <div className="flex flex-wrap gap-2">
          {agent.difficulty ? <Badge variant="secondary">{agent.difficulty}</Badge> : null}
          {agent.feedback_tone ? <Badge variant="outline">{agent.feedback_tone}</Badge> : null}
          {agent.mcp_connection_count > 0 ? (
            <Badge variant="outline">{agent.mcp_connection_count} MCP</Badge>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="gap-2 pt-0">
        <Button asChild size="sm" className="gap-1.5">
          <Link href={`/chat?agent=${agent.id}`}>
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href={`/agents/${agent.id}/edit`}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
