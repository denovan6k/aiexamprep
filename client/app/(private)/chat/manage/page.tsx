"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  FolderInput,
  FolderMinus,
  MessageSquare,
  Pin,
  PinOff,
  Search,
  Trash2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SystemMessage } from "@/components/ui/system-message";
import {
  useBulkThreadActionMutation,
  useChatProjectsQuery,
  useChatThreadsQuery
} from "@/hooks/use-chat";
import { sanitizeThreadTitle, type ChatProject } from "@/lib/chat";
import { showError, showSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "unassigned" | "in_project" | "archived";

export default function ChatManagePage() {
  const router = useRouter();
  const { data: threads = [], isLoading: threadsLoading } = useChatThreadsQuery({
    includeArchived: true
  });
  const { data: projects = [] } = useChatProjectsQuery({ includeArchived: true });
  const bulkMutation = useBulkThreadActionMutation();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const projectMap = useMemo(() => {
    const map = new Map<string, ChatProject>();
    for (const p of projects) {
      map.set(p.id, p);
    }
    return map;
  }, [projects]);

  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      // Tab filter
      if (activeTab === "unassigned" && (thread.archived || thread.project_id)) return false;
      if (activeTab === "in_project" && (thread.archived || !thread.project_id)) return false;
      if (activeTab === "archived" && !thread.archived) return false;
      if (activeTab === "all" && thread.archived) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = thread.title.toLowerCase().includes(q);
        const projectMatch = thread.project_id
          ? projectMap.get(thread.project_id)?.name.toLowerCase().includes(q)
          : false;
        if (!titleMatch && !projectMatch) return false;
      }

      return true;
    });
  }, [threads, activeTab, searchQuery, projectMap]);

  const allSelected =
    filteredThreads.length > 0 && filteredThreads.every((t) => selectedIds.has(t.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredThreads.map((t) => t.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkAction(
    action: "archive" | "unarchive" | "delete" | "pin" | "unpin" | "move_to_project" | "remove_from_project",
    projectId?: string | null
  ) {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    bulkMutation.mutate(
      { thread_ids: ids, action, project_id: projectId },
      {
        onSuccess: (res) => {
          showSuccess(`${res.updated} chat${res.updated !== 1 ? "s" : ""} updated.`);
          setSelectedIds(new Set());
        },
        onError: (err) => showError(err, "Bulk action failed.")
      }
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Manage Chats</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Organize, move, archive, or delete your conversation threads in bulk.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/projects">
            <Button variant="outline" size="sm">
              <FolderInput className="mr-2 h-4 w-4" />
              View Projects
            </Button>
          </Link>
          <Link href="/chat">
            <Button size="sm">
              <MessageSquare className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search chats or project names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              activeTab === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("unassigned")}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              activeTab === "unassigned" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Unassigned
          </button>
          <button
            onClick={() => setActiveTab("in_project")}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              activeTab === "in_project" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            In Project
          </button>
          <button
            onClick={() => setActiveTab("archived")}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              activeTab === "archived" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Toolbar: select-all + bulk actions on the same row, always above the list */}
      <div className="flex min-h-[40px] items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
        {/* Select-all checkbox */}
        <div className="flex shrink-0 items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all threads"
          />
          <span className="text-xs font-medium text-muted-foreground">
            {selectedIds.size > 0
              ? `${selectedIds.size} / ${filteredThreads.length}`
              : "Select all"}
          </span>
        </div>

        {/* Divider — only shown when actions are visible */}
        {selectedIds.size > 0 && (
          <div className="h-4 w-px shrink-0 bg-border" />
        )}

        {/* Bulk actions — same row, scroll on tiny screens */}
        {selectedIds.size > 0 && (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 text-xs"
              onClick={() => handleBulkAction("pin")}
            >
              <Pin className="mr-1 h-3 w-3" /> Pin
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 text-xs"
              onClick={() => handleBulkAction("unpin")}
            >
              <PinOff className="mr-1 h-3 w-3" /> Unpin
            </Button>

            {activeTab === "archived" ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 text-xs"
                onClick={() => handleBulkAction("unarchive")}
              >
                <ArchiveRestore className="mr-1 h-3 w-3" /> Unarchive
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 text-xs"
                onClick={() => handleBulkAction("archive")}
              >
                <Archive className="mr-1 h-3 w-3" /> Archive
              </Button>
            )}

            {projects.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs">
                    <FolderInput className="mr-1 h-3 w-3" /> Move
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuItem onClick={() => handleBulkAction("remove_from_project")}>
                    <FolderMinus className="mr-2 h-4 w-4 text-muted-foreground" />
                    Remove from project
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {projects.map((p) => (
                    <DropdownMenuItem key={p.id} onClick={() => handleBulkAction("move_to_project", p.id)}>
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleBulkAction("delete")}
            >
              <Trash2 className="mr-1 h-3 w-3" /> Delete
            </Button>
          </div>
        )}

        {/* Deselect shortcut */}
        {selectedIds.size > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6 shrink-0 text-muted-foreground"
            onClick={() => setSelectedIds(new Set())}
            title="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* List */}
      {threadsLoading ? (
        <div className="space-y-2 py-8 text-center text-sm text-muted-foreground">
          Loading chats...
        </div>
      ) : filteredThreads.length === 0 ? (
        <SystemMessage variant="action" fill className="py-12">
          No chats match your criteria.
        </SystemMessage>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {filteredThreads.map((thread) => {
            const isSelected = selectedIds.has(thread.id);
            const project = thread.project_id ? projectMap.get(thread.project_id) : null;
            const title = sanitizeThreadTitle(thread.title, 100);

            return (
              <div
                key={thread.id}
                onClick={() => toggleSelect(thread.id)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/50",
                  isSelected && "bg-primary/5"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(thread.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/chat/${thread.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium hover:underline truncate"
                      >
                        {title}
                      </Link>
                      {thread.pinned && (
                        <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                      {thread.archived && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Archived
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Updated {new Date(thread.updated_at).toLocaleDateString()}</span>
                      {project && (
                        <>
                          <span>•</span>
                          <Link
                            href={`/projects/${project.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground hover:underline"
                          >
                            <FolderInput className="h-3 w-3" />
                            {project.name}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/chat/${thread.id}`}>
                    <Button variant="ghost" size="sm" className="h-8">
                      Open
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
