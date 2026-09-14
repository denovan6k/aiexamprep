"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flag, Loader2, Lock, Pin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AuthorLink } from "@/components/community/reputation-badge";
import { ThreadReplies } from "@/components/community/thread-replies";
import { VoteButtons } from "@/components/community/vote-buttons";
import { Markdown } from "@/components/markdown";
import { ThreadDetailSkeleton } from "@/components/community/thread-detail-skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSuperAdmin } from "@/lib/api";
import {
  createContentReport,
  getCommunityGroupBySlug,
  getThread,
  listThreadReplies,
  lockThread,
  pinThread,
  unpinThread,
  unlockThread,
  voteThread,
  type CommunityGroup,
  type CommunityReply,
  type CommunityThread
} from "@/lib/community";
import { showError, showInfo, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

export function ThreadDetailView({ slug, threadId }: { slug: string; threadId: string }) {
  const router = useRouter();
  const { token, user } = useAuth();
  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [thread, setThread] = useState<CommunityThread | null>(null);
  const [replies, setReplies] = useState<CommunityReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async (cancelledRef: { current: boolean }) => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedGroup = await getCommunityGroupBySlug(slug, token);
      const loadedThread = await getThread(threadId, token);
      if (loadedThread.group_id !== loadedGroup.id) {
        throw new Error("Thread does not belong to this group.");
      }
      if (cancelledRef.current) return;
      setGroup(loadedGroup);
      setThread(loadedThread);
      const loadedReplies = await listThreadReplies(threadId, token);
      if (cancelledRef.current) return;
      setReplies(loadedReplies);
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load thread");
        setGroup(null);
        setThread(null);
      }
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, [slug, threadId, token]);

  useEffect(() => {
    const cancelledRef = { current: false };
    void load(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  const canModerate =
    group?.membership_role === "owner" ||
    group?.membership_role === "moderator" ||
    isSuperAdmin(user);

  async function handleVote(vote: 1 | -1 | 0) {
    if (!token || !thread) return;
    setIsSubmitting(true);
    try {
      setThread(await voteThread(token, thread.id, vote));
    } catch (err) {
      showError(err, "Could not register vote. Join the group to vote.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleModeration(action: "pin" | "lock") {
    if (!token || !thread) return;
    try {
      const updated =
        action === "pin"
          ? thread.pinned
            ? await unpinThread(token, thread.id)
            : await pinThread(token, thread.id)
          : thread.locked
            ? await unlockThread(token, thread.id)
            : await lockThread(token, thread.id);
      setThread(updated);
      if (action === "pin") {
        showSuccess(updated.pinned ? "Thread pinned." : "Thread unpinned.");
      } else {
        showSuccess(updated.locked ? "Thread locked." : "Thread unlocked.");
      }
    } catch (err) {
      showError(err, action === "pin" ? "Failed to update pin status." : "Failed to update lock status.");
    }
  }

  async function handleReport() {
    if (!token || !thread) return;
    try {
      await createContentReport(token, {
        target_type: "thread",
        target_id: thread.id,
        reason: "Inappropriate content"
      });
      showInfo("Report submitted.");
    } catch (err) {
      showError(err, "Failed to submit report.");
    }
  }

  if (isLoading) {
    return <ThreadDetailSkeleton />;
  }

  if (error || !group || !thread) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Discussion unavailable</CardTitle>
          <CardDescription>{error ?? "This thread could not be found."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => router.push(asRoute(`/community/groups/${slug}`))}>
            Back to group
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href={asRoute(`/community/groups/${slug}`)} className="font-medium hover:text-foreground">
          {group.name}
        </Link>
        <span>/</span>
        <span className="truncate text-foreground">{thread.title}</span>
      </div>

      <div className="flex gap-3 rounded-lg border border-border bg-card p-4 sm:p-5">
        <VoteButtons
          score={thread.score ?? 0}
          userVote={thread.user_vote}
          disabled={!token || !group.is_member || isSubmitting}
          onVote={(vote) => void handleVote(vote)}
          size="default"
        />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {thread.pinned ? (
                <Badge variant="secondary">
                  <Pin className="mr-1 h-3 w-3" />
                  Pinned
                </Badge>
              ) : null}
              {thread.locked ? (
                <Badge variant="outline">
                  <Lock className="mr-1 h-3 w-3" />
                  Locked
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-2 text-xl font-semibold leading-snug sm:text-2xl">{thread.title}</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              <AuthorLink authorId={thread.author_id} authorName={thread.author_name} /> ·{" "}
              {new Date(thread.created_at).toLocaleString()} · {thread.reply_count ?? 0} comments
            </p>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-sm sm:text-base">
            <Markdown>{thread.body}</Markdown>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {canModerate ? (
              <>
                <Button variant="outline" size="sm" onClick={() => void handleModeration("pin")}>
                  <Pin className="mr-1 h-3.5 w-3.5" /> {thread.pinned ? "Unpin" : "Pin"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleModeration("lock")}>
                  <Lock className="mr-1 h-3.5 w-3.5" /> {thread.locked ? "Unlock" : "Lock"}
                </Button>
              </>
            ) : null}
            {token ? (
              <Button variant="ghost" size="sm" onClick={() => void handleReport()}>
                <Flag className="mr-1 h-3.5 w-3.5" /> Report
              </Button>
            ) : null}
          </div>

          {group.is_member && !thread.locked ? (
            <ThreadReplies
              threadId={thread.id}
              replies={replies}
              token={token}
              canPost={Boolean(group.is_member)}
              canModerate={canModerate}
              currentUserId={user?.id}
              onRepliesChange={setReplies}
            />
          ) : thread.locked ? (
            <p className="text-sm text-muted-foreground">This thread is locked. No new replies can be posted.</p>
            ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm text-muted-foreground">Join this group to reply and vote.</p>
                <Button size="sm" asChild>
                  <Link href={asRoute("/sign-in")}>Sign in</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
