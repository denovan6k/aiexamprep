"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  FolderPlus,
  MoreVertical,
  Pin,
  PinOff,
  Plus,
  Trash2,
  Workflow
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SystemMessage } from "@/components/ui/system-message";
import { Textarea } from "@/components/ui/textarea";
import {
  useChatProjectsQuery,
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useUpdateProjectMutation
} from "@/hooks/use-chat";
import { showError, showSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: projects = [], isLoading } = useChatProjectsQuery({
    includeArchived: showArchived
  });

  const createProjectMutation = useCreateProjectMutation();
  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

  const filteredProjects = projects.filter((p) => (showArchived ? p.archived : !p.archived));

  function handleCreate() {
    if (!name.trim()) return;

    createProjectMutation.mutate(
      { name: name.trim(), description: description.trim() || null },
      {
        onSuccess: (newProject) => {
          showSuccess("Project created and pinned to sidebar.");
          setCreateDialogOpen(false);
          setName("");
          setDescription("");
          router.push(`/projects/${newProject.id}`);
        },
        onError: (err) => showError(err, "Failed to create project.")
      }
    );
  }

  function handleTogglePin(projectId: string, starred: boolean) {
    updateProjectMutation.mutate(
      { projectId, input: { starred: !starred } },
      {
        onSuccess: () =>
          showSuccess(!starred ? "Project pinned to sidebar." : "Project unpinned from sidebar."),
        onError: (err) => showError(err, "Failed to update project.")
      }
    );
  }

  function handleToggleArchive(projectId: string, archived: boolean) {
    updateProjectMutation.mutate(
      { projectId, input: { archived: !archived } },
      {
        onSuccess: () => showSuccess(!archived ? "Project archived." : "Project unarchived."),
        onError: (err) => showError(err, "Failed to update project.")
      }
    );
  }

  function handleDelete(projectId: string) {
    if (!confirm("Are you sure you want to delete this project? Chats in this project will not be deleted, but will be unassigned.")) return;

    deleteProjectMutation.mutate(projectId, {
      onSuccess: () => showSuccess("Project deleted."),
      onError: (err) => showError(err, "Failed to delete project.")
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" />
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Projects</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Workspaces to organize chats with custom instructions and shared materials. Pin projects to keep them in your sidebar.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
                <DialogDescription>
                  Create a workspace for chats sharing system instructions and study materials.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder="e.g. Physics 101, Machine Learning Notes"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project-desc">Description (optional)</Label>
                  <Textarea
                    id="project-desc"
                    placeholder="What is this project about?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!name.trim() || createProjectMutation.isPending}
                >
                  {createProjectMutation.isPending ? "Creating..." : "Create Project"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b pb-3">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 text-xs font-medium">
          <button
            onClick={() => setShowArchived(false)}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              !showArchived ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Active Projects
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              showArchived ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Archived Projects
          </button>
        </div>
      </div>

      {/* Project Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading projects...</div>
      ) : filteredProjects.length === 0 ? (
        <SystemMessage variant="action" fill className="py-12">
          {showArchived ? "No archived projects." : "No projects yet. Create one to organize your chats."}
        </SystemMessage>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ContextMenu key={project.id}>
              <ContextMenuTrigger asChild>
                <Card className="group relative flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/projects/${project.id}`} className="min-w-0 flex-1 space-y-1">
                        <CardTitle className="truncate text-base font-semibold group-hover:text-primary">
                          {project.name}
                        </CardTitle>
                        {project.description && (
                          <CardDescription className="line-clamp-2 text-xs">
                            {project.description}
                          </CardDescription>
                        )}
                      </Link>

                      <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        {/* Pin/Unpin Toggle Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-8 w-8 transition-colors",
                            project.starred
                              ? "text-primary hover:text-primary/80"
                              : "text-muted-foreground hover:text-primary"
                          )}
                          onClick={() => handleTogglePin(project.id, project.starred)}
                          title={project.starred ? "Unpin from sidebar" : "Pin to sidebar"}
                        >
                          {project.starred ? (
                            <Pin className="h-4 w-4 fill-primary/20 text-primary" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                        </Button>

                        {/* 3-Dots Dropdown Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onSelect={() => handleTogglePin(project.id, project.starred)}>
                              {project.starred ? (
                                <>
                                  <PinOff className="mr-2 h-4 w-4" />
                                  Unpin from sidebar
                                </>
                              ) : (
                                <>
                                  <Pin className="mr-2 h-4 w-4" />
                                  Pin to sidebar
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => router.push(`/projects/${project.id}`)}>
                              <Workflow className="mr-2 h-4 w-4" />
                              Open workspace
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => handleToggleArchive(project.id, project.archived)}>
                              {project.archived ? (
                                <>
                                  <ArchiveRestore className="mr-2 h-4 w-4" />
                                  Unarchive
                                </>
                              ) : (
                                <>
                                  <Archive className="mr-2 h-4 w-4" />
                                  Archive
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => handleDelete(project.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="rounded bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                        {project.thread_count} chat{project.thread_count !== 1 ? "s" : ""}
                      </span>
                      <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </ContextMenuTrigger>

              {/* Right-click Context Menu for Project Card */}
              <ContextMenuContent className="w-48">
                <ContextMenuItem onSelect={() => handleTogglePin(project.id, project.starred)}>
                  {project.starred ? (
                    <>
                      <PinOff className="mr-2 h-4 w-4" />
                      Unpin from sidebar
                    </>
                  ) : (
                    <>
                      <Pin className="mr-2 h-4 w-4" />
                      Pin to sidebar
                    </>
                  )}
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => router.push(`/projects/${project.id}`)}>
                  <Workflow className="mr-2 h-4 w-4" />
                  Open workspace
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => handleToggleArchive(project.id, project.archived)}>
                  {project.archived ? (
                    <>
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </>
                  )}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => handleDelete(project.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete project
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      )}
    </div>
  );
}
