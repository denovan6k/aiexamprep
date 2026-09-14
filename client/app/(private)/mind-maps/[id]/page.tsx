"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MindMapEditor } from "@/components/mind-map/mind-map-editor";
import { PageFrame, PageHeader } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { useStudyArtifactQuery, useUpdateStudyArtifactMutation } from "@/hooks/use-study-artifacts";
import { documentFromPreview, documentToContent, type MindMapDocument } from "@/lib/mind-map";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

export default function MindMapEditorPage() {
  const params = useParams<{ id: string }>();
  const artifactId = params.id;
  const { data: artifact, isLoading, error } = useStudyArtifactQuery(artifactId);
  const updateMutation = useUpdateStudyArtifactMutation();

  const [document, setDocument] = useState<MindMapDocument | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedArtifactIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!artifact || artifact.artifact_type !== "mind_map") return;
    if (loadedArtifactIdRef.current === artifact.id) return;
    loadedArtifactIdRef.current = artifact.id;
    const next = documentFromPreview(artifact.content);
    setDocument(next);
  }, [artifact]);

  const persistDocument = useCallback(
    async (next: MindMapDocument) => {
      if (!artifactId) return;
      try {
        await updateMutation.mutateAsync({
          artifactId,
          input: {
            title: next.title,
            content: documentToContent(next)
          }
        });
        showSuccess("Mind map saved.");
      } catch (err) {
        showError(err, "Failed to save mind map.");
      }
    },
    [artifactId, updateMutation]
  );

  const handleChange = useCallback(
    (next: MindMapDocument) => {
      setDocument(next);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void persistDocument(next);
      }, 800);
    },
    [persistDocument]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const backHref = useMemo(() => {
    if (artifact?.thread_id) return asRoute(`/chat/${artifact.thread_id}`);
    return asRoute("/chat");
  }, [artifact?.thread_id]);

  if (isLoading) {
    return (
      <PageFrame>
        <p className="text-sm text-muted-foreground">Loading mind map…</p>
      </PageFrame>
    );
  }

  if (error || !artifact || artifact.artifact_type !== "mind_map" || !document) {
    return (
      <PageFrame>
        <PageHeader title="Mind map unavailable" description="This study artifact could not be loaded." />
        <Button asChild variant="outline">
          <Link href={asRoute("/chat")}>Back to chat</Link>
        </Button>
      </PageFrame>
    );
  }

  return (
    <PageFrame className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <PageHeader
        title={artifact.title}
        actions={
          <Button asChild variant="outline">
            <Link href={backHref}>Back to chat</Link>
          </Button>
        }
      />
      <div className="min-h-0 flex-1">
        <MindMapEditor document={document} onChange={handleChange} className="h-full" />
      </div>
    </PageFrame>
  );
}
