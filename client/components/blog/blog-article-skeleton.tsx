import {
  BlogArticleLayout
} from "@/components/blog/blog-ui";
import { Skeleton } from "@/components/ui/skeleton";

export function BlogArticleSkeleton() {
  return (
    <BlogArticleLayout>
      <Skeleton className="h-4 w-24" />
      <div className="mt-6 max-w-prose space-y-4">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="mt-10 max-w-prose space-y-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
        <Skeleton className="h-4 w-2/3" />
      </div>
    </BlogArticleLayout>
  );
}
