import { Skeleton } from "@/components/ui/skeleton";

export function CommunityFeedSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading feed">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}
