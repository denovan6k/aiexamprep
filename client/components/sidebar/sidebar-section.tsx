"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type SidebarSectionProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

export function SidebarSection({
  title,
  description,
  icon,
  badge,
  defaultOpen = true,
  className,
  contentClassName,
  children
}: SidebarSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("group/collapsible", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/50">
          <div className="flex min-w-0 items-center gap-2">
            {icon ? <span className="shrink-0 text-primary">{icon}</span> : null}
            <div className="min-w-0">
              <p className="text-sm font-medium">{title}</p>
              {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {badge}
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className={cn("border-t border-border px-4 py-3", contentClassName)}>{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
