"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCap, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";

import { SettingsCardFieldsSkeleton } from "@/components/settings/settings-card-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboardingQuery, useUpdateOnboardingMutation } from "@/hooks/use-core-study";
import { getClientErrorMessage } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";
import { onboardingProfileSchema } from "@/lib/validation";
import { asRoute } from "@/lib/utils";

type ProfileFormValues = z.infer<typeof onboardingProfileSchema>;

export function StudyPreferencesCard() {
  const { data, isLoading, error: loadError } = useOnboardingQuery();
  const updateMutation = useUpdateOnboardingMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty, isValid }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(onboardingProfileSchema),
    mode: "onChange",
    defaultValues: { study_goal: "", daily_minutes: 30 }
  });

  useEffect(() => {
    if (data?.profile) {
      reset({
        study_goal: data.profile.study_goal ?? "",
        daily_minutes: data.profile.daily_minutes ?? 30
      });
    }
  }, [data, reset]);

  const error = loadError ? getClientErrorMessage(loadError, "Failed to load study preferences.") : null;

  function handleSave(values: ProfileFormValues) {
    updateMutation.mutate(
      {
        study_goal: values.study_goal,
        daily_minutes: values.daily_minutes
      },
      {
        onSuccess: () => {
          showSuccess("Study preferences updated.");
        },
        onError: (err) => {
          showError(err, "Failed to update study preferences.");
        }
      }
    );
  }

  const isChecklistIncomplete = data ? !data.checklist.complete : false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Study preferences</CardTitle>
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardDescription>
          Adjust your target daily study time and set goals for your courses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {isChecklistIncomplete && (
          <Alert variant="warning" className="border-warning/30 bg-warning/10 text-warning-foreground">
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>Your onboarding checklist is incomplete.</span>
              <Button asChild size="sm" variant="outline" className="h-7 border-warning/30 hover:bg-warning/20">
                <Link href={asRoute("/onboarding")}>Complete setup</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <SettingsCardFieldsSkeleton />
        ) : (
          <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="daily-minutes">Daily minutes (5–480)</Label>
                <Input
                  id="daily-minutes"
                  type="number"
                  {...register("daily_minutes", { valueAsNumber: true })}
                  aria-invalid={Boolean(errors.daily_minutes)}
                />
                {errors.daily_minutes ? (
                  <p className="text-sm text-danger">{errors.daily_minutes.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="study-goal">Study goal</Label>
                <Input
                  id="study-goal"
                  placeholder="Pass my chemistry board exams"
                  {...register("study_goal")}
                  aria-invalid={Boolean(errors.study_goal)}
                />
                {errors.study_goal ? (
                  <p className="text-sm text-danger">{errors.study_goal.message}</p>
                ) : null}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !isDirty || !isValid || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save preferences"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
