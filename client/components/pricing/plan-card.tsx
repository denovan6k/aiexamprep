"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PlanCardProps = {
  name: string;
  price: string;
  period?: string | null;
  detail?: string | null;
  features: string[];
  highlighted?: boolean;
  current?: boolean;
  badgeText?: string;
  footer: ReactNode;
  className?: string;
};

export function PlanCard({
  name,
  price,
  period,
  detail,
  features,
  highlighted,
  current,
  badgeText,
  footer,
  className
}: PlanCardProps) {
  return (
    <Card
      className={cn(
        "relative flex h-full flex-col rounded-2xl",
        highlighted && "border-2 border-primary shadow-elevated",
        current && "border-primary/40",
        className
      )}
    >
      {badgeText ? <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">{badgeText}</Badge> : null}
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{name}</CardTitle>
          {current ? <Badge variant="success">Current</Badge> : null}
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-3xl font-semibold">{price}</span>
          {period ? <span className="text-sm text-muted-foreground">{period}</span> : null}
        </div>
        {detail ? <CardDescription className="pt-1">{detail}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>{footer}</CardFooter>
    </Card>
  );
}
