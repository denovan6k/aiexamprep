"use client";

import { Bot, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { AgentCard } from "@/components/agents/agent-card";
import { CreateAgentDialog } from "@/components/agents/create-agent-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionGrid, SectionTitle, Stat } from "@/components/page-kit";
import { useAgentsQuery } from "@/hooks/use-agents";
import { useListPageState } from "@/hooks/use-list-page-state";
import { siteConfig } from "@/lib/site";

export default function AgentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listState = useListPageState();
  const { data, isLoading, error } = useAgentsQuery({
    limit: listState.limit,
    offset: listState.offset,
    q: listState.query || undefined,
    difficulty: listState.difficulty || undefined
  });
  const agents = data?.items ?? [];
  const total = data?.total ?? 0;

  useEffect(() => {
    const agentId = searchParams.get("agent");
    if (agentId) {
      router.replace(`/agents/${agentId}`);
    }
  }, [router, searchParams]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Agents"
        title="Professor-style agents"
        description="Reusable examiner profiles with avatars, editable personas, MCP tools, and one-click chat."
        actions={
          <Button asChild size="sm" className="gap-2">
            <a href="/agents/new">
              <Plus className="h-4 w-4" />
              New agent
            </a>
          </Button>
        }
      />

      <ListToolbar
        searchValue={listState.searchInput}
        onSearchValueChange={listState.setSearchInput}
        onSearchSubmit={listState.applySearch}
        searchPlaceholder="Search agents..."
      >
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={listState.difficulty}
          onChange={(event) => listState.updateDifficulty(event.target.value)}
        >
          <option value="">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </ListToolbar>

      {error ? <p className="mb-4 text-sm text-danger">{error.message}</p> : null}

      <SectionGrid>
        <Stat label="Total agents" value={isLoading ? "—" : String(total)} />
        <Stat
          label="With MCP tools"
          value={isLoading ? "—" : String(agents.filter((agent) => agent.mcp_connection_count > 0).length)}
        />
        <Stat
          label="Strict markers"
          value={isLoading ? "—" : String(agents.filter((agent) => agent.marking_strictness === "strict").length)}
          tone="success"
        />
      </SectionGrid>

      <SectionTitle title="Your agent profiles" description="Open a profile to edit, connect MCP servers, or chat." />

      {isLoading ? (
        <SectionGrid>
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-56 w-full rounded-xl" />
          ))}
        </SectionGrid>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title={listState.query || listState.difficulty ? "No agents match your filters" : "No agents yet"}
          description={
            listState.query || listState.difficulty
              ? "Try a different search or clear filters."
              : `Create your first professor-style agent to shape how ${siteConfig.name} writes questions and feedback.`
          }
          action={
            listState.query || listState.difficulty ? (
              <Button variant="outline" onClick={listState.resetFilters}>
                Clear filters
              </Button>
            ) : (
              <CreateAgentDialog
                trigger={
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create your first agent
                  </Button>
                }
              />
            )
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
          <PaginationControls
            className="mt-6"
            total={total}
            limit={listState.limit}
            offset={listState.offset}
            onPageChange={listState.setOffset}
          />
        </>
      )}
    </div>
  );
}
