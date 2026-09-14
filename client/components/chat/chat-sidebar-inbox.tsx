"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Check,
  CheckSquare,
  ChevronRight,
  FolderInput,
  FolderMinus,
  FolderPlus,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  SlidersHorizontal,
  Square,
  Star,
  Trash2,
  Workflow,
  X
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SystemMessage } from "@/components/ui/system-message";
import {
  useBulkThreadActionMutation,
  useChatProjectsQuery,
  useChatThreadsQuery,
  useCreateProjectMutation,
  useCreateThreadMutation,
  useDeleteProjectMutation,
  useDeleteThreadMutation,
  useUpdateProjectMutation,
  useUpdateThreadMutation
} from "@/hooks/use-chat";
import {
  groupThreadsByProject,
  groupThreadsByTimePeriod,
  sanitizeThreadTitle,
  visibleChatThreads,
  type ChatProject,
  type ChatThread
} from "@/lib/chat";
import { showError, showSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types & Shared Props
// ---------------------------------------------------------------------------

type ChatInboxScrollSectionsProps = {
  onNavigate?: () => void;
};

type CommonRowProps = {
  activeThreadId?: string | null;
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onEnterSelectMode: (initialId?: string) => void;
  onSelectThread: (threadId: string) => void;
  onNavigate?: () => void;
  onPinThread: (threadId: string, pinned: boolean) => void;
  onArchiveThread: (threadId: string, archived: boolean) => void;
  onDeleteThread: (threadId: string) => void;
  onRenameThread: (threadId: string, newTitle: string) => void;
  onMoveToProject: (threadId: string, projectId: string | null) => void;
  showPinState?: boolean;
  projects: ChatProject[];
};

// ---------------------------------------------------------------------------
// ClaudeThreadRow Component
// ---------------------------------------------------------------------------

function ClaudeThreadRow({
  chat,
  activeThreadId,
  onSelectThread,
  onNavigate,
  onPinThread,
  onArchiveThread,
  onDeleteThread,
  onRenameThread,
  onMoveToProject,
  showPinState = false,
  projects = [],
  selectMode = false,
  selected = false,
  onToggleSelect,
  onEnterSelectMode,
  isProjectChild = false
}: {
  chat: ChatThread;
  selected?: boolean;
  isProjectChild?: boolean;
} & CommonRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayTitle = sanitizeThreadTitle(chat.title, 255, chat.title);
  const isActive = !selectMode && activeThreadId === chat.id;

  useEffect(() => {
    if (isEditing) {
      setEditTitle(displayTitle);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isEditing, displayTitle]);

  function handleSaveRename() {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== displayTitle) {
      onRenameThread(chat.id, trimmed);
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveRename();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  }

  function handleRowClick(e: React.MouseEvent) {
    if (isEditing || confirmDelete) return;
    if (selectMode) {
      e.preventDefault();
      onToggleSelect(chat.id);
    } else {
      onSelectThread(chat.id);
      onNavigate?.();
    }
  }

  // Lightweight inline delete confirmation row
  if (confirmDelete) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive animate-in fade-in-0 duration-150 my-0.5">
        <span className="truncate font-medium">Delete chat?</span>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/20"
            onClick={() => {
              setConfirmDelete(false);
              onDeleteThread(chat.id);
            }}
          >
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[11px] text-muted-foreground hover:bg-background"
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Inline rename row
  if (isEditing) {
    return (
      <div className="flex items-center gap-1 px-1 py-0.5 my-0.5">
        <Input
          ref={inputRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSaveRename}
          className="h-6 text-xs px-2 bg-background font-medium focus-visible:ring-1 focus-visible:ring-primary"
        />
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-primary" onClick={handleSaveRename}>
          <Check className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={() => setIsEditing(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-thread-id={chat.id}
          onClick={handleRowClick}
          className={cn(
            "group relative flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors duration-150 select-none",
            isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
            !isActive && "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            selectMode && selected && "bg-primary/10 text-foreground font-medium ring-1 ring-primary/30"
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {selectMode ? (
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect(chat.id)}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
                aria-label={`Select ${displayTitle}`}
              />
            ) : isProjectChild ? (
              <span className="h-1.5 w-1.5 rounded-full border border-muted-foreground/60 shrink-0 ml-0.5" />
            ) : showPinState && chat.pinned ? (
              <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}

            <span className="truncate">{displayTitle}</span>
          </div>

          {/* Trailing Actions — hidden at rest, revealed on hover */}
          {!selectMode && (
            <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-background/80"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Options for ${displayTitle}`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Rename
                  </DropdownMenuItem>

                  {!chat.archived && (
                    <DropdownMenuItem onClick={() => onPinThread(chat.id, !chat.pinned)}>
                      {chat.pinned ? (
                        <>
                          <PinOff className="mr-2 h-3.5 w-3.5" />
                          Unpin
                        </>
                      ) : (
                        <>
                          <Pin className="mr-2 h-3.5 w-3.5" />
                          Pin
                        </>
                      )}
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem onClick={() => onArchiveThread(chat.id, !chat.archived)}>
                    {chat.archived ? (
                      <>
                        <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
                        Unarchive
                      </>
                    ) : (
                      <>
                        <Archive className="mr-2 h-3.5 w-3.5" />
                        Archive
                      </>
                    )}
                  </DropdownMenuItem>

                  {projects.length > 0 && !chat.archived && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <FolderInput className="mr-2 h-3.5 w-3.5" />
                          Move to project
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                          {chat.project_id && (
                            <DropdownMenuItem onClick={() => onMoveToProject(chat.id, null)}>
                              <FolderMinus className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                              Remove from project
                            </DropdownMenuItem>
                          )}
                          {projects.map((p) => (
                            <DropdownMenuItem
                              key={p.id}
                              disabled={chat.project_id === p.id}
                              onClick={() => onMoveToProject(chat.id, p.id)}
                            >
                              <span className="truncate">{p.name}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onEnterSelectMode(chat.id)}>
                    <CheckSquare className="mr-2 h-3.5 w-3.5" />
                    Select
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </ContextMenuTrigger>

      {/* Context Menu (Right Click) */}
      <ContextMenuContent className="w-44">
        {!selectMode && (
          <ContextMenuItem onSelect={() => onEnterSelectMode(chat.id)}>
            <CheckSquare className="mr-2 h-3.5 w-3.5" />
            Select
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={() => setIsEditing(true)}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Rename
        </ContextMenuItem>
        <ContextMenuSeparator />

        {!chat.archived && (
          <ContextMenuItem onSelect={() => onPinThread(chat.id, !chat.pinned)}>
            {chat.pinned ? (
              <>
                <PinOff className="mr-2 h-3.5 w-3.5" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="mr-2 h-3.5 w-3.5" />
                Pin
              </>
            )}
          </ContextMenuItem>
        )}

        <ContextMenuItem onSelect={() => onArchiveThread(chat.id, !chat.archived)}>
          {chat.archived ? (
            <>
              <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
              Unarchive
            </>
          ) : (
            <>
              <Archive className="mr-2 h-3.5 w-3.5" />
              Archive
            </>
          )}
        </ContextMenuItem>

        {projects.length > 0 && !chat.archived && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <FolderInput className="mr-2 h-3.5 w-3.5" />
                Move to project
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                {chat.project_id && (
                  <ContextMenuItem onSelect={() => onMoveToProject(chat.id, null)}>
                    <FolderMinus className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    Remove from project
                  </ContextMenuItem>
                )}
                {projects.map((p) => (
                  <ContextMenuItem
                    key={p.id}
                    disabled={chat.project_id === p.id}
                    onSelect={() => onMoveToProject(chat.id, p.id)}
                  >
                    <span className="truncate">{p.name}</span>
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}

        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => setConfirmDelete(true)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ---------------------------------------------------------------------------
// Section Header Component
// ---------------------------------------------------------------------------

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="mt-4 mb-1 px-2 flex items-center justify-between text-[11px] font-medium tracking-wider uppercase text-muted-foreground/70 select-none">
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] font-normal lowercase text-muted-foreground/50">{count}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClaudeProjectGroup Component
// ---------------------------------------------------------------------------

function ClaudeProjectGroup({
  project,
  threads,
  onCreateChatInProject,
  onUnpinProject,
  onArchiveProject,
  onDeleteProject,
  onRenameProject,
  ...rowProps
}: {
  project: ChatProject;
  threads: ChatThread[];
  onCreateChatInProject: (projectId: string) => void;
  onUnpinProject: (project: ChatProject) => void;
  onArchiveProject: (project: ChatProject) => void;
  onDeleteProject: (project: ChatProject) => void;
  onRenameProject: (project: ChatProject, newName: string) => void;
} & CommonRowProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);

  function handleSaveProjectRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== project.name) {
      onRenameProject(project, trimmed);
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveProjectRename();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 px-1 py-1 my-0.5">
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSaveProjectRename}
          className="h-6 text-xs px-2 bg-background font-medium focus-visible:ring-1 focus-visible:ring-primary"
          autoFocus
        />
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-primary" onClick={handleSaveProjectRename}>
          <Check className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={() => setIsEditing(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Collapsible defaultOpen className="group/project mb-1">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex items-center justify-between rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-sidebar-accent/50 transition-colors group/hdr select-none">
            <CollapsibleTrigger className="flex items-center gap-2 min-w-0 flex-1">
              <Workflow className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-semibold text-foreground/90">{project.name}</span>
              {/* Dropdown Chevron: Hidden by default, shown ONLY on hover */}
              <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60 opacity-0 group-hover/hdr:opacity-100 transition-opacity transition-transform group-data-[state=open]/project:rotate-90" />
            </CollapsibleTrigger>

            {!rowProps.selectMode && (
              <div className="flex items-center opacity-0 group-hover/hdr:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateChatInProject(project.id);
                  }}
                  title="New chat in project"
                >
                  <Plus className="h-3 w-3" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => onUnpinProject(project)}>
                      <PinOff className="mr-2 h-3.5 w-3.5" />
                      Unpin from sidebar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onCreateChatInProject(project.id)}>
                      <MessageSquarePlus className="mr-2 h-3.5 w-3.5" />
                      New chat in project
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onArchiveProject(project)}>
                      <Archive className="mr-2 h-3.5 w-3.5" />
                      Archive project
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDeleteProject(project)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={() => onUnpinProject(project)}>
            <PinOff className="mr-2 h-3.5 w-3.5" />
            Unpin from sidebar
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit details
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onCreateChatInProject(project.id)}>
            <MessageSquarePlus className="mr-2 h-3.5 w-3.5" />
            New chat in project
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onArchiveProject(project)}>
            <Archive className="mr-2 h-3.5 w-3.5" />
            Archive project
          </ContextMenuItem>
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => onDeleteProject(project)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete project
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="ml-3.5 border-l border-border/40 pl-2.5 space-y-0.5 pt-0.5">
          {threads.length === 0 ? (
            <div className="flex items-center justify-between py-1 text-[11px] text-muted-foreground/60">
              <span>No chats</span>
              {!rowProps.selectMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 px-1 text-[10px] text-primary hover:underline"
                  onClick={() => onCreateChatInProject(project.id)}
                >
                  + Add
                </Button>
              )}
            </div>
          ) : (
            threads.map((chat) => (
              <ClaudeThreadRow
                key={chat.id}
                chat={chat}
                isProjectChild
                selected={rowProps.selectedIds.has(chat.id)}
                {...rowProps}
              />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// BulkActionBar — Sticky bar shown when selection > 0
// ---------------------------------------------------------------------------

function BulkActionBar({
  count,
  onArchive,
  onDelete,
  onPin,
  onMoveToProject,
  onClear,
  projects
}: {
  count: number;
  onArchive: () => void;
  onDelete: () => void;
  onPin: () => void;
  onMoveToProject: (projectId: string | null) => void;
  onClear: () => void;
  projects: ChatProject[];
}) {
  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-between gap-1 border-t border-border/60 bg-sidebar/95 backdrop-blur px-2 py-1.5 text-xs shadow-md animate-in slide-in-from-bottom-2">
      <span className="shrink-0 font-medium text-muted-foreground">{count} selected</span>
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onPin}>
          <Pin className="mr-1 h-3 w-3" />
          Pin
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onArchive}>
          <Archive className="mr-1 h-3 w-3" />
          Archive
        </Button>
        {projects.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                <FolderInput className="mr-1 h-3 w-3" />
                Move
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onMoveToProject(null)}>
                <FolderMinus className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                Remove from project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {projects.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => onMoveToProject(p.id)}>
                  <span className="truncate">{p.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Delete
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear} aria-label="Clear selection">
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatInboxScrollSections — Main export matching Claude.ai sidebar layout
// ---------------------------------------------------------------------------

export function ChatInboxScrollSections({ onNavigate }: ChatInboxScrollSectionsProps) {
  const pathname = usePathname();
  const router = useRouter();

  const { data: threads = [], isLoading: threadsLoading } = useChatThreadsQuery({
    includeArchived: true
  });
  const { data: projects = [] } = useChatProjectsQuery({ includeArchived: false });

  const updateThreadMutation = useUpdateThreadMutation();
  const deleteThreadMutation = useDeleteThreadMutation();
  const createThreadMutation = useCreateThreadMutation();
  const bulkMutation = useBulkThreadActionMutation();

  const createProjectMutation = useCreateProjectMutation();
  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Grouping & Sorting State (defaults to Date grouping and Last Activity sort, matching Claude)
  const [groupBy, setGroupBy] = useState<"date" | "project" | "none">("date");
  const [sortBy, setSortBy] = useState<"updated" | "title">("updated");

  // Create Project Dialog State
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const listRef = useRef<HTMLDivElement>(null);
  const activeThreadId =
    pathname.startsWith("/chat/")
      ? pathname.replace("/chat/", "").split("/")[0]
      : null;

  const visible = visibleChatThreads(threads);
  const { projectGroups, pinned, unpinned, archived } = useMemo(
    () =>
      groupThreadsByProject(
        visible as (ChatThread & { project_id?: string | null })[],
        projects
      ),
    [visible, projects]
  );

  // Sorted unassigned threads
  const sortedUnpinned = useMemo(() => {
    const list = [...unpinned];
    if (sortBy === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return list;
  }, [unpinned, sortBy]);

  // Time period grouping for sorted unassigned chats
  const { today, yesterday, previous7Days, older } = useMemo(
    () => groupThreadsByTimePeriod(sortedUnpinned),
    [sortedUnpinned]
  );

  // All selectable threads currently visible
  const allSelectableThreadIds = useMemo(() => {
    const ids: string[] = [];
    for (const group of projectGroups) {
      for (const t of group.threads) ids.push(t.id);
    }
    for (const t of pinned) ids.push(t.id);
    for (const t of unpinned) ids.push(t.id);
    for (const t of archived) ids.push(t.id);
    return ids;
  }, [projectGroups, pinned, unpinned, archived]);

  const isAllSelected =
    allSelectableThreadIds.length > 0 &&
    allSelectableThreadIds.every((id) => selectedIds.has(id));

  const hasThreads =
    projectGroups.some((g) => g.threads.length > 0) ||
    pinned.length > 0 ||
    unpinned.length > 0 ||
    archived.length > 0;

  useEffect(() => {
    if (!activeThreadId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-thread-id="${activeThreadId}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeThreadId, threads]);

  useEffect(() => {
    if (!pathname.startsWith("/chat")) {
      setSelectMode(false);
      setSelectedIds(new Set());
    }
  }, [pathname]);

  const onToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onEnterSelectMode = useCallback((initialId?: string) => {
    setSelectMode(true);
    if (initialId) {
      setSelectedIds(new Set([initialId]));
    }
  }, []);

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allSelectableThreadIds));
    }
  }

  function handleCreateProject() {
    if (!newProjectName.trim()) return;
    createProjectMutation.mutate(
      { name: newProjectName.trim() },
      {
        onSuccess: (p) => {
          showSuccess(`Project "${p.name}" created and pinned to sidebar.`);
          setCreateProjectOpen(false);
          setNewProjectName("");
        },
        onError: (err) => showError(err, "Failed to create project.")
      }
    );
  }

  function handleCreateChatInProject(projectId: string) {
    const proj = projects.find((p) => p.id === projectId);
    createThreadMutation.mutate(
      { title: `Chat in ${proj?.name || "project"}`, project_id: projectId },
      {
        onSuccess: (newThread) => {
          onNavigate?.();
          router.push(`/chat/${newThread.id}`);
        },
        onError: (err) => showError(err, "Failed to create chat.")
      }
    );
  }

  function handleBulk(
    action: "archive" | "delete" | "pin" | "move_to_project" | "remove_from_project",
    projectId?: string | null
  ) {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    bulkMutation.mutate(
      { thread_ids: ids, action, project_id: projectId },
      {
        onSuccess: (result) => {
          showSuccess(`${result.updated} chat${result.updated !== 1 ? "s" : ""} updated.`);
          setSelectedIds(new Set());
          setSelectMode(false);
        },
        onError: (err) => showError(err, "Bulk action failed.")
      }
    );
  }

  const commonProps: CommonRowProps = {
    activeThreadId,
    selectMode,
    selectedIds,
    onToggleSelect,
    onEnterSelectMode,
    onSelectThread: (id) => router.push(`/chat/${id}`),
    onNavigate,
    onPinThread: (threadId, pinned) => {
      updateThreadMutation.mutate(
        { threadId, input: { pinned } },
        {
          onSuccess: () => showSuccess(pinned ? "Thread pinned." : "Thread unpinned."),
          onError: (err) => showError(err, "Failed to update thread.")
        }
      );
    },
    onArchiveThread: (threadId, archived) => {
      updateThreadMutation.mutate(
        { threadId, input: { archived } },
        {
          onSuccess: () => showSuccess(archived ? "Thread archived." : "Thread restored."),
          onError: (err) => showError(err, "Failed to update thread.")
        }
      );
    },
    onDeleteThread: (threadId) => {
      deleteThreadMutation.mutate(threadId, {
        onSuccess: () => showSuccess("Thread deleted."),
        onError: (err) => showError(err, "Failed to delete thread.")
      });
    },
    onRenameThread: (threadId, newTitle) => {
      updateThreadMutation.mutate(
        { threadId, input: { title: newTitle } },
        {
          onSuccess: () => showSuccess("Thread renamed."),
          onError: (err) => showError(err, "Failed to rename thread.")
        }
      );
    },
    onMoveToProject: (threadId, projectId) => {
      updateThreadMutation.mutate(
        { threadId, input: { project_id: projectId } },
        {
          onSuccess: () => showSuccess(projectId ? "Moved to project." : "Removed from project."),
          onError: (err) => showError(err, "Failed to move thread.")
        }
      );
    },
    projects
  };

  return (
    <div className="flex flex-col">
      {/* Select Mode Bar (Shown only when selection mode is active) */}
      {selectMode && (
        <div className="flex items-center justify-between gap-1 px-2 pb-1 pt-1 border-b border-border/40 mb-1">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex h-6 flex-1 items-center gap-1.5 rounded px-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          >
            {isAllSelected ? (
              <CheckSquare className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            <span>{isAllSelected ? "Deselect all" : `Select all (${allSelectableThreadIds.length})`}</span>
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={exitSelectMode}
          >
            Done
          </Button>
        </div>
      )}

      {/* Main Independent Scroll Container */}
      <div ref={listRef} className="scrollbar-hover min-h-0 flex-1 space-y-1 overflow-y-auto px-1.5 pb-2">
        {threadsLoading ? (
          <div className="space-y-2 py-4 px-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 rounded-md bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : !hasThreads ? (
          <SystemMessage variant="action" fill className="mx-1 my-2 text-xs">
            No chats yet.
          </SystemMessage>
        ) : (
          <>
            {/* PROJECTS SECTION */}
            <div className="mt-2 mb-1 px-2 flex items-center justify-between text-[11px] font-medium tracking-wider uppercase text-muted-foreground/70 select-none">
              <span>Projects</span>
              {/* Icon-only + button (No text) */}
              {!selectMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground/70 hover:text-foreground"
                  onClick={() => setCreateProjectOpen(true)}
                  title="New project"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Pinned Projects List or Empty State ("Pin a project") */}
            {projectGroups.length > 0 ? (
              <div className="space-y-0.5">
                {projectGroups.map(({ project, threads }) => (
                  <ClaudeProjectGroup
                    key={project.id}
                    project={project}
                    threads={threads}
                    onCreateChatInProject={handleCreateChatInProject}
                    onUnpinProject={(p) =>
                      updateProjectMutation.mutate({
                        projectId: p.id,
                        input: { starred: false }
                      }, {
                        onSuccess: () => showSuccess(`Project "${p.name}" unpinned from sidebar.`)
                      })
                    }
                    onArchiveProject={(p) =>
                      updateProjectMutation.mutate({
                        projectId: p.id,
                        input: { archived: true }
                      }, {
                        onSuccess: () => showSuccess(`Project "${p.name}" archived.`)
                      })
                    }
                    onDeleteProject={(p) => {
                      if (confirm(`Delete project "${p.name}"? Chats will be unassigned.`)) {
                        deleteProjectMutation.mutate(p.id, {
                          onSuccess: () => showSuccess(`Project "${p.name}" deleted.`)
                        });
                      }
                    }}
                    onRenameProject={(p, newName) =>
                      updateProjectMutation.mutate({
                        projectId: p.id,
                        input: { name: newName }
                      }, {
                        onSuccess: () => showSuccess("Project renamed.")
                      })
                    }
                    {...commonProps}
                  />
                ))}
              </div>
            ) : (
              <Link
                href="/projects"
                onClick={onNavigate}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground/60 hover:text-primary transition-colors font-medium rounded-md hover:bg-sidebar-accent/40 my-0.5"
              >
                <Pin className="h-3 w-3 shrink-0" />
                <span>Pin a project</span>
              </Link>
            )}

            {/* GENEROUS SPACING BETWEEN PROJECTS AND CHATS */}
            <div className="mt-6 pt-2">
              {/* CHATS SECTION HEADER with SlidersHorizontal Grouping & Sorting dropdown at flex-end */}
              <div className="mb-1.5 px-2 flex items-center justify-between text-[11px] font-medium tracking-wider uppercase text-muted-foreground/70 select-none">
                <span>
                  {groupBy === "date"
                    ? "Ungrouped"
                    : groupBy === "project"
                    ? "Custom groups"
                    : "Recent chats"}
                </span>

                {!selectMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground/70 hover:text-foreground"
                        title="Group and sort options"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Group by
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setGroupBy("date")}>
                        <span className="flex-1">Date</span>
                        {groupBy === "date" && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setGroupBy("project")}>
                        <span className="flex-1">Custom groups</span>
                        {groupBy === "project" && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setGroupBy("none")}>
                        <span className="flex-1">None</span>
                        {groupBy === "none" && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Sort by
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setSortBy("updated")}>
                        <span className="flex-1">Last activity</span>
                        {sortBy === "updated" && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy("title")}>
                        <span className="flex-1">Title</span>
                        {sortBy === "title" && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* PINNED CHATS */}
              {pinned.length > 0 && (
                <>
                  <SectionHeader label="Pinned" count={pinned.length} />
                  <div className="space-y-0.5">
                    {pinned.map((chat) => (
                      <ClaudeThreadRow
                        key={chat.id}
                        chat={chat}
                        showPinState
                        selected={selectedIds.has(chat.id)}
                        {...commonProps}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* GROUP BY: DATE (Today / Yesterday / Previous 7 Days / Older) */}
              {groupBy === "date" && (
                <>
                  {today.length > 0 && (
                    <>
                      <SectionHeader label="Today" />
                      <div className="space-y-0.5">
                        {today.map((chat) => (
                          <ClaudeThreadRow
                            key={chat.id}
                            chat={chat}
                            selected={selectedIds.has(chat.id)}
                            {...commonProps}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {yesterday.length > 0 && (
                    <>
                      <SectionHeader label="Yesterday" />
                      <div className="space-y-0.5">
                        {yesterday.map((chat) => (
                          <ClaudeThreadRow
                            key={chat.id}
                            chat={chat}
                            selected={selectedIds.has(chat.id)}
                            {...commonProps}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {previous7Days.length > 0 && (
                    <>
                      <SectionHeader label="Previous 7 Days" />
                      <div className="space-y-0.5">
                        {previous7Days.map((chat) => (
                          <ClaudeThreadRow
                            key={chat.id}
                            chat={chat}
                            selected={selectedIds.has(chat.id)}
                            {...commonProps}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {older.length > 0 && (
                    <>
                      <SectionHeader label="Older" />
                      <div className="space-y-0.5">
                        {older.map((chat) => (
                          <ClaudeThreadRow
                            key={chat.id}
                            chat={chat}
                            selected={selectedIds.has(chat.id)}
                            {...commonProps}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* GROUP BY: NONE or PROJECT (Flat Recent List) */}
              {(groupBy === "none" || groupBy === "project") && sortedUnpinned.length > 0 && (
                <div className="space-y-0.5">
                  {sortedUnpinned.map((chat) => (
                    <ClaudeThreadRow
                      key={chat.id}
                      chat={chat}
                      selected={selectedIds.has(chat.id)}
                      {...commonProps}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ARCHIVED CHATS */}
            {archived.length > 0 && (
              <Collapsible defaultOpen={false} className="mt-4">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1 text-[11px] font-medium tracking-wider uppercase text-muted-foreground/60 hover:text-foreground">
                  <span>Archived ({archived.length})</span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 pt-1">
                  {archived.map((chat) => (
                    <ClaudeThreadRow
                      key={chat.id}
                      chat={chat}
                      selected={selectedIds.has(chat.id)}
                      {...commonProps}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </div>

      {/* Sticky Bulk Action Bar */}
      {selectMode && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          projects={projects}
          onArchive={() => handleBulk("archive")}
          onDelete={() => handleBulk("delete")}
          onPin={() => handleBulk("pin")}
          onMoveToProject={(projectId) =>
            handleBulk(projectId ? "move_to_project" : "remove_from_project", projectId)
          }
          onClear={exitSelectMode}
        />
      )}

      {/* Quick Create Project Modal */}
      <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>
              Create a workspace to group chats with shared system instructions and knowledge.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid gap-2">
              <Label htmlFor="quick-project-name">Project Name</Label>
              <Input
                id="quick-project-name"
                placeholder="e.g. Physics 101, Machine Learning"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateProject();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateProjectOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
