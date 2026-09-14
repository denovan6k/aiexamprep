import { Skeleton } from "@/components/ui/skeleton";

export function RemediationPanelSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4" role="status" aria-label="Loading review actions">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="flex flex-wrap gap-2 pt-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-36 rounded-md" />
        ))}
      </div>
    </div>
  );
}
