"use client";

import { ExternalLink, FileText } from "lucide-react";

import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import type { MaterialSummary } from "@/lib/materials";
import {
  isChatLibraryItem,
  isMaterialPreviewable,
  materialFileTypeLabel,
  materialOpenUrl
} from "@/lib/materials";

type MaterialPreviewDialogProps = {
  material: MaterialSummary;
  trigger: React.ReactNode;
};

export function MaterialPreviewDialog({ material, trigger }: MaterialPreviewDialogProps) {
  const label = material.title || material.file_name;
  const previewText = material.extracted_text_preview?.trim();
  const isPdf =
    material.file_name.toLowerCase().endsWith(".pdf") ||
    material.file_type?.toLowerCase().includes("pdf");
  const canPreviewFile = isMaterialPreviewable(material);
  const openUrl = materialOpenUrl(material);
  const isImage =
    isChatLibraryItem(material) &&
    Boolean(
      material.file_type?.match(/^(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i) ||
        material.file_name.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i)
    );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{materialFileTypeLabel(material)}</Badge>
            {isChatLibraryItem(material) ? <Badge variant="outline">Chat</Badge> : null}
            <span>{material.file_name}</span>
            <span>·</span>
            <span>{new Date(material.created_at).toLocaleDateString()}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-muted/20">
          {isImage && material.media_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={material.media_url}
              alt={label}
              className="mx-auto max-h-[min(60vh,520px)] w-auto object-contain p-4"
            />
          ) : isPdf && canPreviewFile ? (
            <iframe
              src={openUrl}
              title={`Preview of ${label}`}
              className="h-[min(60vh,520px)] w-full bg-background"
            />
          ) : previewText ? (
            <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none p-4">
              <Markdown>{previewText}</Markdown>
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8 opacity-40" />
              <p>No preview available yet.</p>
              {material.status === "processing" ? (
                <p className="text-xs">Processing is still in progress.</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={openUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open file
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
