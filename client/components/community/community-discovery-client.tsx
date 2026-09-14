"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CommunityFeedSkeleton } from "@/components/community/community-feed-skeleton";
import { CreateGroupDialog } from "@/components/community/create-group-dialog";
import { PostFeedItem } from "@/components/community/post-feed-item";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  listCommunityFeed,
  listCommunityGroups,
  type CommunityFeedItem,
  type CommunityGroup,
  type CommunityThread,
  type ThreadSort
} from "@/lib/community";
import { asRoute, cn } from "@/lib/utils";

const sortOptions: { value: ThreadSort; label: string }[] = [
  { value: "newest", label: "New" },
  { value: "top", label: "Top" },
  { value: "trending", label: "Hot" }
];

export function CommunityDiscoveryClient() {
  const router = useRouter();
  const { token } = useAuth();
  const [feed, setFeed] = useState<CommunityFeedItem[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [sort, setSort] = useState<ThreadSort>("newest");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cancelledRef: { current: boolean }) => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedGroups = await listCommunityGroups(token);
      if (cancelledRef.current) return;
      setGroups(loadedGroups.filter((group) => group.visibility === "public"));
      const loadedFeed = await listCommunityFeed(sort, token);
      if (cancelledRef.current) return;
      setFeed(loadedFeed);
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load community feed");
        setFeed([]);
      }
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, [sort, token]);

  useEffect(() => {
    const cancelledRef = { current: false };
    void load(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(asRoute(`/community/groups?q=${encodeURIComponent(trimmed)}`));
  }

  function handleFeedItemUpdate(updated: CommunityThread) {
    setFeed((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    );
  }

  const joinedGroupIds = new Set(groups.filter((group) => group.is_member).map((group) => group.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Community</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent discussions from public study groups you can browse and join.
          </p>
        </div>
        {token ? (
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
            <Link href={asRoute("/sign-in")}>Sign in to post</Link>
          </Button>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search groups and discussions..."
          className="max-w-md"
        />
        <Button type="submit" variant="outline">
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href={asRoute("/community/groups")}>Browse all groups</Link>
        </Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 space-y-4">
          <div className="landing-horizontal-scroll flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSort(option.value)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  sort === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <CommunityFeedSkeleton />
          ) : error ? (
            <Card className="border-destructive/40">
              <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
            </Card>
          ) : feed.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="space-y-3 p-8 text-center text-sm text-muted-foreground">
                <p>No discussions yet.</p>
                {token ? (
                  <CreateGroupDialog
                    trigger={<Button size="sm">Create the first group</Button>}
                    onCreated={(group) => router.push(asRoute(`/community/groups/${group.slug}`))}
                  />
                ) : (
                  <Button size="sm" asChild>
                    <Link href={asRoute("/sign-in")}>Sign in to get started</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {feed.map((item) => (
                <PostFeedItem
                  key={item.id}
                  thread={item}
                  groupSlug={item.group_slug}
                  groupName={item.group_name}
                  token={token}
                  canVote={Boolean(token && joinedGroupIds.has(item.group_id))}
                  onThreadUpdate={handleFeedItemUpdate}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-medium">Public groups</p>
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No public groups yet.</p>
              ) : (
                <ul className="space-y-2">
                  {groups.slice(0, 8).map((group) => (
                    <li key={group.id}>
                      <Link
                        href={asRoute(`/community/groups/${group.slug}`)}
                        className="block text-sm hover:text-primary"
                      >
                        <span className="font-medium">{group.name}</span>
                        <span className="ml-1 text-muted-foreground">· {group.member_count} members</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={asRoute("/community/groups")}>View all groups</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
