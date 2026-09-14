import type { Metadata } from "next";

import { BlogArticleClient } from "@/components/blog/blog-article-client";
import type { BlogPost } from "@/lib/blog";
import { serverApiRequest } from "@/lib/server-api";

type BlogArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await serverApiRequest<BlogPost>(`/blog/posts/${slug}`);
    return {
      title: post.seo_title ?? post.title,
      description: post.seo_description ?? post.excerpt ?? undefined
    };
  } catch {
    return { title: "Article not found" };
  }
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  return <BlogArticleClient slug={slug} />;
}
