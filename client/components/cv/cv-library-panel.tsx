"use client";

import { FileText, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteCvDocumentMutation } from "@/hooks/use-cv";
import type { CvDocument } from "@/lib/cv";
import { showError, showSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

const statusVariant: Record<CvDocument["status"], "secondary" | "success" | "warning" | "danger"> = {
  uploaded: "secondary",
  processing: "warning",
  processed: "success",
  failed: "danger"
};

export function CvLibraryPanel({
  documents,
  selectedDocumentId,
  isLoading,
  onSelect
}: {
  documents: CvDocument[];
  selectedDocumentId: string | null;
  isLoading: boolean;
  onSelect: (document: CvDocument) => void;
}) {
  const deleteMutation = useDeleteCvDocumentMutation();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No CVs yet"
        description="Upload a source CV once, then reuse it for each role."
      />
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((document) => {
        const selected = document.id === selectedDocumentId;
        return (
          <div
            key={document.id}
            className={cn(
              "group rounded-lg border bg-card p-3 transition-colors",
              selected ? "border-primary/50 bg-primary/5" : "hover:bg-accent/50"
            )}
          >
            <button type="button" className="w-full text-left" onClick={() => onSelect(document)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{document.title || document.file_name}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{document.file_name}</p>
                </div>
                <Badge variant={statusVariant[document.status]}>{document.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {document.created_at ? new Date(document.created_at).toLocaleDateString() : ""}
              </p>
              {document.error_message ? <p className="mt-2 text-xs text-danger">{document.error_message}</p> : null}
            </button>
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 text-muted-foreground hover:text-danger"
                disabled={deleteMutation.isPending}
                onClick={() =>
                  deleteMutation.mutate(document.id, {
                    onSuccess: () => showSuccess("CV deleted."),
                    onError: (err) => showError(err, "Failed to delete CV.")
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
