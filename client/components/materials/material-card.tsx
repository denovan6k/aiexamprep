"use client";

import {
  Download,
  Eye,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { MaterialChatDialog } from "@/components/materials/material-chat-dialog";
import { MaterialPreviewDialog } from "@/components/materials/material-preview-dialog";
import { ResourceListRow } from "@/components/page-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDeleteMaterialMutation,
  useReprocessMaterialMutation,
  useUpdateMaterialMutation
} from "@/hooks/use-materials";
import type { MaterialSummary } from "@/lib/materials";
import { downloadMaterial, isChatLibraryItem, materialFileTypeLabel, materialOpenUrl } from "@/lib/materials";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

type MaterialCardProps = {
  material: MaterialSummary;
  showCourseChat?: boolean;
  courseId?: string;
  courseTitle?: string;
  variant?: "card" | "row";
};

function MaterialTypeIcon({ material }: { material: MaterialSummary }) {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
      {materialFileTypeLabel(material)}
    </div>
  );
}

export function MaterialCard({
  material,
  showCourseChat,
  courseId,
  courseTitle,
  variant = "card"
}: MaterialCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(material.title || material.file_name);
  const deleteMutation = useDeleteMaterialMutation();
  const reprocessMutation = useReprocessMaterialMutation();
  const updateMutation = useUpdateMaterialMutation();
  const label = material.title || material.file_name;
  const scopedCourseId = courseId ?? material.course_id;
  const isChatItem = isChatLibraryItem(material);
  const canReprocess =
    !isChatItem &&
    (material.status === "failed" ||
      material.status === "uploaded" ||
      material.status === "processed");

  async function handleDownload() {
    setIsDownloading(true);
    try {
      if (isChatItem) {
        const url = materialOpenUrl(material);
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        await downloadMaterial(material.id, material.file_name);
      }
    } catch (error) {
      showError(error, "Could not download this file.");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleReprocess() {
    try {
      await reprocessMutation.mutateAsync({
        materialId: material.id,
        courseId: scopedCourseId
      });
      showSuccess("Reprocessing started.");
    } catch (error) {
      showError(error, "Could not reprocess this material.");
    }
  }

  async function handleRename() {
    const next = titleDraft.trim();
    if (!next) {
      showError(new Error("Title is required."), "Enter a title.");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        materialId: material.id,
        title: next,
        courseId: scopedCourseId
      });
      showSuccess("Title updated.");
      setRenameOpen(false);
    } catch (error) {
      showError(error, "Could not rename this material.");
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync({
        materialId: material.id,
        courseId: scopedCourseId,
        source: isChatItem ? "chat" : "material"
      });
      showSuccess("Material deleted.");
      setDeleteOpen(false);
    } catch (error) {
      showError(error, "Could not delete this material.");
    }
  }

  const previewTrigger = (
    <Button type="button" variant="outline" size="sm" className="gap-1.5">
      <Eye className="h-3.5 w-3.5" />
      Preview
    </Button>
  );

  const actions = (
    <>
      <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
        <MaterialPreviewDialog material={material} trigger={previewTrigger} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isDownloading}
          onClick={() => void handleDownload()}
        >
          {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Download
        </Button>
        {!isChatItem ? <MaterialChatDialog material={material} /> : null}
        {!isChatItem && material.status === "processed" ? (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={asRoute(`/search?material_ids=${material.id}`)}>
              <Search className="h-3.5 w-3.5" />
              Search
            </Link>
          </Button>
        ) : null}
        {isChatItem && material.thread_id ? (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={asRoute(`/chat/${material.thread_id}`)}>
              <MessageSquare className="h-3.5 w-3.5" />
              Open chat
            </Link>
          </Button>
        ) : null}
        {showCourseChat && courseId ? (
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href={asRoute(`/chat?course_id=${courseId}`)}>
              <MessageSquare className="h-3.5 w-3.5" />
              Course chat
            </Link>
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="More material actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {!isChatItem ? (
              <DropdownMenuItem
                onSelect={() => {
                  setTitleDraft(material.title || material.file_name);
                  setRenameOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                Rename
              </DropdownMenuItem>
            ) : null}
            {canReprocess ? (
              <DropdownMenuItem
                disabled={reprocessMutation.isPending}
                onSelect={() => void handleReprocess()}
              >
                <RefreshCw className="h-4 w-4" />
                Reprocess
              </DropdownMenuItem>
            ) : null}
            {!isChatItem || canReprocess ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1.5 sm:hidden">
        {!isChatItem ? <MaterialChatDialog material={material} /> : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="More material actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <MaterialPreviewDialog
              material={material}
              trigger={
                <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                  <Eye className="h-4 w-4" />
                  Preview
                </DropdownMenuItem>
              }
            />
            <DropdownMenuItem disabled={isDownloading} onClick={() => void handleDownload()}>
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download
            </DropdownMenuItem>
            {!isChatItem && material.status === "processed" ? (
              <DropdownMenuItem asChild>
                <Link href={asRoute(`/search?material_ids=${material.id}`)}>
                  <Search className="h-4 w-4" />
                  Search
                </Link>
              </DropdownMenuItem>
            ) : null}
            {isChatItem && material.thread_id ? (
              <DropdownMenuItem asChild>
                <Link href={asRoute(`/chat/${material.thread_id}`)}>
                  <MessageSquare className="h-4 w-4" />
                  Open chat
                </Link>
              </DropdownMenuItem>
            ) : null}
            {showCourseChat && courseId ? (
              <DropdownMenuItem asChild>
                <Link href={asRoute(`/chat?course_id=${courseId}`)}>
                  <MessageSquare className="h-4 w-4" />
                  Course chat
                </Link>
              </DropdownMenuItem>
            ) : null}
            {!isChatItem ? (
              <DropdownMenuItem
                onSelect={() => {
                  setTitleDraft(material.title || material.file_name);
                  setRenameOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                Rename
              </DropdownMenuItem>
            ) : null}
            {canReprocess ? (
              <DropdownMenuItem
                disabled={reprocessMutation.isPending}
                onSelect={() => void handleReprocess()}
              >
                <RefreshCw className="h-4 w-4" />
                Reprocess
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  const dialogs = (
    <>
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename material</DialogTitle>
            <DialogDescription>Update the display title. The original file name stays the same.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`rename-${material.id}`}>Title</Label>
            <Input
              id={`rename-${material.id}`}
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              maxLength={255}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleRename()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete material?</DialogTitle>
            <DialogDescription>
              This permanently removes <span className="font-medium text-foreground">{label}</span>
              {isChatItem
                ? " from chat storage."
                : " and its extracted text. Derived quizzes or decks are not deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (variant === "row") {
    return (
      <div>
        <ResourceListRow
          icon={<MaterialTypeIcon material={material} />}
          title={label}
          description={material.extracted_text_preview || material.file_name}
          meta={
            <>
              {courseTitle ? <span>{courseTitle} · </span> : null}
              <span>
                {material.chunk_count} sections · {new Date(material.created_at).toLocaleDateString()}
              </span>
            </>
          }
          badge={
            <div className="flex shrink-0 items-center gap-1.5">
              {isChatItem ? <Badge variant="outline">Chat</Badge> : null}
              <Badge variant={material.status === "processed" ? "success" : "secondary"}>
                {material.status}
              </Badge>
            </div>
          }
          actions={actions}
        />
        {dialogs}
      </div>
    );
  }

  return (
    <>
      <Card className="flex h-full flex-col transition-all hover:border-primary/25 hover:shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <MaterialTypeIcon material={material} />
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{label}</CardTitle>
                <CardDescription className="mt-1 line-clamp-2">
                  {material.extracted_text_preview || material.file_name}
                </CardDescription>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {isChatItem ? <Badge variant="outline">Chat</Badge> : null}
              <Badge variant={material.status === "processed" ? "success" : "secondary"}>
                {material.status}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="mt-auto space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{material.chunk_count} sections</span>
            <span>·</span>
            <span>{new Date(material.created_at).toLocaleDateString()}</span>
          </div>

          {actions}
        </CardContent>
      </Card>
      {dialogs}
    </>
  );
}
