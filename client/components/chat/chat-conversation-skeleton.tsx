import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ChatConversationSkeletonProps = {
  showComposer?: boolean;
  className?: string;
};

export function ChatConversationSkeleton({
  showComposer = false,
  className
}: ChatConversationSkeletonProps) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
      role="status"
      aria-label="Loading conversation"
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
          <Skeleton className="h-20 w-[78%] rounded-2xl" />
          <Skeleton className="ml-auto h-12 w-[52%] rounded-2xl" />
          <Skeleton className="h-16 w-[65%] rounded-2xl" />
        </div>
      </div>
      {showComposer ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4 sm:px-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : null}
    </div>
  );
}
