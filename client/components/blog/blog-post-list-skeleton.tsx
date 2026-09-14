import { Skeleton } from "@/components/ui/skeleton";

export function BlogPostListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading posts">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function BlogIndexSkeleton() {
  return (
    <div className="mt-10 space-y-6" role="status" aria-label="Loading articles">
      <Skeleton className="h-56 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
