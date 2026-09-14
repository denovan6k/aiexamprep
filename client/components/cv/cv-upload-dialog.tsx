"use client";

import { FileUp, Loader2, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { FileUpload, FileUploadContent, FileUploadTrigger } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUploadCvDocumentMutation } from "@/hooks/use-cv";
import type { CvDocument } from "@/lib/cv";
import { showPromise } from "@/lib/toast";

export function CvUploadDialog({
  trigger,
  onUploaded
}: {
  trigger: ReactNode;
  onUploaded?: (document: CvDocument) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const mutation = useUploadCvDocumentMutation();

  function reset() {
    setFile(null);
    setTitle("");
  }

  async function handleUpload() {
    if (!file) return;
    try {
      const document = await showPromise(mutation.mutateAsync({ file, title }), {
        loading: "Uploading CV…",
        success: "CV uploaded.",
        error: "Could not upload this CV."
      });
      onUploaded?.(document);
      setOpen(false);
      reset();
    } catch {
      // Error surfaced via toast.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload CV</DialogTitle>
          <DialogDescription>Use a PDF, DOCX, or TXT file up to the backend upload limit.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FileUpload onFilesAdded={(files) => setFile(files[0] ?? null)} multiple={false} accept=".pdf,.docx,.txt">
            <FileUploadTrigger
              className="flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 text-center transition-colors hover:bg-muted/50"
              disabled={mutation.isPending}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-background text-muted-foreground">
                <FileUp className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium">{file ? file.name : "Drop a CV here or browse"}</span>
              <span className="text-xs text-muted-foreground">PDF, DOCX, or TXT</span>
            </FileUploadTrigger>
            <FileUploadContent>
              <div className="rounded-lg border bg-background px-6 py-4 text-sm font-medium shadow-elevated">
                Drop the CV to upload
              </div>
            </FileUploadContent>
          </FileUpload>

          <div className="space-y-2">
            <Label htmlFor="cv-title">Title</Label>
            <Input
              id="cv-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={file?.name ? file.name.replace(/\.[^.]+$/, "") : "Software engineering CV"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="button" className="gap-2" onClick={() => void handleUpload()} disabled={!file || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {mutation.isPending ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
