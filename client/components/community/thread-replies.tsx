"use client";

import { CommentThread, type ThreadComment } from "@/components/comments/comment-thread";
import {
  createContentReport,
  createThreadReply,
  deleteReply,
  updateReply,
  voteReply,
  type CommunityReply
} from "@/lib/community";
import { showError, showInfo, showSuccess } from "@/lib/toast";

type ThreadRepliesProps = {
  threadId: string;
  replies: CommunityReply[];
  token?: string | null;
  canPost: boolean;
  canModerate: boolean;
  currentUserId?: string | null;
  onRepliesChange: (replies: CommunityReply[]) => void;
};

function toThreadComments(replies: CommunityReply[]): ThreadComment[] {
  return replies
    .filter((reply): reply is CommunityReply & { author_id: string } => Boolean(reply.author_id))
    .map((reply) => ({
      id: reply.id,
      parent_id: reply.parent_id,
      body: reply.body,
      author_id: reply.author_id,
      author_name: reply.author_name ?? "Member",
      created_at: reply.created_at,
      score: reply.score,
      user_vote: reply.user_vote
    }));
}

export function ThreadReplies({
  threadId,
  replies,
  token,
  canPost,
  canModerate,
  currentUserId,
  onRepliesChange
}: ThreadRepliesProps) {
  const comments = toThreadComments(replies);

  return (
    <div className="border-t border-border pt-4">
      <CommentThread
        comments={comments}
        canPost={canPost}
        canVote={Boolean(token && canPost)}
        currentUserId={currentUserId}
        linkAuthorToProfile
        canReport={Boolean(token)}
        canEdit={(comment) =>
          Boolean(currentUserId && (comment.author_id === currentUserId || canModerate))
        }
        canDelete={(comment) =>
          Boolean(currentUserId && (comment.author_id === currentUserId || canModerate))
        }
        onVote={async (commentId, vote) => {
          if (!token) return;
          try {
            const updated = await voteReply(token, commentId, vote);
            onRepliesChange(replies.map((item) => (item.id === updated.id ? updated : item)));
          } catch (err) {
            showError(err, "Could not register vote.");
          }
        }}
        onReply={async (parentId, body) => {
          if (!token) return;
          try {
            const created = await createThreadReply(token, threadId, body, parentId ?? undefined);
            onRepliesChange([...replies, created]);
          } catch (err) {
            showError(err, "Failed to post reply.");
          }
        }}
        onEdit={async (commentId, body) => {
          if (!token) return;
          try {
            const updated = await updateReply(token, commentId, body);
            onRepliesChange(replies.map((item) => (item.id === updated.id ? updated : item)));
          } catch (err) {
            showError(err, "Failed to update reply.");
          }
        }}
        onDelete={async (commentId) => {
          if (!token) return;
          try {
            await deleteReply(token, commentId);
            onRepliesChange(
              replies.filter((item) => item.id !== commentId && item.parent_id !== commentId)
            );
            showSuccess("Reply deleted.");
          } catch (err) {
            showError(err, "Failed to delete reply.");
          }
        }}
        onReport={async (commentId) => {
          if (!token) return;
          try {
            await createContentReport(token, {
              target_type: "reply",
              target_id: commentId,
              reason: "Inappropriate content"
            });
            showInfo("Report submitted.");
          } catch (err) {
            showError(err, "Failed to submit report.");
          }
        }}
        topLevelPlaceholder="Add a reply…"
        replyPlaceholder="Write a reply…"
      />
    </div>
  );
}
