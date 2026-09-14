"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Clock,
  Copy,
  MessageSquare,
  Tag
} from "lucide-react";
import { type ReactNode } from "react";

import { AuthorLink } from "@/components/community/reputation-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { BlogPost } from "@/lib/blog";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute, cn } from "@/lib/utils";

export function formatBlogDate(iso: string | null | undefined, style: "short" | "long" = "short") {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: style === "long" ? "long" : "short",
    day: "numeric"
  });
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatBlogDate(iso) ?? "";
}

export function BlogMetaRow({
  post,
  className,
  linkAuthor = true
}: {
  post: Pick<BlogPost, "author" | "author_id" | "published_at" | "reading_time_minutes" | "comment_count">;
  className?: string;
  linkAuthor?: boolean;
}) {
  const dateLabel = formatBlogDate(post.published_at, "long");
  const authorLabel = post.author ?? "Member";

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground", className)}>
      {post.author || post.author_id ? (
        <span className="inline-flex items-center gap-1.5">
          {linkAuthor ? (
            <AuthorLink authorId={post.author_id} authorName={post.author} />
          ) : (
            <span className="font-medium text-foreground">{authorLabel}</span>
          )}
        </span>
      ) : null}
      {dateLabel ? (
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" />
          {dateLabel}
        </span>
      ) : null}
      {post.reading_time_minutes ? (
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
          {post.reading_time_minutes} min read
        </span>
      ) : null}
      {post.comment_count ? (
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
          {post.comment_count} {post.comment_count === 1 ? "comment" : "comments"}
        </span>
      ) : null}
    </div>
  );
}

export function BlogTagChip({
  tag,
  active,
  onClick
}: {
  tag: string;
  active?: boolean;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
          active
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
        )}
      >
        <Tag className="h-3 w-3" />
        {tag}
      </button>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Tag className="h-3 w-3" />
      {tag}
    </Badge>
  );
}

export function BlogPostCard({
  post,
  variant = "list",
  className
}: {
  post: BlogPost;
  variant?: "list" | "compact";
  className?: string;
}) {
  const href = asRoute(`/blog/${post.slug}`);

  if (variant === "compact") {
    return (
      <Link
        href={href}
        className={cn(
          "group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/30",
          className
        )}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-primary/80">{post.category ?? "Article"}</p>
        <h3 className="mt-1 font-semibold leading-snug group-hover:text-primary">{post.title}</h3>
        {post.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {post.reading_time_minutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.reading_time_minutes} min
            </span>
          ) : null}
          {post.published_at ? <span>{timeAgo(post.published_at)}</span> : null}
        </div>
      </Link>
    );
  }

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30 sm:flex-row",
        className
      )}
    >
      {post.cover_image_url ? (
        <Link href={href} className="relative aspect-[16/9] shrink-0 sm:w-52 md:w-60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </Link>
      ) : (
        <Link
          href={href}
          className="flex aspect-[16/9] shrink-0 items-center justify-center bg-muted/40 sm:w-52 md:w-60 sm:aspect-auto"
        >
          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
        </Link>
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {post.category ? (
            <Badge variant="secondary" className="h-5 px-2 text-[10px] font-medium uppercase tracking-wide">
              {post.category}
            </Badge>
          ) : null}
          {post.published_at ? <span>{timeAgo(post.published_at)}</span> : null}
        </div>

        <Link href={href} className="mt-2 block">
          <h3 className="text-lg font-semibold leading-snug tracking-tight group-hover:text-primary">{post.title}</h3>
          {post.excerpt ? (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
          ) : null}
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <AuthorLink authorId={post.author_id} authorName={post.author} />
          {post.reading_time_minutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.reading_time_minutes} min
            </span>
          ) : null}
          {(post.comment_count ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {post.comment_count}
            </span>
          ) : null}
        </div>

        {post.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.slice(0, 3).map((tag) => (
              <BlogTagChip key={tag} tag={tag} />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function BlogFeaturedHero({ post }: { post: BlogPost }) {
  const href = asRoute(`/blog/${post.slug}`);

  return (
    <Link href={href} className="group block overflow-hidden rounded-2xl border border-border bg-muted/20 transition-colors hover:border-primary/30">
      <div className="grid lg:grid-cols-2">
        {post.cover_image_url ? (
          <div className="relative aspect-[16/9] lg:aspect-auto lg:min-h-[280px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover_image_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          </div>
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 lg:aspect-auto lg:min-h-[280px]">
            <BookOpen className="h-16 w-16 text-primary/20" />
          </div>
        )}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
          <Badge className="mb-4 w-fit">Featured</Badge>
          {post.category ? (
            <p className="text-xs font-medium uppercase tracking-wider text-primary/80">{post.category}</p>
          ) : null}
          <h2 className="mt-2 font-display text-2xl font-medium tracking-tight sm:text-3xl group-hover:text-primary">
            {post.title}
          </h2>
          {post.excerpt ? (
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">{post.excerpt}</p>
          ) : null}
          <BlogMetaRow post={post} className="mt-5" linkAuthor={false} />
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            Read article
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function BlogShareButton({ slug }: { slug: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/blog/${slug}`);
      showSuccess("Link copied.");
    } catch {
      showError("Could not copy link.");
    }
  }

  return (
    <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => void handleCopy()}>
      <Copy className="h-4 w-4" />
      Copy link
    </Button>
  );
}

export function BlogSidebar({
  categories,
  tags,
  activeCategory,
  activeTag,
  onCategoryChange,
  onTagChange,
  relatedPosts,
  shareSlug,
  authorPost
}: {
  categories: string[];
  tags: string[];
  activeCategory?: string | null;
  activeTag?: string | null;
  onCategoryChange?: (category: string | null) => void;
  onTagChange?: (tag: string | null) => void;
  relatedPosts?: BlogPost[];
  shareSlug?: string;
  authorPost?: BlogPost | null;
}) {
  return (
    <aside className="space-y-6">
      {shareSlug ? <BlogShareButton slug={shareSlug} /> : null}

      {authorPost?.author_id || authorPost?.author ? (
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Author</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-base font-semibold text-foreground">{authorPost.author}</p>
          </CardContent>
        </Card>
      ) : null}

      {categories.length > 0 && onCategoryChange ? (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Categories</p>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => onCategoryChange(null)}
              className={cn(
                "rounded-md px-3 py-2 text-left text-sm transition-colors",
                !activeCategory ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              All articles
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm transition-colors",
                  activeCategory === cat
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) =>
              onTagChange ? (
                <BlogTagChip
                  key={tag}
                  tag={tag}
                  active={activeTag === tag}
                  onClick={() => onTagChange(activeTag === tag ? null : tag)}
                />
              ) : (
                <BlogTagChip key={tag} tag={tag} />
              )
            )}
          </div>
        </div>
      ) : null}

      {relatedPosts && relatedPosts.length > 0 ? (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Related</p>
          <div className="space-y-2">
            {relatedPosts.map((post) => (
              <BlogPostCard key={post.id} post={post} variant="compact" />
            ))}
          </div>
        </div>
      ) : null}

    </aside>
  );
}

export function BlogLayout({
  sidebar,
  children,
  className
}: {
  sidebar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8", className)}>
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[240px_minmax(0,1fr)]">
        {sidebar ? (
          <div className="hidden lg:block">
            <div className="sticky top-24">{sidebar}</div>
          </div>
        ) : null}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function BlogArticleLayout({
  sidebar,
  children
}: {
  sidebar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12 xl:gap-16">
        <div className="min-w-0">{children}</div>
        {sidebar ? (
          <div className="hidden lg:block">
            <div className="sticky top-24">{sidebar}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function BlogMobileFilters({
  categories,
  activeCategory,
  onCategoryChange
}: {
  categories: string[];
  activeCategory?: string | null;
  onCategoryChange: (category: string | null) => void;
}) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:hidden">
      <button
        type="button"
        onClick={() => onCategoryChange(null)}
        className={cn(
          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          !activeCategory ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onCategoryChange(cat)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            activeCategory === cat ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

export function BlogEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground/40" />
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function BlogSectionDivider() {
  return <Separator className="my-10" />;
}
