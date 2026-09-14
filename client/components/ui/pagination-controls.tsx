"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { currentPage, pageCount } from "@/lib/pagination";

type PaginationControlsProps = {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
  className?: string;
};

export function PaginationControls({
  total,
  limit,
  offset,
  onPageChange,
  className
}: PaginationControlsProps) {
  if (total <= limit) return null;

  const page = currentPage(offset, limit);
  const pages = pageCount(total, limit);
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + limit, total);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ""}`}>
      <p className="text-sm text-muted-foreground">
        Showing {showingFrom}–{showingTo} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={offset <= 0}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={offset + limit >= total}
          onClick={() => onPageChange(offset + limit)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

type PagePaginationControlsProps = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function PagePaginationControls({
  total,
  page,
  pageSize,
  onPageChange,
  className
}: PagePaginationControlsProps) {
  if (total <= pageSize) return null;

  const pages = pageCount(total, pageSize);
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ""}`}>
      <p className="text-sm text-muted-foreground">
        Showing {showingFrom}–{showingTo} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
