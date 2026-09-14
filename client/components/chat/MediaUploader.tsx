"use client";

import { AlertCircle, CheckCircle2, FileText, Loader2, X } from "lucide-react";
import React, { forwardRef, useImperativeHandle, useState, useCallback, useEffect, useRef } from "react";
import { uploadChatMedia, validateMediaUpload, type MediaAttachment, type MediaUploadResponse } from "@/lib/chat";
import { showError, showWarning } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type UploadingFile = {
  id: string;
  file: File;
  previewUrl?: string;
  progress: number;
  status: "idle" | "uploading" | "success" | "error";
  error?: string;
  mediaId?: string;
  attachment?: MediaAttachment;
};

export type MediaUploaderRef = {
  addFiles: (files: File[]) => void;
  clearQueue: () => void;
  getAttachmentIds: () => string[];
};

export type MediaUploaderProps = {
  token?: string | null;
  onAttachmentsChange?: (attachmentIds: string[], attachments: MediaAttachment[]) => void;
  onImagePresenceChange?: (hasImages: boolean) => void;
  onUploadingStateChange?: (isUploading: boolean) => void;
  disabled?: boolean;
  className?: string;
};

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const MediaUploader = forwardRef<MediaUploaderRef, MediaUploaderProps>(
  ({ token, onAttachmentsChange, onImagePresenceChange, onUploadingStateChange, disabled, className }, ref) => {
    const [queue, setQueue] = useState<UploadingFile[]>([]);
    const queueRef = useRef<UploadingFile[]>([]);
    queueRef.current = queue;

    // State updater functions can run while React is rendering. Notify the parent
    // after the queue has committed instead of from inside those updaters.
    useEffect(() => {
      const successful = queue
        .filter((item) => item.status === "success" && item.mediaId)
        .map((item) => item.attachment || {
          id: item.mediaId!,
          filename: item.file.name,
          file_name: item.file.name,
          content_type: item.file.type || "application/octet-stream",
          file_size: item.file.size,
          url: item.previewUrl,
          attachment_type: item.file.type.startsWith("image/") ? "image" : "document"
        });

      const ids = successful.map((a) => a.id);
      onAttachmentsChange?.(ids, successful);

      const hasImages = queue.some(
        (item) =>
          item.status !== "error" &&
          (item.file.type.startsWith("image/") || item.attachment?.attachment_type === "image")
      );
      onImagePresenceChange?.(hasImages);

      const isUploading = queue.some((item) => item.status === "uploading");
      onUploadingStateChange?.(isUploading);
    }, [queue, onAttachmentsChange, onImagePresenceChange, onUploadingStateChange]);

    const uploadSingleFile = useCallback(async (tempId: string, file: File) => {
      setQueue((prev) =>
        prev.map((item) => (item.id === tempId ? { ...item, status: "uploading", progress: 0 } : item))
      );

      try {
        const res: MediaUploadResponse = await uploadChatMedia(token || "", file, (percent) => {
          setQueue((prev) =>
            prev.map((item) => (item.id === tempId ? { ...item, progress: percent } : item))
          );
        });

        const attachment: MediaAttachment = res.attachment || {
          id: res.id,
          filename: res.filename || res.file_name || file.name,
          file_name: res.file_name || res.filename || file.name,
          content_type: res.content_type || file.type || "application/octet-stream",
          file_size: res.file_size || file.size,
          url: res.url || res.download_url,
          download_url: res.download_url || res.url,
          attachment_type: res.attachment_type || (file.type.startsWith("image/") ? "image" : "document"),
          parsed_with: res.parsed_with
        };

        setQueue((prev) => {
          const updated = prev.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  status: "success" as const,
                  progress: 100,
                  mediaId: res.id,
                  attachment
                }
              : item
          );
          return updated;
        });
      } catch (err: any) {
        const errMsg = err?.message || "Upload failed";
        if (String(errMsg).toLowerCase().includes("limit")) {
          showWarning(errMsg);
        } else {
          showError(errMsg, "Upload failed.");
        }
        setQueue((prev) => {
          const updated = prev.map((item) =>
            item.id === tempId ? { ...item, status: "error" as const, error: errMsg } : item
          );
          return updated;
        });
      }
    }, [token]);

    const addFiles = useCallback((files: File[]) => {
      if (!files.length || disabled) return;

      const newItems: UploadingFile[] = [];
      for (const file of files) {
        try {
          const validated = validateMediaUpload(file);
          const tempId = crypto.randomUUID();
          let previewUrl: string | undefined;
          if (validated.kind === "image") {
            previewUrl = URL.createObjectURL(file);
          }
          const item: UploadingFile = {
            id: tempId,
            file,
            previewUrl,
            progress: 0,
            status: "idle"
          };
          newItems.push(item);
        } catch (err: any) {
          const tempId = crypto.randomUUID();
          newItems.push({
            id: tempId,
            file,
            progress: 0,
            status: "error",
            error: err.message || "Invalid file"
          });
        }
      }

      setQueue((prev) => {
        const updated = [...prev, ...newItems];
        return updated;
      });

      for (const item of newItems) {
        if (item.status === "idle") {
          void uploadSingleFile(item.id, item.file);
        }
      }
    }, [disabled, uploadSingleFile]);

    const removeItem = useCallback((id: string) => {
      setQueue((prev) => {
        const target = prev.find((i) => i.id === id);
        if (target?.previewUrl && target.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(target.previewUrl);
        }
        const updated = prev.filter((i) => i.id !== id);
        return updated;
      });
    }, []);

    const clearQueue = useCallback(() => {
      setQueue((prev) => {
        prev.forEach((item) => {
          if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(item.previewUrl);
          }
        });
        return [];
      });
    }, []);

    useImperativeHandle(ref, () => ({
      addFiles,
      clearQueue,
      getAttachmentIds: () =>
        queueRef.current.filter((item) => item.status === "success" && item.mediaId).map((item) => item.mediaId!)
    }), [addFiles, clearQueue]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        addFiles(pastedFiles);
      }
    }, [addFiles]);

    if (queue.length === 0) {
      return null;
    }

    return (
      <div className={cn("flex flex-wrap gap-2 p-2", className)} onPaste={handlePaste}>
        {queue.map((item) => {
          const isImage = item.file.type.startsWith("image/");
          return (
            <div
              key={item.id}
              className={cn(
                "group relative flex min-w-0 w-full max-w-full items-center gap-2.5 rounded-xl border border-border/70 bg-card p-2 text-xs shadow-sm transition-all sm:max-w-xs",
                item.status === "error" && "border-destructive/50 bg-destructive/5"
              )}
            >
              {isImage && item.previewUrl ? (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted">
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted text-muted-foreground">
                  <FileText className="h-5 w-5" />
                </div>
              )}

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate font-medium text-foreground">{item.file.name}</p>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{formatFileSize(item.file.size)}</span>
                  {item.status === "uploading" && (
                    <span className="flex items-center gap-1 font-medium text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {item.progress}%
                    </span>
                  )}
                  {item.status === "success" && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Uploaded
                    </span>
                  )}
                  {item.status === "error" && (
                    <span className="flex items-center gap-1 text-destructive" title={item.error}>
                      <AlertCircle className="h-3 w-3" />
                      Failed
                    </span>
                  )}
                </div>

                {item.status === "uploading" && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);

MediaUploader.displayName = "MediaUploader";
