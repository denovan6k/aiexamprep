"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { reputationTierLabel } from "@/lib/community";
import { asRoute, cn } from "@/lib/utils";

export function ReputationBadge({
  score,
  tier,
  className
}: {
  score: number;
  tier?: string;
  className?: string;
}) {
  const label = tier ? reputationTierLabel(tier) : String(score);
  const variant = tier === "trusted" ? "default" : tier === "contributor" ? "secondary" : "outline";

  return (
    <Badge variant={variant} className={cn("tabular-nums", className)}>
      {label} · {score} rep
    </Badge>
  );
}

export function AuthorLink({
  authorId,
  authorName,
  className
}: {
  authorId?: string | null;
  authorName?: string | null;
  className?: string;
}) {
  const label = authorName ?? "Member";
  if (!authorId) {
    return <span className={className}>{label}</span>;
  }
  return (
    <Link
      href={asRoute(`/community/members/${authorId}`)}
      className={cn("font-medium text-foreground hover:text-primary hover:underline", className)}
    >
      {label}
    </Link>
  );
}
