"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, FileText, Sparkles } from "lucide-react";

import { ResourceListRow } from "@/components/page-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SearchResult } from "@/lib/search";

type SearchResultCardProps = {
  result: SearchResult;
  rank: number;
};

function scoreTone(score: number) {
  if (score >= 0.75) return "success" as const;
  if (score >= 0.5) return "secondary" as const;
  return "outline" as const;
}

function formatScore(score: number) {
  return `${Math.round(score * 100)}%`;
}

export function SearchResultCard({ result, rank }: SearchResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <ResourceListRow
        icon={
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
        }
        title={result.material_title}
        description={expanded ? undefined : result.excerpt}
        meta={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="tabular-nums">
              #{rank}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <BookOpen className="h-3 w-3" />
              {result.source}
            </Badge>
            <Badge variant={scoreTone(result.score)} className="gap-1 tabular-nums">
              <Sparkles className="h-3 w-3" />
              {formatScore(result.score)}
            </Badge>
          </span>
        }
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Less" : "More"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        }
      />
      {expanded ? (
        <blockquote className="rounded-lg border-l-4 border-primary/30 bg-accent/30 px-4 py-3 text-sm leading-relaxed text-foreground/90">
          {result.excerpt}
        </blockquote>
      ) : null}
    </div>
  );
}
