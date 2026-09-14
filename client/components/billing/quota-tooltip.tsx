"use client";

import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type QuotaTooltipProps = {
  reason: string | null | undefined;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
};

export function QuotaTooltip({ reason, children, side = "top" }: QuotaTooltipProps) {
  if (!reason) return <>{children}</>;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-[11px] leading-relaxed">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}
