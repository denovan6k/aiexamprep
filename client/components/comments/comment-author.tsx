"use client";

import Link from "next/link";

import { timeAgo } from "@/components/blog/blog-ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authorInitials } from "@/lib/comment-markdown";
import { asRoute, cn } from "@/lib/utils";

type CommentAuthorProps = {
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  createdAt: string;
  linkToProfile?: boolean;
  className?: string;
};

export function CommentAuthor({
  authorId,
  authorName,
  authorAvatarUrl,
  createdAt,
  linkToProfile = false,
  className
}: CommentAuthorProps) {
  const nameContent =
    linkToProfile ? (
      <Link
        href={asRoute(`/community/members/${authorId}`)}
        className="font-medium text-foreground hover:text-primary hover:underline"
      >
        {authorName}
      </Link>
    ) : (
      <span className="font-medium text-foreground">{authorName}</span>
    );

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar className="h-8 w-8 shrink-0">
        {authorAvatarUrl ? <AvatarImage src={authorAvatarUrl} alt={authorName} /> : null}
        <AvatarFallback className="text-xs font-medium">{authorInitials(authorName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
          {nameContent}
          <span className="text-muted-foreground">·</span>
          <time className="text-xs text-muted-foreground" dateTime={createdAt}>
            {timeAgo(createdAt)}
          </time>
        </div>
      </div>
    </div>
  );
}
