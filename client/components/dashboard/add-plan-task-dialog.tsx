"use client";

import { Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateStudyPlanItemMutation } from "@/hooks/use-core-study";
import type { Course } from "@/lib/study";
import { showError, showSuccess } from "@/lib/toast";

const MINUTE_PRESETS = [10, 15, 20, 30, 45] as const;

const TASK_TYPES = [
  { value: "custom", label: "Custom study block", defaultTitle: "" },
  { value: "flashcards", label: "Review flashcards", defaultTitle: "Review flashcards" },
  { value: "weak_topic", label: "Practice a topic", defaultTitle: "Practice weak topic" },
  { value: "course_review", label: "Continue a course", defaultTitle: "Continue course" }
] as const;

type TaskType = (typeof TASK_TYPES)[number]["value"];

type AddPlanTaskDialogProps = {
  courses: Course[];
  trigger?: ReactNode;
  onCreated?: () => void;
};

export function AddPlanTaskDialog({ courses, trigger, onCreated }: AddPlanTaskDialogProps) {
  const create = useCreateStudyPlanItemMutation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("15");
  const [taskType, setTaskType] = useState<TaskType>("custom");
  const [courseId, setCourseId] = useState("");
  const [topic, setTopic] = useState("");

  useEffect(() => {
    if (!open) return;
    setCourseId(courses[0]?.id ?? "");
  }, [courses, open]);

  useEffect(() => {
    const preset = TASK_TYPES.find((item) => item.value === taskType);
    if (preset?.defaultTitle) {
      setTitle(preset.defaultTitle);
    }
  }, [taskType]);

  function reset() {
    setTitle("");
    setMinutes("15");
    setTaskType("custom");
    setCourseId(courses[0]?.id ?? "");
    setTopic("");
    create.reset();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    create.mutate(
      {
        title: trimmed,
        estimated_minutes: Number(minutes),
        item_type: taskType,
        course_id: courseId || null,
        topic: taskType === "weak_topic" ? topic.trim() || null : null
      },
      {
        onSuccess: () => {
          showSuccess("Task added to today's plan.");
          onCreated?.();
          reset();
          setOpen(false);
        },
        onError: (err) => showError(err, "Failed to add task.")
      }
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Add task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add to today&apos;s plan</DialogTitle>
            <DialogDescription>
              Create an extra task for today without replacing your auto-generated priorities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="plan-task-type">Task type</Label>
              <select
                id="plan-task-type"
                value={taskType}
                onChange={(event) => setTaskType(event.target.value as TaskType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {TASK_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-task-title">Title</Label>
              <Input
                id="plan-task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What do you want to work on?"
              />
            </div>

            {courses.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="plan-task-course">Course</Label>
                <select
                  id="plan-task-course"
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {taskType === "weak_topic" ? (
              <div className="space-y-2">
                <Label htmlFor="plan-task-topic">Topic</Label>
                <Input
                  id="plan-task-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="e.g. Cell Biology"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="plan-task-minutes">Estimated minutes</Label>
              <Input
                id="plan-task-minutes"
                type="number"
                min={5}
                max={180}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {MINUTE_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={Number(minutes) === preset ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMinutes(String(preset))}
                  >
                    {preset} min
                  </Button>
                ))}
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !title.trim()}>
              {create.isPending ? "Adding..." : "Add to plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
