"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ListToolbarProps = {
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: () => void;
  searchPlaceholder?: string;
  isSearching?: boolean;
  children?: React.ReactNode;
};

export function ListToolbar({
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  searchPlaceholder = "Search...",
  isSearching = false,
  children
}: ListToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearchSubmit();
        }}
        className="flex min-w-0 w-full flex-1 basis-full gap-2 sm:min-w-[220px] sm:basis-auto"
      >
        <Input
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full max-w-none sm:max-w-md"
        />
        <Button type="submit" variant="outline" disabled={isSearching} className="shrink-0">
          <Search className="h-4 w-4" />
          <span className="hidden sm:ml-2 sm:inline">Search</span>
        </Button>
      </form>
      {children}
    </div>
  );
}
