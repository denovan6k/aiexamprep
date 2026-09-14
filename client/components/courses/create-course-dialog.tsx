"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FolderOpen, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import { Textarea } from "@/components/ui/textarea";
import { useCreateCourseMutation } from "@/hooks/use-courses";
import type { Course } from "@/lib/study";
import { showError, showSuccess } from "@/lib/toast";
import { createCourseSchema } from "@/lib/validation";

type CreateCourseDialogProps = {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (course: Course) => void;
};

type CreateCourseFormValues = z.infer<typeof createCourseSchema>;

export function CreateCourseDialog({ trigger, open, onOpenChange, onCreated }: CreateCourseDialogProps) {
  const createMutation = useCreateCourseMutation();
  const [internalOpen, setInternalOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid }
  } = useForm<CreateCourseFormValues>({
    resolver: zodResolver(createCourseSchema),
    mode: "onChange",
    defaultValues: { title: "", description: "" }
  });

  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setInternalOpen;
  function resetForm() {
    reset();
    createMutation.reset();
  }

  function onSubmit(values: CreateCourseFormValues) {
    createMutation.mutate(
      { title: values.title, description: values.description || undefined },
      {
        onSuccess: (course) => {
          showSuccess("Course created.");
          onCreated?.(course);
          resetForm();
          setDialogOpen(false);
        },
        onError: (err) => showError(err, "Failed to create course.")
      }
    );
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(next) => {
        setDialogOpen(next);
        if (!next) resetForm();
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FolderOpen className="h-5 w-5" />
          </div>
          <DialogTitle>Add course</DialogTitle>
          <DialogDescription>
            Group materials, quizzes, and flashcards under a single course context.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="course-title">Course title</Label>
            <Input
              id="course-title"
              placeholder="Biology 201"
              {...register("title")}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title ? <p className="text-sm text-danger">{errors.title.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-description">Description (optional)</Label>
            <Textarea
              id="course-description"
              placeholder="Cell biology midterm prep"
              rows={3}
              {...register("description")}
              aria-invalid={Boolean(errors.description)}
            />
            {errors.description ? <p className="text-sm text-danger">{errors.description.message}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !isValid}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create course"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
