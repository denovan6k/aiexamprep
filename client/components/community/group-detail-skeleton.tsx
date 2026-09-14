import { Skeleton } from "@/components/ui/skeleton";

export function GroupDetailSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading group">
      <header className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="space-y-3 px-4 py-5 sm:px-6">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="hidden h-48 rounded-xl lg:block" />
      </div>
    </div>
  );
}
