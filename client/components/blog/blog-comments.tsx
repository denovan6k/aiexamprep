"use client";

import Link from "next/link";
import { Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";

import { CommentComposer } from "@/components/comments/comment-composer";
import { CommentThread } from "@/components/comments/comment-thread";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  useBlogCommentsQuery,
  useCreateBlogCommentMutation,
  useDeleteBlogCommentMutation,
  useVoteBlogCommentMutation
} from "@/hooks/use-blog";
import { authorInitials } from "@/lib/comment-markdown";
import { isSuperAdmin } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

export function BlogComments({ slug }: { slug: string }) {
  const { token, user } = useAuth();
  const { data: comments = [], isLoading } = useBlogCommentsQuery(slug);
  const createMutation = useCreateBlogCommentMutation();
  const deleteMutation = useDeleteBlogCommentMutation();
  const voteMutation = useVoteBlogCommentMutation();
  const [body, setBody] = useState("");

  function handleTopLevelSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    createMutation.mutate(
      { slug, body: body.trim() },
      {
        onSuccess: () => {
          setBody("");
          showSuccess("Comment posted.");
        },
        onError: (err) => showError(err, "Failed to post comment.")
      }
    );
  }

  return (
    <section id="comments">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">
          Comments
          <span className="ml-2 text-base font-normal text-muted-foreground">({comments.length})</span>
        </h2>
      </div>

      {user && token ? (
        <form onSubmit={handleTopLevelSubmit} className="mt-6 space-y-3">
          <div className="flex items-start gap-3">
            <Avatar className="mt-1 h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs font-medium">
                {authorInitials(user.full_name ?? user.email ?? "You")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-2">
              <CommentComposer
                value={body}
                onChange={setBody}
                placeholder="Add a comment…"
                disabled={createMutation.isPending}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={createMutation.isPending || !body.trim()}>
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Post
                </Button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          <Link href={asRoute("/sign-in")} className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to comment.
        </p>
      )}

      <div className="mt-8">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading comments…
          </div>
        ) : (
          <CommentThread
            comments={comments}
            canPost={Boolean(user && token)}
            canVote={Boolean(user && token)}
            currentUserId={user?.id}
            linkAuthorToProfile={false}
            showTopLevelComposer={false}
            emptyMessage={comments.length === 0 ? "No comments yet." : null}
            onVote={(commentId, vote) => {
              if (!token) return;
              voteMutation.mutate(
                { commentId, slug, vote },
                { onError: (err) => showError(err, "Failed to update vote.") }
              );
            }}
            onReply={(parentId, replyBody) => {
              if (!token) return Promise.resolve();
              return new Promise<void>((resolve, reject) => {
                createMutation.mutate(
                  { slug, body: replyBody, parentId: parentId ?? undefined },
                  {
                    onSuccess: () => {
                      showSuccess("Reply posted.");
                      resolve();
                    },
                    onError: (err) => {
                      showError(err, "Failed to post reply.");
                      reject(err);
                    }
                  }
                );
              });
            }}
            canDelete={(comment) =>
              Boolean(user && (user.id === comment.author_id || isSuperAdmin(user)))
            }
            onDelete={(commentId) => {
              deleteMutation.mutate(
                { commentId, slug },
                {
                  onSuccess: () => showSuccess("Comment deleted."),
                  onError: (err) => showError(err, "Failed to delete comment.")
                }
              );
            }}
          />
        )}
      </div>
    </section>
  );
}
