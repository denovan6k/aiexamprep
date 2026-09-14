"use client";

import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";

type PageLoaderProps = {
  className?: string;
  fullScreen?: boolean;
  size?: "sm" | "md" | "lg";
};

export function PageLoader({ className, fullScreen = false, size = "lg" }: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        fullScreen ? "h-dvh" : "min-h-[40vh] py-16",
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <Loader variant="classic" size={size} />
    </div>
  );
}
