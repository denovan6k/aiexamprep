"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";

type AgentChatLauncherProps = {
  agentId: string;
  label?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
};

export function AgentChatLauncher({
  agentId,
  label = "Chat",
  variant = "default",
  size = "default"
}: AgentChatLauncherProps) {
  return (
    <Button asChild variant={variant} size={size} className="gap-2">
      <Link href={`/chat?agent=${agentId}`}>
        <MessageSquare className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
