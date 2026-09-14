"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useDeleteAgentMutation } from "@/hooks/use-agents";
import type { Agent } from "@/lib/study";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

type AgentDetailDialogProps = {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (agentId: string) => void;
};

/** @deprecated Use /agents/[id] profile page instead. Kept for backward-compatible deep links. */
export function AgentDetailDialog({ agent, open, onOpenChange, onDeleted }: AgentDetailDialogProps) {
  const deleteMutation = useDeleteAgentMutation();

  if (!agent) return null;

  function handleDelete() {
    deleteMutation.mutate(agent!.id, {
      onSuccess: () => {
        showSuccess("Agent deleted.");
        onDeleted?.(agent!.id);
        onOpenChange(false);
      },
      onError: (err) => showError(err, "Failed to delete agent.")
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{agent.name}</DialogTitle>
          <DialogDescription>{agent.description ?? "No description provided."}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {agent.difficulty ? <Badge variant="secondary">{agent.difficulty}</Badge> : null}
          {agent.marking_strictness ? <Badge variant="outline">{agent.marking_strictness} marking</Badge> : null}
          {agent.feedback_tone ? <Badge variant="outline">{agent.feedback_tone} tone</Badge> : null}
          {agent.subject_area ? <Badge variant="outline">{agent.subject_area}</Badge> : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
            <Trash2 className="h-4 w-4" />
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={asRoute(`/agents/${agent.id}`)}>View profile</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={asRoute(`/chat?agent=${agent.id}`)}>Use in chat</Link>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
