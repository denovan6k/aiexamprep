"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, WandSparkles } from "lucide-react";

import { SettingsProfileListSkeleton } from "@/components/settings/settings-card-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  useCreateGenerationProfileMutation,
  useDeleteGenerationProfileMutation,
  useGenerationProfilesQuery,
  useUpdateGenerationProfileMutation
} from "@/hooks/use-generation-profiles";
import { getClientErrorMessage } from "@/lib/api";
import type { GenerationOutputType, GenerationProfile } from "@/lib/generation-profiles";
import { showError, showSuccess } from "@/lib/toast";

const defaultPrompt: Record<GenerationOutputType, string> = {
  quiz: "Generate exam-style questions from this material, focusing on high-yield concepts and likely traps.",
  flashcards: "Create concise active-recall flashcards from definitions, mechanisms, formulas, and weak areas.",
  summary: "Write a compact study summary with key ideas, common misconceptions, and review priorities."
};

type FormState = {
  id: string | null;
  name: string;
  output_type: GenerationOutputType;
  prompt_template: string;
  apply_on_upload: boolean;
};

const emptyForm: FormState = {
  id: null,
  name: "",
  output_type: "flashcards",
  prompt_template: defaultPrompt.flashcards,
  apply_on_upload: false
};

export function GenerationProfilesCard() {
  const { data: profiles = [], isLoading, error: loadError } = useGenerationProfilesQuery();
  const createMutation = useCreateGenerationProfileMutation();
  const updateMutation = useUpdateGenerationProfileMutation();
  const deleteMutation = useDeleteGenerationProfileMutation();
  const [form, setForm] = useState<FormState>(emptyForm);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === form.id) ?? null,
    [form.id, profiles]
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const error = loadError ? getClientErrorMessage(loadError, "Failed to load generation profiles.") : null;

  function selectProfile(profile: GenerationProfile) {
    setForm({
      id: profile.id,
      name: profile.name,
      output_type: profile.output_type,
      prompt_template: profile.prompt_template,
      apply_on_upload: profile.apply_on_upload
    });
  }

  function resetForm() {
    setForm(emptyForm);
  }

  function handleSave() {
    if (!form.name.trim() || !form.prompt_template.trim()) return;
    const payload = {
      name: form.name.trim(),
      output_type: form.output_type,
      prompt_template: form.prompt_template.trim(),
      apply_on_upload: form.apply_on_upload,
      metadata: null
    };

    if (form.id) {
      updateMutation.mutate(
        { profileId: form.id, payload },
        {
          onSuccess: (saved) => {
            selectProfile(saved);
            showSuccess("Generation profile updated.");
          },
          onError: (err) => showError(err, "Failed to save generation profile.")
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (saved) => {
          selectProfile(saved);
          showSuccess("Generation profile created.");
        },
        onError: (err) => showError(err, "Failed to save generation profile.")
      });
    }
  }

  function handleDelete(profileId: string) {
    deleteMutation.mutate(profileId, {
      onSuccess: () => {
        if (form.id === profileId) resetForm();
        showSuccess("Generation profile deleted.");
      },
      onError: (err) => showError(err, "Failed to delete generation profile.")
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Generation profiles</CardTitle>
          <WandSparkles className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardDescription>Control what gets generated from uploaded material and how it is prompted.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-3">
          {isLoading ? (
            <SettingsProfileListSkeleton />
          ) : profiles.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              No profiles yet. Create one to auto-generate flashcards, quizzes, or summaries after upload.
            </p>
          ) : (
            profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => selectProfile(profile)}
                className="w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{profile.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{profile.prompt_template}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="secondary">{profile.output_type}</Badge>
                    {profile.apply_on_upload ? <Badge variant="success">On upload</Badge> : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">{selectedProfile ? "Edit profile" : "New profile"}</h3>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={resetForm}>
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={form.name}
              placeholder="Auto flashcards"
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-output">Output</Label>
            <Select
              value={form.output_type}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  output_type: value as GenerationOutputType,
                  prompt_template:
                    prev.prompt_template === defaultPrompt[prev.output_type]
                      ? defaultPrompt[value as GenerationOutputType]
                      : prev.prompt_template
                }))
              }
            >
              <SelectTrigger id="profile-output">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flashcards">Flashcards</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="summary">Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-prompt">Prompt template</Label>
            <Textarea
              id="profile-prompt"
              rows={5}
              value={form.prompt_template}
              onChange={(event) => setForm((prev) => ({ ...prev, prompt_template: event.target.value }))}
            />
          </div>

          <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
            <Checkbox
              checked={form.apply_on_upload}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, apply_on_upload: checked === true }))}
            />
            <span>
              <span className="block font-medium">Run after upload</span>
              <span className="text-muted-foreground">Automatically apply this profile when a material finishes processing.</span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !form.name.trim() || !form.prompt_template.trim()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : form.id ? (
                "Save changes"
              ) : (
                "Create profile"
              )}
            </Button>
            {form.id ? (
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                disabled={deleteMutation.isPending}
                onClick={() => handleDelete(form.id!)}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
