"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bot, Loader2 } from "lucide-react";
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
import { useCreateAgentMutation } from "@/hooks/use-agents";
import type { Agent } from "@/lib/study";
import { siteConfig } from "@/lib/site";
import { showError, showSuccess } from "@/lib/toast";
import { createAgentSchema } from "@/lib/validation";

const EXAMPLE_PROMPT =
  "Prefers theoretical questions, emphasizes key concepts, includes challenging answer choices, and deducts points for missing details.";

type CreateAgentDialogProps = {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (agent: Agent) => void;
};

type CreateAgentFormValues = z.infer<typeof createAgentSchema>;

export function CreateAgentDialog({ trigger, open, onOpenChange, onCreated }: CreateAgentDialogProps) {
  const createMutation = useCreateAgentMutation();
  const [internalOpen, setInternalOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid }
  } = useForm<CreateAgentFormValues>({
    resolver: zodResolver(createAgentSchema),
    mode: "onChange",
    defaultValues: { name: "", description: "" }
  });

  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setInternalOpen;
  const description = watch("description") ?? "";

  function resetForm() {
    reset();
    createMutation.reset();
  }

  function onSubmit(values: CreateAgentFormValues) {
    createMutation.mutate(
      { description: values.description, name: values.name || undefined },
      {
        onSuccess: (agent) => {
          showSuccess("Professor agent created.");
          onCreated?.(agent);
          resetForm();
          setDialogOpen(false);
        },
        onError: (err) => showError(err, "Failed to create agent.")
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <DialogTitle>Create professor agent</DialogTitle>
          <DialogDescription>
            Describe your examiner's style and preferences. {siteConfig.name} will generate matching quizzes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="agent-name">Name (optional)</Label>
            <Input
              id="agent-name"
              placeholder="Prof. MCQ Examiner"
              {...register("name")}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? <p className="text-sm text-danger">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-description">Examiner description</Label>
            <Textarea
              id="agent-description"
              placeholder={EXAMPLE_PROMPT}
              rows={6}
              {...register("description")}
              aria-invalid={Boolean(errors.description)}
            />
            <p className="text-xs text-muted-foreground">{description.length}/4000 - minimum 10 characters</p>
            {errors.description ? <p className="text-sm text-danger">{errors.description.message}</p> : null}
          </div>

          <details className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-foreground">Example prompt</summary>
            <p className="mt-2 text-muted-foreground">{EXAMPLE_PROMPT}</p>
          </details>

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
                "Create agent"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
