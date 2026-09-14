"use client";

import { Building2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Institution } from "@/lib/institutions";
import { cn } from "@/lib/utils";

export function InstitutionIndicator({
  institution,
  className
}: {
  institution: Institution | null | undefined;
  className?: string;
}) {
  if (!institution) {
    return null;
  }

  return (
    <Badge variant="secondary" className={cn("max-w-full truncate", className)}>
      <Building2 className="mr-1 h-3 w-3" />
      {institution.name} materials included
    </Badge>
  );
}
