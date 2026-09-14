"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BlogArticleSkeleton } from "@/components/blog/blog-article-skeleton";

import { BlogComments } from "@/components/blog/blog-comments";
import {
  BlogArticleLayout,
  BlogMetaRow,
  BlogSectionDivider,
  BlogSidebar,
  BlogTagChip
} from "@/components/blog/blog-ui";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBlogPostQuery, useRelatedBlogPostsQuery } from "@/hooks/use-blog";
import { asRoute } from "@/lib/utils";

export function BlogArticleClient({ slug }: { slug: string }) {
  const { data: post, isLoading, error, refetch } = useBlogPostQuery(slug);
  const { data: related = [] } = useRelatedBlogPostsQuery(slug);

  if (isLoading) {
    return <BlogArticleSkeleton />;
  }

  if (error || !post?.content) {
    return (
      <BlogArticleLayout>
        <Link
          href={asRoute("/blog")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to blog
        </Link>
        <h1 className="mt-8 text-2xl font-semibold">Article not found</h1>
        <p className="mt-2 text-muted-foreground">{error?.message ?? "This article could not be loaded."}</p>
        <Button variant="outline" className="mt-6" onClick={() => void refetch()}>
          Try again
        </Button>
      </BlogArticleLayout>
    );
  }

  const sidebar = (
    <BlogSidebar
      categories={[]}
      tags={post.tags}
      shareSlug={slug}
      authorPost={post}
      relatedPosts={related}
    />
  );

  return (
    <BlogArticleLayout sidebar={sidebar}>
      <Link
        href={asRoute("/blog")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to blog
      </Link>

      <header className="mt-6 max-w-prose">
        {post.category ? (
          <Badge variant="secondary" className="mb-4 text-xs font-medium">
            {post.category}
          </Badge>
        ) : null}
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{post.title}</h1>
        {post.excerpt ? (
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{post.excerpt}</p>
        ) : null}
        <BlogMetaRow post={post} className="mt-6" />
      </header>

      {post.cover_image_url ? (
        <figure className="mt-8 max-w-prose">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full rounded-xl border border-border object-cover"
          />
        </figure>
      ) : null}

      {post.tags.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2 max-w-prose lg:hidden">
          {post.tags.map((tag) => (
            <BlogTagChip key={tag} tag={tag} />
          ))}
        </div>
      ) : null}

      <article className="prose prose-neutral dark:prose-invert prose-lg mt-10 max-w-prose prose-headings:font-display prose-headings:font-medium prose-p:leading-[1.75] prose-a:text-primary prose-img:rounded-lg prose-pre:border prose-pre:border-border">
        <Markdown>{post.content}</Markdown>
      </article>

      <BlogSectionDivider />

      <div className="max-w-prose">
        <BlogComments slug={slug} />
      </div>

      {related.length > 0 ? (
        <div className="mt-12 max-w-prose lg:hidden">
          <h2 className="text-lg font-semibold">Related articles</h2>
          <div className="mt-4 space-y-2">
            {related.map((item) => (
              <Link
                key={item.id}
                href={asRoute(`/blog/${item.slug}`)}
                className="block rounded-lg border border-border p-4 transition-colors hover:border-primary/30 hover:bg-accent/30"
              >
                <p className="font-medium hover:text-primary">{item.title}</p>
                {item.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.excerpt}</p> : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

    </BlogArticleLayout>
  );
}
