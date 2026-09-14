"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BookOpen,
  Check,
  FileText,
  FolderMinus,
  MessageSquare,
  Plus,
  Save,
  Star,
  Trash2,
  Workflow,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SystemMessage } from "@/components/ui/system-message";
import { Textarea } from "@/components/ui/textarea";
import {
  useChatProjectQuery,
  useChatThreadsQuery,
  useDeleteProjectMutation,
  useUpdateProjectMutation,
  useUpdateThreadMutation
} from "@/hooks/use-chat";
import { useMaterialsQuery } from "@/hooks/use-materials";
import { sanitizeThreadTitle } from "@/lib/chat";
import { showError, showSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default function ProjectSettingsPage({ params }: PageProps) {
  const { projectId } = use(params);
  const router = useRouter();

  const { data: project, isLoading: projectLoading, error: projectError } =
    useChatProjectQuery(projectId);
  const { data: threads = [] } = useChatThreadsQuery({ includeArchived: false });
  const { data: materialsData } = useMaterialsQuery({ limit: 100 });
  const allMaterials = materialsData?.items ?? [];

  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();
  const updateThreadMutation = useUpdateThreadMutation();

  const [instructions, setInstructions] = useState("");
  const [instructionsChanged, setInstructionsChanged] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [materialsModalOpen, setMaterialsModalOpen] = useState(false);

  useEffect(() => {
    if (project) {
      setInstructions(project.instructions ?? "");
      setName(project.name);
      setDescription(project.description ?? "");
      setInstructionsChanged(false);
    }
  }, [project]);

  if (projectLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl py-12 text-center text-sm text-muted-foreground">
        Loading project...
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 py-12">
        <Button variant="ghost" size="sm" onClick={() => router.push("/projects")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
        </Button>
        <SystemMessage variant="action" fill>
          Project not found or accessible.
        </SystemMessage>
      </div>
    );
  }

  const projectThreads = threads.filter((t) => t.project_id === project.id);
  const linkedMaterials = allMaterials.filter((m) => project.material_ids.includes(m.id));

  function handleSaveInstructions() {
    if (!project) return;
    updateProjectMutation.mutate(
      { projectId: project.id, input: { instructions: instructions.trim() || null } },
      {
        onSuccess: () => {
          showSuccess("Instructions saved.");
          setInstructionsChanged(false);
        },
        onError: (err) => showError(err, "Failed to save instructions.")
      }
    );
  }

  function handleSaveHeader() {
    if (!project || !name.trim()) return;
    updateProjectMutation.mutate(
      { projectId: project.id, input: { name: name.trim(), description: description.trim() || null } },
      {
        onSuccess: () => {
          showSuccess("Project info updated.");
          setEditingTitle(false);
        },
        onError: (err) => showError(err, "Failed to update project info.")
      }
    );
  }

  function handleToggleStar() {
    if (!project) return;
    updateProjectMutation.mutate(
      { projectId: project.id, input: { starred: !project.starred } },
      {
        onSuccess: () => showSuccess(!project.starred ? "Project pinned to sidebar." : "Project unpinned.")
      }
    );
  }

  function handleToggleArchive() {
    if (!project) return;
    updateProjectMutation.mutate(
      { projectId: project.id, input: { archived: !project.archived } },
      {
        onSuccess: () => {
          showSuccess(!project.archived ? "Project archived." : "Project unarchived.");
          router.push("/projects");
        }
      }
    );
  }

  function handleDeleteProject() {
    if (!project) return;
    if (
      !confirm("Are you sure you want to delete this project? Chats will be unassigned, not deleted.")
    )
      return;
    deleteProjectMutation.mutate(project.id, {
      onSuccess: () => {
        showSuccess("Project deleted.");
        router.push("/projects");
      }
    });
  }

  function handleToggleMaterialLink(materialId: string) {
    if (!project) return;
    const current = project.material_ids;
    const next = current.includes(materialId)
      ? current.filter((id) => id !== materialId)
      : [...current, materialId];

    updateProjectMutation.mutate(
      { projectId: project.id, input: { material_ids: next } },
      {
        onSuccess: () => showSuccess("Project materials updated."),
        onError: (err) => showError(err, "Failed to update materials.")
      }
    );
  }

  function handleRemoveThreadFromProject(threadId: string) {
    updateThreadMutation.mutate(
      { threadId, input: { project_id: null } },
      {
        onSuccess: () => showSuccess("Chat removed from project."),
        onError: (err) => showError(err, "Failed to remove chat.")
      }
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 py-4 sm:py-6">
      {/* Top Nav */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/projects/${projectId}`)}
          className="shrink-0"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to project
        </Button>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleStar}
            className="h-8 w-8 text-muted-foreground hover:text-amber-500"
            title={project.starred ? "Unpin from sidebar" : "Pin to sidebar"}
          >
            <Star
              className={cn("h-4 w-4", project.starred && "fill-amber-400 text-amber-500")}
            />
          </Button>

          <Button variant="outline" size="sm" onClick={handleToggleArchive}>
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
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleDeleteProject}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Header Info */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        {editingTitle ? (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Project Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSaveHeader} disabled={!name.trim()}>
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingTitle(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-3">
                <Workflow className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" />
                <h1
                  className="cursor-pointer truncate text-xl font-bold tracking-tight hover:underline sm:text-2xl"
                  onClick={() => setEditingTitle(true)}
                  title="Click to edit"
                >
                  {project.name}
                </h1>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground">{project.description}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setEditingTitle(true)}
            >
              Edit
            </Button>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Instructions + Chats */}
        <div className="order-2 space-y-6 md:order-1 md:col-span-2">
          {/* Custom Instructions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <CardTitle className="text-base font-semibold">Custom Instructions</CardTitle>
                  <CardDescription className="text-xs">
                    Automatically applied to all chats in this project.
                  </CardDescription>
                </div>
                {instructionsChanged && (
                  <Button size="sm" className="h-7 text-xs" onClick={handleSaveInstructions}>
                    <Save className="mr-1 h-3.5 w-3.5" /> Save
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="e.g. You are an expert Physics tutor. Explain concepts with real-world analogies and step-by-step derivations."
                value={instructions}
                onChange={(e) => {
                  setInstructions(e.target.value);
                  setInstructionsChanged(true);
                }}
                rows={6}
                className="font-mono text-sm leading-relaxed"
              />
            </CardContent>
          </Card>

          {/* Chats in Project */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Project Chats ({projectThreads.length})
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link href={`/projects/${projectId}`}>Open workspace</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {projectThreads.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No chats yet. Start one from the project workspace.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {projectThreads.map((thread) => (
                    <div
                      key={thread.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40"
                    >
                      <Link
                        href={`/chat/${thread.id}`}
                        className="flex items-center gap-2 min-w-0 flex-1 hover:underline"
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">
                          {sanitizeThreadTitle(thread.title, 80)}
                        </span>
                      </Link>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(thread.updated_at).toLocaleDateString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveThreadFromProject(thread.id)}
                          title="Remove from project"
                        >
                          <FolderMinus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Materials */}
        <div className="order-1 md:order-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Project Knowledge ({linkedMaterials.length})
                </CardTitle>
                <Dialog open={materialsModalOpen} onOpenChange={setMaterialsModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Add Materials to Project</DialogTitle>
                      <DialogDescription>
                        Select materials to use as background knowledge for all chats in this project.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[300px] overflow-y-auto space-y-1 py-2">
                      {allMaterials.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          No materials found. Upload materials under Courses or Search first.
                        </p>
                      ) : (
                        allMaterials.map((mat) => {
                          const isLinked = project.material_ids.includes(mat.id);
                          return (
                            <div
                              key={mat.id}
                              onClick={() => handleToggleMaterialLink(mat.id)}
                              className={cn(
                                "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-xs transition-colors hover:bg-muted",
                                isLinked && "bg-primary/10 font-medium"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{mat.title}</span>
                              </div>
                              {isLinked && <Check className="h-4 w-4 text-primary shrink-0" />}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription className="text-xs">
                Available as context during chat generation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {linkedMaterials.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No materials linked yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {linkedMaterials.map((mat) => (
                    <div
                      key={mat.id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate font-medium">{mat.title}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleToggleMaterialLink(mat.id)}
                        title="Unlink material"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
