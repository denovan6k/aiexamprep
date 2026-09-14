"use client";

import { Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BlogIndexSkeleton } from "@/components/blog/blog-post-list-skeleton";
import {
  BlogEmptyState,
  BlogFeaturedHero,
  BlogLayout,
  BlogMobileFilters,
  BlogPostCard,
  BlogSidebar,
  BlogTagChip
} from "@/components/blog/blog-ui";
import { SecondaryLink } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listBlogPosts, searchBlogPosts, type BlogPost } from "@/lib/blog";
import { asRoute } from "@/lib/utils";

export function BlogIndexClient({
  initialPosts,
  initialCategories
}: {
  initialPosts?: BlogPost[];
  initialCategories?: string[];
} = {}) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts ?? []);
  const [isLoading, setIsLoading] = useState(!initialPosts?.length);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BlogPost[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const loadPosts = useCallback(async (cancelledRef: { current: boolean }) => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedPosts = await listBlogPosts();
      if (cancelledRef.current) return;
      setPosts(loadedPosts);
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load blog posts");
        setPosts([]);
      }
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    void loadPosts(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadPosts]);

  const categories =
    initialCategories ??
    (Array.from(new Set(posts.map((post) => post.category).filter(Boolean))) as string[]);

  const allTags = useMemo(
    () => Array.from(new Set(posts.flatMap((post) => post.tags))).sort(),
    [posts]
  );

  const filteredPosts = useMemo(() => {
    let next = posts;
    if (activeCategory) {
      next = next.filter((post) => post.category === activeCategory);
    }
    if (activeTag) {
      next = next.filter((post) => post.tags.includes(activeTag));
    }
    return next;
  }, [posts, activeCategory, activeTag]);

  const featured = !activeCategory && !activeTag && !results ? filteredPosts[0] : null;
  const listPosts = featured ? filteredPosts.slice(1) : filteredPosts;

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setIsSearching(true);
    setActiveCategory(null);
    setActiveTag(null);
    try {
      setResults(await searchBlogPosts(query.trim()));
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function clearSearch() {
    setResults(null);
    setQuery("");
  }

  const sidebar = (
    <BlogSidebar
      categories={categories}
      tags={allTags}
      activeCategory={activeCategory}
      activeTag={activeTag}
      onCategoryChange={(cat) => {
        setResults(null);
        setActiveCategory(cat);
      }}
      onTagChange={(tag) => {
        setResults(null);
        setActiveTag(tag);
      }}
    />
  );

  return (
    <BlogLayout sidebar={sidebar}>
      <header className="pb-8">
        <p className="text-sm font-medium text-primary">Blog</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Study guides and product notes</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Exam strategy, AI workflows, study techniques, and product updates for serious preparation.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <SecondaryLink href="/community">Join the community</SecondaryLink>
          <SecondaryLink href="/faq">Read FAQ</SecondaryLink>
        </div>
      </header>

      <form onSubmit={(event) => void handleSearch(event)} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search articles..."
          className="h-11 pl-10 pr-24"
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-1">
          {query ? (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={clearSearch}>
              <X className="h-4 w-4" />
            </Button>
          ) : null}
          <Button type="submit" size="sm" variant="secondary" disabled={isSearching || isLoading}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>
      </form>

      {isLoading ? <BlogIndexSkeleton /> : null}

          {error ? (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-3 h-auto p-0 text-destructive"
            onClick={() => void loadPosts({ current: false })}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {!isLoading && results !== null ? (
        <div className="mt-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {results.length ? `${results.length} result${results.length === 1 ? "" : "s"}` : "No results"}
            </h2>
            <Button variant="ghost" size="sm" onClick={clearSearch}>
              Clear search
            </Button>
          </div>
          {results.length > 0 ? (
            <div className="space-y-4">
              {results.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <BlogEmptyState message="No articles matched your search. Try different keywords." />
          )}
        </div>
      ) : null}

      {!isLoading && results === null ? (
        <>
          <BlogMobileFilters
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          {activeTag ? (
            <div className="mt-4 flex items-center gap-2 lg:hidden">
              <span className="text-xs text-muted-foreground">Filtered by</span>
              <BlogTagChip tag={activeTag} active onClick={() => setActiveTag(null)} />
            </div>
          ) : null}

          {featured ? (
            <div className="mt-8">
              <BlogFeaturedHero post={featured} />
            </div>
          ) : null}

          <div className={featured ? "mt-10" : "mt-8"}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {activeCategory ?? activeTag ? "Filtered articles" : "Latest articles"}
              </h2>
              {(activeCategory || activeTag) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveCategory(null);
                    setActiveTag(null);
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>

            {listPosts.length > 0 ? (
              <div className="space-y-4">
                {listPosts.map((post) => (
                  <BlogPostCard key={post.id} post={post} />
                ))}
              </div>
            ) : posts.length === 0 && !error ? (
              <BlogEmptyState message="No published articles yet. Check back soon." />
            ) : (
              <BlogEmptyState message="No articles match the current filters." />
            )}
          </div>

          <div className="mt-10 lg:hidden">
            <BlogSidebar
              categories={[]}
              tags={allTags}
              activeTag={activeTag}
              onTagChange={setActiveTag}
            />
          </div>
        </>
      ) : null}

      <p className="mt-12 text-center text-sm text-muted-foreground">
        Discuss study tips with peers in the{" "}
        <Link href={asRoute("/community")} className="font-medium text-primary hover:underline">
          community
        </Link>
        .
      </p>
    </BlogLayout>
  );
}
