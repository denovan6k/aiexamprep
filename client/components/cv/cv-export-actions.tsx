"use client";

import { Check, Clipboard, Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useDownloadTailoredCvMutation } from "@/hooks/use-cv";
import { tailoredSectionsToPlainText, type CvTailoring } from "@/lib/cv";
import { showError, showPromise, showSuccess } from "@/lib/toast";

export function CvExportActions({ tailoring }: { tailoring: CvTailoring | null }) {
  const [copied, setCopied] = useState(false);
  const downloadMutation = useDownloadTailoredCvMutation();
  const isReady = tailoring?.status === "completed" && Boolean(tailoring.tailored_sections);

  async function copyPlainText() {
    if (!tailoring?.tailored_sections) return;
    try {
      await navigator.clipboard.writeText(tailoredSectionsToPlainText(tailoring.tailored_sections));
      setCopied(true);
      showSuccess("Copied to clipboard.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch (copyError) {
      showError(copyError, "Could not copy the tailored CV.");
    }
  }

  async function downloadDocx() {
    if (!tailoring) return;
    try {
      const { blob, filename } = await showPromise(downloadMutation.mutateAsync(tailoring.id), {
        loading: "Downloading…",
        success: "CV downloaded.",
        error: "Could not download the tailored CV."
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Error surfaced via toast.
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" className="gap-2" disabled={!isReady} onClick={() => void copyPlainText()}>
        {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
        {copied ? "Copied" : "Copy"}
      </Button>
      <Button
        size="sm"
        className="gap-2"
        disabled={!isReady || downloadMutation.isPending}
        onClick={() => void downloadDocx()}
      >
        <Download className="h-4 w-4" />
        {downloadMutation.isPending ? "Downloading..." : "Download Word"}
      </Button>
    </div>
  );
}
