"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const DASHBOARD_PANEL_HEIGHT = "min-h-[22rem] max-h-[22rem]";
export const DASHBOARD_PLAN_HEIGHT = "max-h-[26rem]";

type DashboardScrollCardProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  heightClassName?: string;
};

export function DashboardScrollCard({
  title,
  description,
  icon,
  children,
  footer,
  className,
  bodyClassName,
  heightClassName = DASHBOARD_PANEL_HEIGHT
}: DashboardScrollCardProps) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", heightClassName, className)}>
      <CardHeader className="shrink-0 space-y-1 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0">
        <div
          className={cn(
            "scrollbar-hover min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain",
            bodyClassName
          )}
        >
          {children}
        </div>
        {footer ? (
          <div className="mt-3 shrink-0 border-t border-border/60 pt-3">{footer}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type DashboardScrollSectionProps = {
  children: ReactNode;
  className?: string;
  maxHeightClassName?: string;
};

export function DashboardScrollSection({
  children,
  className,
  maxHeightClassName = DASHBOARD_PLAN_HEIGHT
}: DashboardScrollSectionProps) {
  return (
    <div
      className={cn(
        "scrollbar-hover min-h-0 overflow-y-auto overscroll-contain",
        maxHeightClassName,
        className
      )}
    >
      {children}
    </div>
  );
}
