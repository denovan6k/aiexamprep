"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Plus, Rocket, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BlogEditor } from "@/components/blog/blog-editor";
import { BlogPostListSkeleton } from "@/components/blog/blog-post-list-skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSuperAdmin } from "@/lib/api";
import {
  archiveBlogPost,
  deleteBlogPost,
  listAdminBlogPosts,
  publishBlogPost,
  unpublishBlogPost,
  type BlogPost
} from "@/lib/blog";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

export function BlogAdminPanel() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const loadPosts = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      setPosts(await listAdminBlogPosts(token));
    } catch {
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isSuperAdmin(user) && token) {
      void loadPosts();
    } else {
      setIsLoading(false);
    }
  }, [loadPosts, token, user]);

  if (!isSuperAdmin(user)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>Blog management is restricted to super admin users.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function runAction(
    postId: string,
    action: () => Promise<BlogPost | void>,
    successMessage: string
  ) {
    setBusyId(postId);
    try {
      await action();
      await loadPosts();
      showSuccess(successMessage);
    } catch (err) {
      showError(err, "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  function openEditor(post: BlogPost | null) {
    setEditingPost(post);
    setShowEditor(true);
  }

  useEffect(() => {
    if (!showEditor || !editingPost) return;
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showEditor, editingPost?.id]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Blog admin</h1>
          <p className="text-sm text-muted-foreground">Create, edit, and publish blog articles.</p>
        </div>
        <Button onClick={() => openEditor(null)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New post
        </Button>
      </div>

      {showEditor ? (
        <Card ref={editorRef}>
          <CardHeader>
            <CardTitle>{editingPost ? "Edit post" : "New post"}</CardTitle>
            <CardDescription>Markdown supported — images, code blocks, tables, and more.</CardDescription>
          </CardHeader>
          <CardContent>
            <BlogEditor
              post={editingPost}
              onSaved={(saved) => {
                setShowEditor(false);
                setEditingPost(null);
                void loadPosts();
                router.push(asRoute("/dashboard/blog"));
                if (!editingPost) {
                  setEditingPost(saved);
                }
              }}
            />
            <Button variant="ghost" className="mt-4" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">All posts</h2>
        {isLoading ? (
          <BlogPostListSkeleton />
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet. Create your first article.</p>
        ) : (
          posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditor(post)}
                      className="text-left font-medium transition-colors hover:text-primary"
                    >
                      {post.title}
                    </button>
                    <Badge variant="outline">{post.status ?? "draft"}</Badge>
                  </div>
                  <p className="mt-1 break-all text-sm text-muted-foreground sm:truncate">
                    /blog/{post.slug}
                    {post.published_at
                      ? ` · ${new Date(post.published_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {post.status === "published" ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={asRoute(`/blog/${post.slug}`)} target="_blank">
                        View
                      </Link>
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={() => openEditor(post)}>
                    Edit
                  </Button>
                  {post.status !== "published" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === post.id}
                      onClick={() =>
                        void runAction(post.id, () => publishBlogPost(token!, post.id), "Post published.")
                      }
                    >
                      {busyId === post.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Rocket className="mr-1 h-4 w-4" />
                      )}
                      Publish
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === post.id}
                      onClick={() =>
                        void runAction(post.id, () => unpublishBlogPost(token!, post.id), "Post unpublished.")
                      }
                    >
                      Unpublish
                    </Button>
                  )}
                  {post.status !== "archived" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === post.id}
                      onClick={() =>
                        void runAction(post.id, () => archiveBlogPost(token!, post.id), "Post archived.")
                      }
                    >
                      <Archive className="mr-1 h-4 w-4" />
                      Archive
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === post.id}
                    onClick={() =>
                      void runAction(post.id, () => deleteBlogPost(token!, post.id), "Post deleted.")
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
