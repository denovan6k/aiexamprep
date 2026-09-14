"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, Loader2, UserMinus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { GroupSidebar } from "@/components/community/group-sidebar";
import { CommentComposer } from "@/components/comments/comment-composer";
import { PostFeedItem } from "@/components/community/post-feed-item";
import { GroupDetailSkeleton } from "@/components/community/group-detail-skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import {
  createGroupThread,
  getCommunityGroupBySlug,
  joinCommunityGroup,
  leaveCommunityGroup,
  listGroupMembers,
  listGroupThreads,
  listSharedResources,
  type CommunityGroup,
  type CommunityMember,
  type CommunityThread,
  type SharedResource,
  type ThreadSort
} from "@/lib/community";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute, cn } from "@/lib/utils";

const sortOptions: { value: ThreadSort; label: string }[] = [
  { value: "newest", label: "New" },
  { value: "top", label: "Top" },
  { value: "trending", label: "Hot" }
];

export function GroupDetailView({ slug }: { slug: string }) {
  const router = useRouter();
  const { token } = useAuth();
  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [sort, setSort] = useState<ThreadSort>("newest");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threadTitle, setThreadTitle] = useState("");
  const [threadBody, setThreadBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const loadGroup = useCallback(async (cancelledRef: { current: boolean }) => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedGroup = await getCommunityGroupBySlug(slug, token);
      if (cancelledRef.current) return;
      setGroup(loadedGroup);
      const [loadedThreads, loadedMembers, loadedResources] = await Promise.all([
        listGroupThreads(loadedGroup.id, token, sort),
        listGroupMembers(loadedGroup.id, token),
        listSharedResources(loadedGroup.id, token)
      ]);
      if (cancelledRef.current) return;
      setThreads(loadedThreads);
      setMembers(loadedMembers);
      setResources(loadedResources);
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load group");
        setGroup(null);
      }
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, [slug, token, sort]);

  useEffect(() => {
    const cancelledRef = { current: false };
    void loadGroup(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadGroup]);

  async function handleJoinLeave() {
    if (!token || !group) return;
    const wasMember = group.is_member;
    setIsSubmitting(true);
    try {
      const updated = wasMember
        ? await leaveCommunityGroup(token, group.id)
        : await joinCommunityGroup(token, group.id);
      setGroup(updated);
      await loadGroup({ current: false });
      showSuccess(wasMember ? "Left group." : "Joined group.");
    } catch (err) {
      showError(err, wasMember ? "Failed to leave group." : "Failed to join group.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateThread(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !group || !threadTitle.trim() || !threadBody.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await createGroupThread(token, group.id, threadTitle.trim(), threadBody.trim());
      setThreadTitle("");
      setThreadBody("");
      setComposerOpen(false);
      router.push(asRoute(`/community/groups/${slug}/threads/${created.id}`));
    } catch (err) {
      showError(err, "Failed to create post");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleThreadUpdate(updated: CommunityThread) {
    setThreads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }

  if (isLoading) {
    return <GroupDetailSkeleton />;
  }

  if (error || !group) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Group unavailable</CardTitle>
          <CardDescription>{error ?? "This group could not be found."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => router.push(asRoute("/community/groups"))}>
            Back to groups
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <header className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{group.visibility}</Badge>
              {group.school_name ? <Badge variant="secondary">{group.school_name}</Badge> : null}
              {group.is_member ? <Badge>Joined</Badge> : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{group.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {group.description ?? "Discuss topics, share resources, and study together."}
            </p>
          </div>
          {token ? (
            <Button
              onClick={() => void handleJoinLeave()}
              disabled={isSubmitting || group.membership_role === "owner"}
              variant={group.is_member ? "outline" : "default"}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : group.is_member ? (
                <UserMinus className="mr-2 h-4 w-4" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {group.is_member ? "Leave" : "Join"}
            </Button>
          ) : (
            <Button asChild>
              <Link href={asRoute("/sign-in")}>
                <UserPlus className="mr-2 h-4 w-4" />
                Sign in to join
              </Link>
            </Button>
          )}
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 lg:hidden">
        <p className="text-sm text-muted-foreground">{members.length} members · {resources.length} resources</p>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Info className="h-4 w-4" />
              Group info
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{group.name}</SheetTitle>
              <SheetDescription>Members, resources, and group details.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <GroupSidebar
                group={group}
                members={members}
                resources={resources}
                token={token}
                onResourcesChange={() => void loadGroup({ current: false })}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4">
          {group.is_member ? (
            <Card>
              <CardContent className="p-0">
                {!composerOpen ? (
                  <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    className="w-full px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50"
                  >
                    Create a post in {group.name}…
                  </button>
                ) : (
                  <form onSubmit={(event) => void handleCreateThread(event)} className="space-y-3 p-4">
                    <Input
                      value={threadTitle}
                      onChange={(event) => setThreadTitle(event.target.value)}
                      placeholder="Title"
                      disabled={isSubmitting}
                    />
                    <CommentComposer
                      value={threadBody}
                      onChange={setThreadBody}
                      disabled={isSubmitting}
                      placeholder="Add details…"
                      minHeight={120}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={isSubmitting || !threadTitle.trim() || !threadBody.trim()}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Post
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setComposerOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-4 text-sm text-muted-foreground">
                Join this group to post and vote on discussions.
              </CardContent>
            </Card>
          )}

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

          {threads.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                {group.is_member
                  ? "No posts yet. Be the first to start a discussion."
                  : "No posts yet. Join the group to participate."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {threads.map((thread) => (
                <PostFeedItem
                  key={thread.id}
                  thread={thread}
                  groupSlug={slug}
                  token={token}
                  canVote={Boolean(group.is_member && token)}
                  onThreadUpdate={handleThreadUpdate}
                />
              ))}
            </div>
          )}
        </div>

        <GroupSidebar
          className="hidden lg:block"
          group={group}
          members={members}
          resources={resources}
          token={token}
          onResourcesChange={() => void loadGroup({ current: false })}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        <Link href={asRoute("/community/groups")} className="underline-offset-4 hover:underline">
          ← All groups
        </Link>
      </p>
    </div>
  );
}
