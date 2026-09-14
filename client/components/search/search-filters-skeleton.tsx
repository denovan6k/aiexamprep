import { Skeleton } from "@/components/ui/skeleton";

export function SearchFiltersSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading materials">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-8 w-full rounded-md" />
      ))}
    </div>
  );
}
