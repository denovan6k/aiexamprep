"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CreateGroupDialog } from "@/components/community/create-group-dialog";
import { ItemCard, PageHeader, SectionGrid, SectionTitle, Stat } from "@/components/page-kit";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  listCommunityGroups,
  searchCommunity,
  type CommunityGroup,
  type CommunityThread
} from "@/lib/community";
import { asRoute } from "@/lib/utils";

export function CommunityGroupsClient({
  initialGroups,
  initialQuery = ""
}: {
  initialGroups: CommunityGroup[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const { token } = useAuth();
  const [groups, setGroups] = useState(initialGroups);
  const [threadResults, setThreadResults] = useState<CommunityThread[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [isFiltered, setIsFiltered] = useState(Boolean(initialQuery.trim()));
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "joined">("all");

  const refreshGroups = useCallback(async () => {
    setGroups(await listCommunityGroups(token));
    setThreadResults([]);
    setIsFiltered(false);
  }, [token]);

  useEffect(() => {
    void refreshGroups();
  }, [refreshGroups]);

  useEffect(() => {
    const trimmed = initialQuery.trim();
    if (!trimmed) return;

    setIsSearching(true);
    void searchCommunity(trimmed, token)
      .then((results) => {
        setGroups(results.groups);
        setThreadResults(results.threads);
        setIsFiltered(true);
      })
      .finally(() => setIsSearching(false));
  }, [initialQuery, token]);

  const filteredGroups = groups.filter((group) => {
    if (visibilityFilter === "public") return group.visibility === "public";
    if (visibilityFilter === "joined") return group.is_member;
    return true;
  });
  const totalMembers = filteredGroups.reduce((sum, group) => sum + group.member_count, 0);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) {
      await refreshGroups();
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchCommunity(query.trim(), token);
      setGroups(results.groups);
      setThreadResults(results.threads);
      setIsFiltered(true);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Groups"
        title="Study groups"
        description="Focused communities where members discuss topics and share quizzes, flashcards, and agents."
        actions={
          token ? (
            <CreateGroupDialog
              trigger={
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create group
                </Button>
              }
              onCreated={(group) => router.push(asRoute(`/community/groups/${group.slug}`))}
            />
          ) : (
            <Button size="sm" asChild>
              <Link href={asRoute("/sign-in")}>Sign in to create</Link>
            </Button>
          )
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form onSubmit={(event) => void handleSearch(event)} className="flex flex-1 gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search groups and discussions..."
            className="max-w-md"
          />
          <Button type="submit" variant="outline" disabled={isSearching}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
          {isFiltered ? (
            <Button type="button" variant="ghost" onClick={() => void refreshGroups()}>
              Clear
            </Button>
          ) : null}
        </form>
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={visibilityFilter}
          onChange={(event) => setVisibilityFilter(event.target.value as "all" | "public" | "joined")}
        >
          <option value="all">All groups</option>
          <option value="public">Public only</option>
          <option value="joined">My groups</option>
        </select>
      </div>

      <div className="mt-6">
        <SectionGrid cols={2}>
          <Stat label={isFiltered ? "Matching groups" : "Groups"} value={String(filteredGroups.length)} />
          <Stat label="Total members" value={String(totalMembers)} tone="success" />
        </SectionGrid>
      </div>

      <SectionTitle title={isFiltered ? "Group results" : "Discover groups"} />
      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {isFiltered ? "No groups matched your search." : "No groups match this filter."}
          </CardContent>
        </Card>
      ) : (
        <SectionGrid>
          {filteredGroups.map((group) => (
            <ItemCard
              key={group.id}
              eyebrow={group.visibility}
              title={group.name}
              description={group.description ?? "No description"}
              meta={`${group.member_count} members - ${group.school_name ?? "Open"}${group.is_member ? " - Joined" : ""}`}
              href={`/community/groups/${group.slug}`}
            />
          ))}
        </SectionGrid>
      )}

      {threadResults.length > 0 ? (
        <>
          <SectionTitle title="Discussion results" />
          <div className="grid gap-3">
            {threadResults.map((thread) => {
              const group = groups.find((item) => item.id === thread.group_id);
              return (
                <Card key={thread.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      {thread.pinned ? <Badge>Pinned</Badge> : null}
                      {thread.locked ? <Badge variant="outline">Locked</Badge> : null}
                      <Badge variant="secondary">{thread.score ?? 0} votes</Badge>
                    </div>
                    <CardTitle className="text-base">{thread.title}</CardTitle>
                    <CardDescription>
                      {thread.author_name ?? "Member"} · {thread.reply_count ?? 0} replies
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{thread.body}</p>
                    {group ? (
                      <Button className="mt-3" variant="outline" size="sm" asChild>
                        <Link href={asRoute(`/community/groups/${group.slug}/threads/${thread.id}`)}>
                          Open discussion
                        </Link>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { title: "Create a group", desc: "Set visibility, invite members, and keep discussions focused." },
          { title: "Share resources", desc: "Share quizzes, flashcard decks, and professor agents explicitly." },
          { title: "Moderate content", desc: "Pin threads, lock discussions, and report problem content." }
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="text-sm">{item.title}</CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        <Link href={asRoute("/community")} className="underline-offset-4 hover:underline">
          Back to community home
        </Link>
      </p>
    </div>
  );
}
