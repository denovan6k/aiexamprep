"use client";

import {
  BookOpen,
  Check,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Play,
  Target,
  X
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AddPlanTaskDialog } from "@/components/dashboard/add-plan-task-dialog";
import { DashboardFeedSection } from "@/components/dashboard/dashboard-feed-section";
import { StudyPlanItemDialog } from "@/components/dashboard/study-plan-item-dialog";
import { ResourceListRow } from "@/components/page-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StudyPlanAction, StudyPlanItem } from "@/lib/core-study";
import type { Course } from "@/lib/study";
import { asRoute, cn } from "@/lib/utils";

type StudyPlanListProps = {
  items: StudyPlanItem[];
  courses?: Course[];
  isLoading?: boolean;
  hasCourses?: boolean;
  itemHref: (item: StudyPlanItem) => string;
  onAction: (item: StudyPlanItem, action: StudyPlanAction) => void;
  isPending?: boolean;
};

function itemIcon(item: StudyPlanItem) {
  switch (item.item_type) {
    case "flashcards":
    case "remediation_deck":
      return Layers;
    case "weak_topic":
    case "remediation_retry":
      return BookOpen;
    case "remediation_explain":
      return MessageSquare;
    default:
      return Target;
  }
}

function itemTypeLabel(item: StudyPlanItem) {
  switch (item.item_type) {
    case "flashcards":
      return "Flashcards";
    case "remediation_deck":
      return "Remediation deck";
    case "weak_topic":
      return "Weak topic";
    case "remediation_retry":
      return "Retry quiz";
    case "remediation_explain":
      return "Explain in chat";
    default:
      return "Study task";
  }
}

export function StudyPlanList({
  items,
  courses = [],
  isLoading,
  hasCourses,
  itemHref,
  onAction,
  isPending
}: StudyPlanListProps) {
  const [selectedItem, setSelectedItem] = useState<StudyPlanItem | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  const filteredItems = useMemo(() => {
    if (filter === "pending") {
      return items.filter((item) => item.status !== "completed" && item.status !== "dismissed");
    }
    if (filter === "completed") {
      return items.filter((item) => item.status === "completed");
    }
    return items;
  }, [filter, items]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  function renderPlanItems(planItems: StudyPlanItem[]) {
    if (planItems.length === 0) {
      return (
        <EmptyState
          icon={Check}
          title={filter === "completed" ? "No completed tasks yet" : "You are clear for this view"}
          description={
            hasCourses
              ? "Refresh your plan or use Quick start to jump into a study session."
              : "Create a course to generate a personalized Today plan."
          }
          action={
            hasCourses ? (
              <AddPlanTaskDialog courses={courses} />
            ) : (
              <Button asChild>
                <Link href={asRoute("/onboarding")}>Start setup</Link>
              </Button>
            )
          }
          className="rounded-2xl border border-dashed border-border bg-transparent py-8"
        />
      );
    }

    return planItems.map((item, index) => {
      const Icon = itemIcon(item);
      return (
        <ResourceListRow
          key={item.id}
          className={cn(item.status === "completed" && "opacity-75")}
          icon={
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
          }
          title={item.title}
          description={item.topic ? `Topic: ${item.topic}` : undefined}
          meta={
            <>
              Priority {index + 1} · {item.estimated_minutes} min · {itemTypeLabel(item)}
            </>
          }
          badge={
            <Badge
              variant={
                item.status === "completed"
                  ? "success"
                  : item.status === "in_progress"
                    ? "warning"
                    : "secondary"
              }
            >
              {item.status.replace("_", " ")}
            </Badge>
          }
          actions={
            <>
              {item.status === "pending" ? (
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={isPending}
                  onClick={() => onAction(item, "start")}
                >
                  <Play className="h-3.5 w-3.5" />
                  Start
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-8 w-8 px-0" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {item.status !== "completed" ? (
                    <DropdownMenuItem disabled={isPending} onClick={() => onAction(item, "complete")}>
                      <Check className="mr-2 h-4 w-4" />
                      Mark complete
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem asChild>
                    <Link href={asRoute(itemHref(item))}>Open</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedItem(item)}>Details</DropdownMenuItem>
                  {item.status !== "completed" ? (
                    <DropdownMenuItem disabled={isPending} onClick={() => onAction(item, "dismiss")}>
                      <X className="mr-2 h-4 w-4" />
                      Dismiss
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
      );
    });
  }

  return (
    <>
      <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
        <DashboardFeedSection
          eyebrow="Today's plan"
          title="Work highest priority first"
          subtitle="Start a task, complete it, or open details for more context."
          headerAside={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <AddPlanTaskDialog courses={courses} />
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="completed">Done</TabsTrigger>
              </TabsList>
            </div>
          }
        >
          <TabsContent value={filter} className="mt-0 space-y-2 data-[state=inactive]:hidden">
            {renderPlanItems(filteredItems)}
          </TabsContent>
        </DashboardFeedSection>
      </Tabs>

      <StudyPlanItemDialog
        item={selectedItem}
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        resourceHref={selectedItem ? itemHref(selectedItem) : "/courses"}
        isPending={isPending}
        onAction={(action) => {
          if (!selectedItem) return;
          onAction(selectedItem, action);
          if (action !== "start") setSelectedItem(null);
        }}
      />
    </>
  );
}
