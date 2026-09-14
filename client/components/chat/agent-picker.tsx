"use client";

import { Bot, Check, ChevronDown, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { CreateAgentDialog } from "@/components/agents/create-agent-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type AgentOption = {
  id: string;
  name: string;
  subject_area?: string | null;
  avatar_url?: string | null;
};

type AgentPickerProps = {
  agents: AgentOption[];
  selectedAgentId?: string | null;
  onAgentChange?: (agentId: string | null) => void;
  onAgentCreated?: (agent: AgentOption) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  hideIcon?: boolean;
  fullWidth?: boolean;
};

function AgentMenuItem({
  label,
  selected,
  onClick
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      className="relative cursor-default select-none rounded-sm py-1.5 pl-2 pr-8 text-xs focus:bg-accent focus:text-accent-foreground"
    >
      <span className="truncate">{label}</span>
      {selected ? (
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </DropdownMenuItem>
  );
}

export function AgentPicker({
  agents,
  selectedAgentId,
  onAgentChange,
  onAgentCreated,
  disabled,
  className,
  compact = false,
  hideIcon = false,
  fullWidth = false
}: AgentPickerProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const isMobile = useIsMobile();

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );

  const triggerLabel = selectedAgent
    ? `${selectedAgent.name}${selectedAgent.subject_area ? ` - ${selectedAgent.subject_area}` : ""}`
    : "No agent";

  const handleAgentSelect = useCallback(
    (agentId: string | null) => {
      if (agentId === (selectedAgentId ?? null)) return;
      onAgentChange?.(agentId);
    },
    [onAgentChange, selectedAgentId]
  );

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", fullWidth && "w-full", className)}>
      {!compact && !hideIcon ? (
        <Label htmlFor="context-agent" className="sr-only">
          Professor agent
        </Label>
      ) : null}
      {!hideIcon ? <Bot className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
      <div className={cn("flex min-w-0 items-center gap-0.5", fullWidth && "flex-1")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              id="context-agent"
              type="button"
              disabled={disabled}
              className={cn(
                "flex h-9 min-h-9 cursor-pointer items-center justify-between gap-1.5 px-2.5 text-xs font-medium text-foreground shadow-none outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3",
                fullWidth
                  ? "w-full rounded-md border border-input bg-background hover:bg-accent/40"
                  : "min-w-0 rounded-full border-0 bg-muted hover:bg-muted/80",
                !fullWidth &&
                  (compact
                    ? "w-full max-w-full sm:max-w-[11rem]"
                    : "w-full sm:w-[min(220px,52vw)]")
              )}
            >
              <span className="truncate">{triggerLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={isMobile || fullWidth ? "start" : "end"}
            side="top"
            sideOffset={6}
            collisionPadding={16}
            className={cn(
              "max-h-[min(70dvh,16rem)] overflow-y-auto",
              fullWidth
                ? "min-w-[min(14rem,calc(100vw-2rem))] max-w-[min(16rem,calc(100vw-2rem))]"
                : "w-[var(--radix-dropdown-menu-trigger-width)] max-w-[min(14rem,calc(100vw-2rem))]"
            )}
          >
            <AgentMenuItem
              label="No agent"
              selected={!selectedAgentId}
              onClick={() => handleAgentSelect(null)}
            />
            {agents.map((agent) => {
              const label = `${agent.name}${agent.subject_area ? ` - ${agent.subject_area}` : ""}`;
              return (
                <AgentMenuItem
                  key={agent.id}
                  label={label}
                  selected={agent.id === selectedAgentId}
                  onClick={() => handleAgentSelect(agent.id)}
                />
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Create agent"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <CreateAgentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(agent) => {
          const option = {
            id: agent.id,
            name: agent.name,
            subject_area: agent.subject_area
          };
          onAgentCreated?.(option);
          onAgentChange?.(option.id);
        }}
      />
      {selectedAgent && !compact && !fullWidth ? (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Quizzes use {selectedAgent.name}&apos;s profile
        </span>
      ) : null}
    </div>
  );
}
