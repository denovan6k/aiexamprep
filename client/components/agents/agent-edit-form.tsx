"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload } from "lucide-react";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AgentAvatar } from "@/components/agents/agent-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateAgentMutation, useUploadAgentAvatarMutation } from "@/hooks/use-agents";
import type { Agent } from "@/lib/study";
import { showError, showSuccess } from "@/lib/toast";
import { updateAgentSchema } from "@/lib/validation";

type AgentEditFormProps = {
  agent: Agent;
  onSaved?: (agent: Agent) => void;
};

type FormValues = z.infer<typeof updateAgentSchema>;

export function AgentEditForm({ agent, onSaved }: AgentEditFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateMutation = useUpdateAgentMutation(agent.id);
  const uploadMutation = useUploadAgentAvatarMutation(agent.id);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty }
  } = useForm<FormValues>({
    resolver: zodResolver(updateAgentSchema),
    defaultValues: {
      name: agent.name,
      description: agent.description ?? "",
      subject_area: agent.subject_area ?? "",
      difficulty: (agent.difficulty as FormValues["difficulty"]) ?? undefined,
      marking_strictness: (agent.marking_strictness as FormValues["marking_strictness"]) ?? undefined,
      feedback_tone: (agent.feedback_tone as FormValues["feedback_tone"]) ?? undefined,
      intro_message: agent.intro_message ?? "",
      capabilities_summary: agent.capabilities_summary ?? "",
      favorite_topics: (agent.favorite_topics ?? []).join(", "),
      common_traps: (agent.common_traps ?? []).join(", ")
    }
  });

  const difficulty = watch("difficulty");
  const markingStrictness = watch("marking_strictness");
  const feedbackTone = watch("feedback_tone");

  function onSubmit(values: FormValues) {
    updateMutation.mutate(
      {
        name: values.name,
        description: values.description || undefined,
        subject_area: values.subject_area || undefined,
        difficulty: values.difficulty,
        marking_strictness: values.marking_strictness,
        feedback_tone: values.feedback_tone,
        intro_message: values.intro_message || undefined,
        capabilities_summary: values.capabilities_summary || undefined,
        favorite_topics: values.favorite_topics
          ? values.favorite_topics.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined,
        common_traps: values.common_traps
          ? values.common_traps.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined
      },
      { onSuccess: (updated) => {
          showSuccess("Agent profile saved.");
          onSaved?.(updated);
        },
        onError: (err) => showError(err, "Failed to save agent profile.")
      }
    );
  }

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file, {
      onSuccess: () => showSuccess("Avatar uploaded."),
      onError: (err) => showError(err, "Failed to upload avatar.")
    });
    event.target.value = "";
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center gap-4">
        <AgentAvatar name={agent.name} avatarUrl={agent.avatar_url} size="lg" className="h-16 w-16" />
        <div>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload avatar
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...register("name")} />
          {errors.name ? <p className="text-sm text-danger">{errors.name.message}</p> : null}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={4} {...register("description")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject_area">Subject area</Label>
          <Input id="subject_area" {...register("subject_area")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capabilities_summary">Tagline</Label>
          <Input id="capabilities_summary" placeholder="Short card summary" {...register("capabilities_summary")} />
        </div>
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select value={difficulty ?? ""} onValueChange={(value) => setValue("difficulty", value as FormValues["difficulty"], { shouldDirty: true })}>
            <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Marking strictness</Label>
          <Select
            value={markingStrictness ?? ""}
            onValueChange={(value) =>
              setValue("marking_strictness", value as FormValues["marking_strictness"], { shouldDirty: true })
            }
          >
            <SelectTrigger><SelectValue placeholder="Select strictness" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lenient">Lenient</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="strict">Strict</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Feedback tone</Label>
          <Select
            value={feedbackTone ?? ""}
            onValueChange={(value) => setValue("feedback_tone", value as FormValues["feedback_tone"], { shouldDirty: true })}
          >
            <SelectTrigger><SelectValue placeholder="Select tone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="encouraging">Encouraging</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="intro_message">Group intro message</Label>
          <Textarea id="intro_message" rows={3} placeholder="Used when sharing to a group (optional)" {...register("intro_message")} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="favorite_topics">Favorite topics (comma-separated)</Label>
          <Input id="favorite_topics" {...register("favorite_topics")} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="common_traps">Common traps (comma-separated)</Label>
          <Input id="common_traps" {...register("common_traps")} />
        </div>
      </div>

      <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
        {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save changes
      </Button>
    </form>
  );
}
