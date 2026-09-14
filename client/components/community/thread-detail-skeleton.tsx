import { Skeleton } from "@/components/ui/skeleton";

export function ThreadDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" role="status" aria-label="Loading thread">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex gap-3 rounded-lg border border-border bg-card p-4 sm:p-5">
        <Skeleton className="h-16 w-10 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-4/5 max-w-lg" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
