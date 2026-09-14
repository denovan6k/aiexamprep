import { Skeleton } from "@/components/ui/skeleton";

export function SettingsCardFieldsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-3" role="status" aria-label="Loading settings">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function SettingsProfileListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading profiles">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full rounded-md" />
      ))}
    </div>
  );
}
