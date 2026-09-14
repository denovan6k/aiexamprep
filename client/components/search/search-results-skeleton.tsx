import { Skeleton } from "@/components/ui/skeleton";

export function SearchResultsSkeleton({ mode }: { mode: "search" | "ask" }) {
  return (
    <section className="space-y-4" role="status" aria-label="Loading search results">
      {mode === "ask" ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : null}
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-xl" />
      ))}
    </section>
  );
}
