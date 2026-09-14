"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { MindMapCanvas } from "@/components/mind-map/mind-map-canvas";
import { Button } from "@/components/ui/button";
import { documentFromPreview } from "@/lib/mind-map";
import { asRoute } from "@/lib/utils";

type MindMapPreviewProps = {
  preview: Record<string, unknown>;
  artifactId?: string;
};

export function MindMapPreview({ preview, artifactId }: MindMapPreviewProps) {
  const document = documentFromPreview(preview);

  return (
    <div className="space-y-3">
      <div className="h-56 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
        <MindMapCanvas root={document.root} settings={document.settings} interactive={false} />
      </div>
      {artifactId ? (
        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link href={asRoute(`/mind-maps/${artifactId}`)}>
            Open mind map
            <ExternalLink className="ml-2 size-3.5" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
