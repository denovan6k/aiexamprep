"use client";

import { Clock3, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteCvTailoringMutation } from "@/hooks/use-cv";
import type { CvTailoring } from "@/lib/cv";
import { showError, showSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

const statusVariant: Record<CvTailoring["status"], "secondary" | "success" | "warning" | "danger"> = {
  queued: "secondary",
  running: "warning",
  completed: "success",
  failed: "danger"
};

export function CvTailoringHistory({
  tailorings,
  selectedTailoringId,
  isLoading,
  onSelect
}: {
  tailorings: CvTailoring[];
  selectedTailoringId: string | null;
  isLoading: boolean;
  onSelect: (tailoring: CvTailoring) => void;
}) {
  const deleteMutation = useDeleteCvTailoringMutation();
  const selectedItemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedTailoringId, tailorings.length]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((item) => (
          <Skeleton key={item} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (tailorings.length === 0) {
    return (
      <EmptyState
        icon={Clock3}
        title="No tailorings yet"
        description="Generated CVs for the selected source will appear here."
      />
    );
  }

  return (
    <div className="max-h-[360px] space-y-2 overflow-y-auto overscroll-y-contain pr-1">
      {tailorings.map((tailoring) => {
        const selected = tailoring.id === selectedTailoringId;
        return (
          <div
            key={tailoring.id}
            ref={selected ? selectedItemRef : null}
            className={cn(
              "group rounded-lg border bg-card p-3 transition-colors",
              selected ? "border-primary/50 bg-primary/5" : "hover:bg-accent/50"
            )}
          >
            <button type="button" className="w-full text-left" onClick={() => onSelect(tailoring)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tailoring.job_title || "Tailored CV"}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {tailoring.company || "No company set"}
                  </p>
                </div>
                <Badge variant={statusVariant[tailoring.status]}>{tailoring.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {tailoring.created_at ? new Date(tailoring.created_at).toLocaleDateString() : ""}
              </p>
            </button>
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 text-muted-foreground hover:text-danger"
                disabled={deleteMutation.isPending}
                onClick={() =>
                  deleteMutation.mutate(tailoring.id, {
                    onSuccess: () => showSuccess("Tailoring deleted."),
                    onError: (err) => showError(err, "Failed to delete tailoring.")
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
