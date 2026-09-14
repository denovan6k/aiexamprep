"use client";

import { BookOpen, Check, Layers, MessageSquare, Play, Target, X } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import type { StudyPlanAction, StudyPlanItem } from "@/lib/core-study";
import { asRoute } from "@/lib/utils";

type StudyPlanItemDialogProps = {
  item: StudyPlanItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceHref: string;
  onAction: (action: StudyPlanAction) => void;
  isPending?: boolean;
};

function itemMeta(item: StudyPlanItem) {
  switch (item.item_type) {
    case "flashcards":
    case "remediation_deck":
      return {
        icon: Layers,
        label: "Flashcards",
        detail: "Spaced repetition keeps weak topics from fading before your exam."
      };
    case "weak_topic":
    case "remediation_retry":
      return {
        icon: BookOpen,
        label: "Quiz practice",
        detail: "Targeted quiz practice on topics that scored below your mastery threshold."
      };
    case "remediation_explain":
      return {
        icon: MessageSquare,
        label: "Explain in chat",
        detail: "Review the concept with grounded explanations from your uploaded materials."
      };
    default:
      return {
        icon: Target,
        label: "Study task",
        detail: "A recommended next step based on your courses, deadlines, and recent performance."
      };
  }
}

export function StudyPlanItemDialog({
  item,
  open,
  onOpenChange,
  resourceHref,
  onAction,
  isPending
}: StudyPlanItemDialogProps) {
  if (!item) return null;

  const meta = itemMeta(item);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <meta.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-left">{item.title}</DialogTitle>
              <DialogDescription className="text-left">{meta.detail}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <InfoTile label="Type" value={meta.label} />
          <InfoTile label="Estimated" value={`${item.estimated_minutes} min`} />
          <InfoTile label="Priority" value={`#${item.priority}`} />
          <InfoTile label="Status" value={item.status.replace("_", " ")} />
          {item.topic ? <InfoTile label="Topic" value={item.topic} className="sm:col-span-2" /> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{meta.label}</Badge>
          {item.course_id ? <Badge variant="secondary">Course linked</Badge> : null}
          <Badge
            variant={
              item.status === "completed" ? "success" : item.status === "in_progress" ? "warning" : "secondary"
            }
          >
            {item.status.replace("_", " ")}
          </Badge>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={asRoute(resourceHref)}>Open resource</Link>
          </Button>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            {item.status !== "completed" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2"
                disabled={isPending}
                onClick={() => onAction("dismiss")}
              >
                <X className="h-4 w-4" />
                Dismiss
              </Button>
            ) : null}
            {item.status !== "completed" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={isPending}
                onClick={() => onAction("complete")}
              >
                <Check className="h-4 w-4" />
                Complete
              </Button>
            ) : null}
            {item.status === "pending" ? (
              <Button
                type="button"
                size="sm"
                className="gap-2"
                disabled={isPending}
                onClick={() => onAction("start")}
              >
                <Play className="h-4 w-4" />
                Start now
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoTile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-muted/20 px-3 py-2 ${className ?? ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium capitalize">{value}</p>
    </div>
  );
}
