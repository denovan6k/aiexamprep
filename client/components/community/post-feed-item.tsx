"use client";

import Link from "next/link";
import { MessageSquare, Pin } from "lucide-react";
import { useState } from "react";

import { AuthorLink } from "@/components/community/reputation-badge";
import { VoteButtons } from "@/components/community/vote-buttons";
import { Badge } from "@/components/ui/badge";
import { voteThread, type CommunityThread } from "@/lib/community";
import { showError } from "@/lib/toast";
import { asRoute, cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function previewText(body: string) {
  return body.replace(/!\[[^\]]*\]\([^)]+\)/g, "[image]").replace(/[#*`>\[\]]/g, "").trim();
}

type PostFeedItemProps = {
  thread: CommunityThread;
  groupSlug: string;
  groupName?: string;
  token?: string | null;
  canVote?: boolean;
  onThreadUpdate?: (thread: CommunityThread) => void;
};

export function PostFeedItem({
  thread,
  groupSlug,
  groupName,
  token,
  canVote = false,
  onThreadUpdate
}: PostFeedItemProps) {
  const [localThread, setLocalThread] = useState(thread);
  const [isVoting, setIsVoting] = useState(false);

  async function handleVote(vote: 1 | -1 | 0) {
    if (!token || !canVote) return;
    setIsVoting(true);
    try {
      const updated = await voteThread(token, localThread.id, vote);
      setLocalThread(updated);
      onThreadUpdate?.(updated);
    } catch (err) {
      showError(err, "Could not register vote");
    } finally {
      setIsVoting(false);
    }
  }

  const href = asRoute(`/community/groups/${groupSlug}/threads/${localThread.id}`);

  return (
    <article
      className={cn(
        "flex gap-2 rounded-lg border border-border bg-card transition-colors hover:border-primary/30 sm:gap-3",
        localThread.pinned && "border-primary/40 bg-primary/[0.03]"
      )}
    >
      <div className="flex shrink-0 flex-col items-center py-3 pl-2 sm:pl-3">
        <VoteButtons
          score={localThread.score ?? 0}
          userVote={localThread.user_vote}
          disabled={!canVote || isVoting}
          onVote={(vote) => void handleVote(vote)}
        />
      </div>

      <div className="min-w-0 flex-1 py-3 pr-3 sm:pr-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {localThread.pinned ? (
            <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
              <Pin className="h-3 w-3" />
              Pinned
            </Badge>
          ) : null}
          {groupName ? (
            <>
              <Link href={asRoute(`/community/groups/${groupSlug}`)} className="font-medium hover:text-primary">
                {groupName}
              </Link>
              <span>·</span>
            </>
          ) : null}
          <AuthorLink authorId={localThread.author_id} authorName={localThread.author_name} />
          <span>·</span>
          <span>{timeAgo(localThread.created_at)}</span>
        </div>

        <Link href={href} className="mt-1 block group">
          <h3 className="text-base font-semibold leading-snug group-hover:text-primary sm:text-[1.05rem]">
            {localThread.title}
          </h3>
          {localThread.body ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{previewText(localThread.body)}</p>
          ) : null}
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Link href={href} className="inline-flex items-center gap-1 hover:text-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {localThread.reply_count ?? 0} comments
          </Link>
        </div>
      </div>
    </article>
  );
}
