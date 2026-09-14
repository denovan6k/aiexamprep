"use client";

import { Download, FileText, Maximize2, Sparkles } from "lucide-react";
import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { MediaAttachment } from "@/lib/chat";
import { cn } from "@/lib/utils";

export type MediaAttachmentCardProps = {
  attachment: MediaAttachment;
  className?: string;
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function MediaAttachmentCard({ attachment, className }: MediaAttachmentCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const filename = attachment.filename || attachment.file_name || "Attachment";
  const url = attachment.url || attachment.download_url;
  const isImage =
    attachment.attachment_type === "image" ||
    (attachment.content_type && attachment.content_type.startsWith("image/")) ||
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(filename);

  if (isImage) {
    return (
      <>
        <div className={cn("group relative inline-block overflow-hidden rounded-xl border border-border/60 bg-muted/40 shadow-sm", className)}>
          {url ? (
            <div
              className="relative cursor-pointer overflow-hidden"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={url}
                alt={filename}
                className="max-h-60 w-full max-w-full rounded-xl object-cover transition-transform duration-200 group-hover:scale-105 sm:max-w-sm"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                <span className="flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow">
                  <Maximize2 className="h-3.5 w-3.5" /> View
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-32 w-full max-w-full items-center justify-center bg-muted px-3 text-xs text-muted-foreground sm:w-48">
              {filename}
            </div>
          )}
        </div>

        {/* Lightbox Dialog */}
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="w-[calc(100%-1.5rem)] max-w-4xl border-none bg-black/90 p-0 text-white shadow-2xl backdrop-blur-md">
            <div className="relative flex max-h-[85dvh] items-center justify-center p-4">
              {url && (
                <img
                  src={url}
                  alt={filename}
                  className="max-h-[80vh] max-w-full rounded-lg object-contain"
                />
              )}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white/80">
                <span className="truncate">{filename}</span>
                {url && (
                  <a
                    href={url}
                    download={filename}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs hover:bg-white/30"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Document Card
  return (
    <div
      className={cn(
        "flex w-full max-w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-colors hover:border-border sm:max-w-sm",
        className
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileText className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-xs font-medium text-foreground">{filename}</p>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{formatBytes(attachment.file_size)}</span>
          {attachment.parsed_with && (
            <Badge variant="outline" className="h-4 gap-1 border-primary/30 px-1.5 text-[10px] font-normal text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              Parsed with {attachment.parsed_with}
            </Badge>
          )}
        </div>
      </div>

      {url && (
        <a
          href={url}
          download={filename}
          target="_blank"
          rel="noreferrer"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={`Download ${filename}`}
        >
          <Download className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
