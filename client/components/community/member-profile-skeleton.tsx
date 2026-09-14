import { Skeleton } from "@/components/ui/skeleton";

export function MemberProfileSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading profile">
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-2/3 max-w-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    </div>
  );
}
