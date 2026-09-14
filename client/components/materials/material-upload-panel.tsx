"use client";

import { FileUp, Loader2, Upload } from "lucide-react";

import { QuotaTooltip } from "@/components/billing/quota-tooltip";
import { FileUpload, FileUploadContent, FileUploadTrigger } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlanQuota } from "@/hooks/use-billing";
import { showPromise } from "@/lib/toast";
import { cn } from "@/lib/utils";

type MaterialUploadPanelProps = {
  onUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
  disabled?: boolean;
  title?: string;
  description?: string;
  className?: string;
};

export function MaterialUploadPanel({
  onUpload,
  isUploading,
  disabled,
  title = "Upload material",
  description = "PDF, DOCX, PPTX, TXT, or Markdown files up to 25 MB.",
  className
}: MaterialUploadPanelProps) {
  const { uploadBlocked, uploadBlockedReason } = usePlanQuota();
  const isDisabled = disabled || isUploading || uploadBlocked;
  const disabledReason = uploadBlocked ? uploadBlockedReason : null;

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    try {
      await showPromise(onUpload(file), {
        loading: "Uploading and processing…",
        success: "Material uploaded.",
        error: "Could not upload this file."
      });
    } catch {
      // Error surfaced via toast.
    }
  }

  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <FileUpload
          accept=".pdf,.docx,.pptx,.txt,.md"
          multiple={false}
          disabled={isDisabled}
          onFilesAdded={(files) => void handleFiles(files)}
        >
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/20 px-6 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {isUploading ? "Uploading and processing…" : "Drop a file here or browse"}
              </p>
              <p className="text-xs text-muted-foreground">Supported: PDF, DOCX, PPTX, TXT, MD</p>
            </div>
            <FileUploadTrigger asChild>
              <QuotaTooltip reason={disabledReason}>
                <Button type="button" variant="outline" size="sm" disabled={isDisabled}>
                  Choose file
                </Button>
              </QuotaTooltip>
            </FileUploadTrigger>
          </div>
          <FileUploadContent />
        </FileUpload>
      </CardContent>
    </Card>
  );
}
