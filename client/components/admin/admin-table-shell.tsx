"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type AdminTableShellProps = {
  title?: string;
  description?: string;
  toolbar?: ReactNode;
  columns: string[];
  columnClassNames?: (string | undefined)[];
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  skeletonRows?: number;
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
  children: ReactNode;
  mobileCards?: ReactNode;
  footer?: ReactNode;
};

export function AdminTableShell({
  title,
  description,
  toolbar,
  columns,
  columnClassNames,
  isLoading,
  isEmpty,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting your filters.",
  skeletonRows = 6,
  total,
  limit,
  offset,
  onPageChange,
  children,
  mobileCards,
  footer
}: AdminTableShellProps) {
  return (
    <Card className="overflow-hidden">
      {(title || description || toolbar) && (
        <CardHeader className="space-y-4 border-b bg-muted/20 pb-4">
          {(title || description) && (
            <div>
              {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
              {description ? <CardDescription>{description}</CardDescription> : null}
            </div>
          )}
          {toolbar}
        </CardHeader>
      )}
      <CardContent className="p-0">
        {mobileCards ? <div className="space-y-3 p-4 md:hidden">{mobileCards}</div> : null}
        <div className={cn("w-full overflow-x-auto", mobileCards && "hidden md:block")}>
          <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column, index) => (
                <TableHead key={column} className={columnClassNames?.[index]}>
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                  <TableRow key={`skeleton-${rowIndex}`}>
                    {columns.map((column) => (
                      <TableCell key={`${rowIndex}-${column}`}>
                        <Skeleton className="h-4 w-full max-w-[180px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : isEmpty
                ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={columns.length} className="h-32 text-center">
                        <div className="space-y-1">
                          <p className="font-medium">{emptyTitle}</p>
                          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                : children}
          </TableBody>
        </Table>
        </div>
      </CardContent>
      <div className={cn("flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3", footer && "pb-2")}>
        <p className="text-sm text-muted-foreground">
          {total === 0 ? "0 results" : `Showing ${Math.min(offset + 1, total)}–${Math.min(offset + limit, total)} of ${total}`}
        </p>
        <PaginationControls total={total} limit={limit} offset={offset} onPageChange={onPageChange} />
      </div>
      {footer ? <div className="border-t px-4 pb-4">{footer}</div> : null}
    </Card>
  );
}

export function AdminTableActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-center justify-end gap-1", className)}>{children}</div>;
}
