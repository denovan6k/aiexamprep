import { Skeleton } from "@/components/ui/skeleton";

export function AgentMcpPanelSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading MCP connections">
      {Array.from({ length: 2 }).map((_, index) => (
        <Skeleton key={index} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}
