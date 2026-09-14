"use client";

import { BookOpen, FileText, GitBranch, ListTree } from "lucide-react";

import { MindMapPreview } from "@/components/mind-map/mind-map-preview";

type StudyArtifactPreview = Record<string, unknown>;

type StudyArtifactCardProps = {
  artifactType: string;
  title: string;
  preview: StudyArtifactPreview;
  artifactId?: string;
  practiceExam?: boolean;
};

function artifactLabel(artifactType: string, practiceExam?: boolean) {
  if (practiceExam) return "Practice exam";
  const labels: Record<string, string> = {
    summary: "Summary",
    study_guide: "Study guide",
    notes: "Structured notes",
    mind_map: "Mind map"
  };
  return labels[artifactType] ?? artifactType.replace(/_/g, " ");
}

function artifactIcon(artifactType: string) {
  if (artifactType === "mind_map") return GitBranch;
  if (artifactType === "study_guide") return ListTree;
  if (artifactType === "notes") return FileText;
  return BookOpen;
}

function renderPreview(artifactType: string, preview: StudyArtifactPreview, artifactId?: string) {
  if (artifactType === "mind_map") {
    return <MindMapPreview preview={preview} artifactId={artifactId} />;
  }

  const sections =
    (preview.sections as Array<{ heading?: string; body?: string; key_points?: string[] }> | undefined) ??
    [];
  const notes = (preview.notes as Array<{ heading?: string; bullets?: string[] }> | undefined) ?? [];

  if (notes.length > 0) {
    return (
      <div className="space-y-3">
        {notes.map((note, index) => (
          <div key={`${note.heading ?? "note"}-${index}`}>
            {note.heading ? <p className="text-sm font-medium text-foreground">{note.heading}</p> : null}
            <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
              {(note.bullets ?? []).map((bullet, bulletIndex) => (
                <li key={`${bullet}-${bulletIndex}`}>• {bullet}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <div key={`${section.heading ?? "section"}-${index}`}>
          {section.heading ? <p className="text-sm font-medium text-foreground">{section.heading}</p> : null}
          {section.body ? <p className="mt-1 text-sm text-muted-foreground">{section.body}</p> : null}
          {section.key_points?.length ? (
            <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
              {section.key_points.map((point, pointIndex) => (
                <li key={`${point}-${pointIndex}`}>• {point}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function StudyArtifactCard({
  artifactType,
  title,
  preview,
  artifactId,
  practiceExam = false
}: StudyArtifactCardProps) {
  const Icon = artifactIcon(artifactType);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{artifactLabel(artifactType, practiceExam)}</p>
          </div>
        </div>
      </div>
      <div className="p-4">{renderPreview(artifactType, preview, artifactId)}</div>
    </div>
  );
}
