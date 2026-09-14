"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type AgentAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg"
};

export function AgentAvatar({ name, avatarUrl, className, size = "md" }: AgentAvatarProps) {
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
      <AvatarFallback className="bg-primary/10 font-medium text-primary">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
