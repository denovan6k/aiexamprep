"use client";

import { Flag, Loader2, Pencil, Reply, Trash2 } from "lucide-react";
import { useState } from "react";

import { CommentAuthor } from "@/components/comments/comment-author";
import { CommentComposer } from "@/components/comments/comment-composer";
import { VoteButtons } from "@/components/community/vote-buttons";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ThreadComment = {
  id: string;
  parent_id?: string | null;
  body: string;
  author_id: string;
  author_name: string;
  author_avatar_url?: string | null;
  score?: number;
  user_vote?: number | null;
  created_at: string;
};

type CommentThreadProps = {
  comments: ThreadComment[];
  canPost: boolean;
  canVote?: boolean;
  currentUserId?: string | null;
  linkAuthorToProfile?: boolean;
  canEdit?: (comment: ThreadComment) => boolean;
  canDelete?: (comment: ThreadComment) => boolean;
  canReport?: boolean;
  onVote?: (commentId: string, vote: 1 | -1 | 0) => void | Promise<void>;
  onReply: (parentId: string | null, body: string) => void | Promise<void>;
  onEdit?: (commentId: string, body: string) => void | Promise<void>;
  onDelete?: (commentId: string) => void | Promise<void>;
  onReport?: (commentId: string) => void | Promise<void>;
  topLevelPlaceholder?: string;
  replyPlaceholder?: string;
  showTopLevelComposer?: boolean;
  emptyMessage?: string | null;
};

type CommentNode = ThreadComment & { children: CommentNode[] };

function buildCommentTree(comments: ThreadComment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, children: [] });
  }
  for (const comment of comments) {
    const node = nodes.get(comment.id)!;
    if (comment.parent_id && nodes.has(comment.parent_id)) {
      nodes.get(comment.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function CommentItem({
  comment,
  depth,
  canPost,
  canVote,
  currentUserId,
  linkAuthorToProfile,
  canEdit,
  canDelete,
  canReport,
  onVote,
  onReply,
  onEdit,
  onDelete,
  onReport,
  replyPlaceholder
}: {
  comment: CommentNode;
  depth: number;
  canPost: boolean;
  canVote: boolean;
  currentUserId?: string | null;
  linkAuthorToProfile: boolean;
  canEdit?: (comment: ThreadComment) => boolean;
  canDelete?: (comment: ThreadComment) => boolean;
  canReport: boolean;
  onVote?: (commentId: string, vote: 1 | -1 | 0) => void | Promise<void>;
  onReply: (parentId: string | null, body: string) => void | Promise<void>;
  onEdit?: (commentId: string, body: string) => void | Promise<void>;
  onDelete?: (commentId: string) => void | Promise<void>;
  onReport?: (commentId: string) => void | Promise<void>;
  replyPlaceholder: string;
}) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allowEdit = canEdit?.(comment) ?? false;
  const allowDelete = canDelete?.(comment) ?? false;

  async function handleReplySubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setIsSubmitting(true);
    try {
      await onReply(comment.id, draft.trim());
      setDraft("");
      setIsReplying(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || !onEdit) return;
    setIsSubmitting(true);
    try {
      await onEdit(comment.id, draft.trim());
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    await onDelete(comment.id);
    setIsEditing(false);
    setIsReplying(false);
  }

  return (
    <div className={cn("space-y-3", depth > 0 && "ml-4 border-l border-border pl-4 sm:ml-6")}>
      <div className="flex gap-3">
        {onVote ? (
          <VoteButtons
            score={comment.score ?? 0}
            userVote={comment.user_vote}
            disabled={!canVote}
            onVote={(vote) => void onVote(comment.id, vote)}
          />
        ) : null}
        <div className="min-w-0 flex-1 rounded-lg bg-muted/30 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CommentAuthor
              authorId={comment.author_id}
              authorName={comment.author_name}
              authorAvatarUrl={comment.author_avatar_url}
              createdAt={comment.created_at}
              linkToProfile={linkAuthorToProfile}
            />
            <div className="flex shrink-0 gap-1">
              {canPost && !isEditing ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setIsReplying((prev) => !prev);
                    setDraft("");
                  }}
                >
                  <Reply className="mr-1 h-3 w-3" />
                  Reply
                </Button>
              ) : null}
              {allowEdit && !isEditing && onEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setDraft(comment.body);
                    setIsEditing(true);
                  }}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Edit
                </Button>
              ) : null}
              {allowDelete && onDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Delete
                </Button>
              ) : null}
              {canReport && onReport ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void onReport(comment.id)}
                >
                  <Flag className="mr-1 h-3 w-3" />
                  Report
                </Button>
              ) : null}
            </div>
          </div>

          {isEditing && onEdit ? (
            <form onSubmit={(event) => void handleEditSubmit(event)} className="mt-3 space-y-2">
              <CommentComposer value={draft} onChange={setDraft} minHeight={72} disabled={isSubmitting} />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isSubmitting || !draft.trim()}>
                  {isSubmitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  Save
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="prose prose-sm prose-neutral dark:prose-invert mt-3 max-w-none prose-p:leading-relaxed">
              <Markdown>{comment.body}</Markdown>
            </div>
          )}
        </div>
      </div>

      {isReplying ? (
        <form onSubmit={(event) => void handleReplySubmit(event)} className="ml-10 space-y-2">
          <CommentComposer
            value={draft}
            onChange={setDraft}
            minHeight={72}
            disabled={isSubmitting}
            placeholder={replyPlaceholder}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting || !draft.trim()}>
              {isSubmitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Post reply
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsReplying(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {comment.children.map((child) => (
        <CommentItem
          key={child.id}
          comment={child}
          depth={depth + 1}
          canPost={canPost}
          canVote={canVote}
          currentUserId={currentUserId}
          linkAuthorToProfile={linkAuthorToProfile}
          canEdit={canEdit}
          canDelete={canDelete}
          canReport={canReport}
          onVote={onVote}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onReport={onReport}
          replyPlaceholder={replyPlaceholder}
        />
      ))}
    </div>
  );
}

export function CommentThread({
  comments,
  canPost,
  canVote = canPost,
  currentUserId,
  linkAuthorToProfile = false,
  canEdit,
  canDelete,
  canReport = false,
  onVote,
  onReply,
  onEdit,
  onDelete,
  onReport,
  topLevelPlaceholder = "Add a comment…",
  replyPlaceholder = "Write a reply…",
  showTopLevelComposer = true,
  emptyMessage = null
}: CommentThreadProps) {
  const [topLevelDraft, setTopLevelDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tree = buildCommentTree(comments);

  async function handleTopLevelSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!topLevelDraft.trim()) return;
    setIsSubmitting(true);
    try {
      await onReply(null, topLevelDraft.trim());
      setTopLevelDraft("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {tree.length === 0 && emptyMessage ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        tree.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            depth={0}
            canPost={canPost}
            canVote={canVote}
            currentUserId={currentUserId}
            linkAuthorToProfile={linkAuthorToProfile}
            canEdit={canEdit}
            canDelete={canDelete}
            canReport={canReport}
            onVote={onVote}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onReport={onReport}
            replyPlaceholder={replyPlaceholder}
          />
        ))
      )}

      {canPost && showTopLevelComposer ? (
        <form onSubmit={(event) => void handleTopLevelSubmit(event)} className="space-y-2">
          <CommentComposer
            value={topLevelDraft}
            onChange={setTopLevelDraft}
            minHeight={88}
            disabled={isSubmitting}
            placeholder={topLevelPlaceholder}
          />
          <Button type="submit" size="sm" disabled={isSubmitting || !topLevelDraft.trim()}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Post
          </Button>
        </form>
      ) : null}
    </div>
  );
}
