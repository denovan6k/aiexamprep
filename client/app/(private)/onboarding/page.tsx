"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, FileUp, GraduationCap, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { PageHeader } from "@/components/page-kit";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCourseWorkspaceQuery,
  useCreateOnboardingCourseMutation,
  useOnboardingQuery,
  useUpdateOnboardingMutation
} from "@/hooks/use-core-study";
import { useCoursesQuery } from "@/hooks/use-courses";
import { useMaterialStatusQuery, useUploadMaterialMutation } from "@/hooks/use-materials";
import { useGenerateQuizMutation } from "@/hooks/use-quizzes";
import {
  isProductAnalyticsEnabled,
  setProductAnalyticsEnabled,
  trackProductEvent
} from "@/lib/analytics";
import { getClientErrorMessage } from "@/lib/api";
import { showError } from "@/lib/toast";
import {
  onboardingCourseSchema,
  onboardingProfileSchema
} from "@/lib/validation";
import { asRoute, cn } from "@/lib/utils";

type ProfileFormValues = z.infer<typeof onboardingProfileSchema>;
type CourseFormValues = z.infer<typeof onboardingCourseSchema>;

function firstIncompleteStep(checklist: {
  profile: boolean;
  course: boolean;
  material: boolean;
}): 1 | 2 | 3 | 4 {
  if (!checklist.profile) return 1;
  if (!checklist.course) return 2;
  if (!checklist.material) return 3;
  return 4;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { token } = useAuth();
  const { data, isLoading, error } = useOnboardingQuery();
  const { data: courses = [] } = useCoursesQuery();
  const firstCourseId = courses[0]?.id;
  const workspace = useCourseWorkspaceQuery(firstCourseId ?? null);
  const updateProfile = useUpdateOnboardingMutation();
  const createCourse = useCreateOnboardingCourseMutation();
  const upload = useUploadMaterialMutation();
  const generateDiagnostic = useGenerateQuizMutation();
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const started = useRef(false);
  const materialStatus = useMaterialStatusQuery(materialId, {
    refetchInterval: materialId ? 2000 : false
  });

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(onboardingProfileSchema),
    mode: "onChange",
    defaultValues: { study_goal: "", daily_minutes: 30 }
  });

  const courseForm = useForm<CourseFormValues>({
    resolver: zodResolver(onboardingCourseSchema),
    mode: "onChange",
    defaultValues: { title: "", exam_date: "", confidence_level: "medium" }
  });

  useEffect(() => {
    setAnalyticsEnabled(isProductAnalyticsEnabled());
  }, []);

  useEffect(() => {
    if (!data) return;
    profileForm.reset({
      study_goal: data.profile.study_goal ?? "",
      daily_minutes: data.profile.daily_minutes
    });
    setActiveStep(firstIncompleteStep(data.checklist));
    if (data.profile.onboarding_completed_at) {
      router.replace(asRoute("/chat"));
    }
  }, [data, profileForm, router]);

  useEffect(() => {
    if (!data || started.current) return;
    started.current = true;
    void trackProductEvent(token, "onboarding_started");
  }, [data, token]);

  const completedSteps = useMemo(() => {
    if (!data) return 0;
    return [data.checklist.profile, data.checklist.course, data.checklist.material].filter(Boolean).length;
  }, [data]);

  const diagnosticMaterialId =
    materialId && materialStatus.data?.status === "processed"
      ? materialId
      : workspace.data?.materials.find((material) => material.status === "processed")?.id ?? null;

  async function onSaveProfile(values: ProfileFormValues) {
    try {
      await updateProfile.mutateAsync({
        study_goal: values.study_goal.trim(),
        daily_minutes: values.daily_minutes
      });
      setActiveStep(2);
    } catch (err) {
      showError(err, "Failed to save profile.");
    }
  }

  async function onCreateCourse(values: CourseFormValues) {
    if (data?.checklist.course) {
      setActiveStep(3);
      return;
    }
    try {
      await createCourse.mutateAsync({
        title: values.title.trim(),
        exam_date: new Date(`${values.exam_date}T12:00:00`).toISOString(),
        confidence_level: values.confidence_level
      });
      void trackProductEvent(token, "course_created", {
        has_exam_date: true,
        confidence_level: values.confidence_level
      });
      setActiveStep(3);
    } catch (err) {
      showError(err, "Failed to create course.");
    }
  }

  async function addMaterial(file: File) {
    if (!firstCourseId) return;
    try {
      const material = await upload.mutateAsync({ file, courseId: firstCourseId });
      setMaterialId(material.id);
      void trackProductEvent(token, "material_uploaded", {
        scoped_to_course: true,
        file_type: file.type || "unknown"
      });
    } catch (err) {
      showError(err, "Failed to upload material.");
    }
  }

  async function finish() {
    try {
      await updateProfile.mutateAsync({ onboarding_completed: true });
      void trackProductEvent(token, "onboarding_completed", {
        material_added: Boolean(data?.checklist.material),
        diagnostic_completed: Boolean(data?.checklist.attempt)
      });
      router.replace(asRoute("/chat"));
    } catch (err) {
      showError(err, "Failed to finish onboarding.");
    }
  }

  async function createDiagnostic() {
    if (!firstCourseId || !diagnosticMaterialId) return;
    try {
      const quiz = await generateDiagnostic.mutateAsync({
        course_id: firstCourseId,
        material_ids: [diagnosticMaterialId],
        title: `Diagnostic: ${courses[0]?.title ?? "First course"}`,
        count: 5,
        question_types: ["mcq"],
        difficulty: "medium",
        shuffle_options: true
      });
      router.push(asRoute(`/quizzes/${quiz.id}/play`));
    } catch (err) {
      showError(err, "Failed to generate diagnostic.");
    }
  }

  if (isLoading) {
    return <Skeleton className="mx-auto h-[560px] max-w-3xl rounded-xl" />;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-danger">
          {error ? getClientErrorMessage(error) : "Could not load onboarding."}
        </p>
      </div>
    );
  }

  const profileLocked = data.checklist.profile && activeStep > 1;
  const courseLocked = data.checklist.course && activeStep > 2;
  const materialLocked = data.checklist.material && activeStep > 3;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Getting started"
        title="Build your first study loop"
        description="Complete each step in order. Your progress is saved as you go."
      />
      <Progress value={(completedSteps / 3) * 100} className="mb-8" />

      <div className="space-y-4">
        <Card className={cn(activeStep !== 1 && !profileLocked && "opacity-80")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {data.checklist.profile ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Target className="h-4 w-4" />}
              1. Set your study target
            </CardTitle>
            <CardDescription>Choose a realistic daily commitment and your main goal.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-[1fr_160px]" onSubmit={profileForm.handleSubmit(onSaveProfile)} noValidate>
              <div className="space-y-2">
                <Label htmlFor="study-goal">Study goal</Label>
                <Input
                  id="study-goal"
                  placeholder="Pass my final exam"
                  aria-invalid={Boolean(profileForm.formState.errors.study_goal)}
                  disabled={profileLocked}
                  {...profileForm.register("study_goal")}
                />
                {profileForm.formState.errors.study_goal ? (
                  <p className="text-sm text-danger">{profileForm.formState.errors.study_goal.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="daily-minutes">Minutes per day</Label>
                <Input
                  id="daily-minutes"
                  type="number"
                  min={5}
                  max={480}
                  aria-invalid={Boolean(profileForm.formState.errors.daily_minutes)}
                  disabled={profileLocked}
                  {...profileForm.register("daily_minutes")}
                />
                {profileForm.formState.errors.daily_minutes ? (
                  <p className="text-sm text-danger">{profileForm.formState.errors.daily_minutes.message}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button
                  type="submit"
                  disabled={profileLocked || profileForm.formState.isSubmitting || !profileForm.formState.isValid}
                >
                  {profileForm.formState.isSubmitting ? "Saving..." : data.checklist.profile ? "Saved" : "Save and continue"}
                </Button>
                {data.checklist.profile ? (
                  <Button type="button" variant="outline" onClick={() => setActiveStep(2)}>
                    Continue to course
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className={cn(activeStep < 2 && "pointer-events-none opacity-50")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {data.checklist.course ? <CheckCircle2 className="h-4 w-4 text-success" /> : <GraduationCap className="h-4 w-4" />}
              2. Add your first course
            </CardTitle>
            <CardDescription>Exam timing and confidence help prioritize your Today plan.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.checklist.course ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">{courses[0]?.title ?? "Course created"}</p>
                  <p className="text-sm text-muted-foreground">We will not create a duplicate course.</p>
                </div>
                <div className="flex gap-2">
                  {firstCourseId ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={asRoute(`/courses/${firstCourseId}`)}>Open course</Link>
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" onClick={() => setActiveStep(3)}>
                    Continue
                  </Button>
                </div>
              </div>
            ) : (
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={courseForm.handleSubmit(onCreateCourse)} noValidate>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="course-title">Course name</Label>
                  <Input
                    id="course-title"
                    placeholder="Biology 101"
                    aria-invalid={Boolean(courseForm.formState.errors.title)}
                    disabled={!data.checklist.profile || courseLocked}
                    {...courseForm.register("title")}
                  />
                  {courseForm.formState.errors.title ? (
                    <p className="text-sm text-danger">{courseForm.formState.errors.title.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam-date">Exam date</Label>
                  <Input
                    id="exam-date"
                    type="date"
                    aria-invalid={Boolean(courseForm.formState.errors.exam_date)}
                    disabled={!data.checklist.profile || courseLocked}
                    {...courseForm.register("exam_date")}
                  />
                  {courseForm.formState.errors.exam_date ? (
                    <p className="text-sm text-danger">{courseForm.formState.errors.exam_date.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confidence">Current confidence</Label>
                  <Controller
                    control={courseForm.control}
                    name="confidence_level"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!data.checklist.profile || courseLocked}
                      >
                        <SelectTrigger id="confidence" aria-invalid={Boolean(courseForm.formState.errors.confidence_level)}>
                          <SelectValue placeholder="Select confidence" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {courseForm.formState.errors.confidence_level ? (
                    <p className="text-sm text-danger">{courseForm.formState.errors.confidence_level.message}</p>
                  ) : null}
                </div>
                {!data.checklist.profile ? (
                  <p className="sm:col-span-2 text-sm text-muted-foreground">
                    Save your study target in step 1 before creating a course.
                  </p>
                ) : null}
                <Button
                  type="submit"
                  className="sm:col-span-2 sm:w-fit"
                  disabled={
                    !data.checklist.profile ||
                    courseLocked ||
                    courseForm.formState.isSubmitting ||
                    !courseForm.formState.isValid
                  }
                >
                  {courseForm.formState.isSubmitting ? "Creating..." : "Create course"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className={cn(activeStep < 3 && "pointer-events-none opacity-50")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {data.checklist.material ? <CheckCircle2 className="h-4 w-4 text-success" /> : <FileUp className="h-4 w-4" />}
              3. Upload course material
            </CardTitle>
            <CardDescription>PDF, DOCX, PPTX, or text files are processed for course-scoped practice.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md"
              disabled={!firstCourseId || upload.isPending || materialLocked}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void addMaterial(file);
              }}
            />
            {!firstCourseId ? (
              <p className="text-sm text-muted-foreground">Create your course in step 2 before uploading material.</p>
            ) : null}
            {upload.isPending ? <p className="text-sm text-muted-foreground">Uploading material...</p> : null}
            {materialStatus.data ? (
              <p className="text-sm text-muted-foreground">
                Processing status: <span className="font-medium text-foreground">{materialStatus.data.status}</span>
                {materialStatus.data.chunk_count ? ` · ${materialStatus.data.chunk_count} sections` : ""}
              </p>
            ) : null}
            {data.checklist.material ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveStep(4)}>
                Continue to diagnostic
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className={cn(activeStep < 4 && "pointer-events-none opacity-50")}>
          <CardHeader>
            <CardTitle className="text-base">4. Take a quick diagnostic</CardTitle>
            <CardDescription>
              Generate a short quiz from the uploaded material, then submit it to calibrate your plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              disabled={!diagnosticMaterialId || generateDiagnostic.isPending}
              onClick={() => void createDiagnostic()}
            >
              {generateDiagnostic.isPending ? "Generating diagnostic..." : "Generate diagnostic"}
            </Button>
            <Button asChild variant="outline">
              <Link href={asRoute(firstCourseId ? `/chat?course_id=${firstCourseId}` : "/chat")}>
                Customize in chat
              </Link>
            </Button>
            {!diagnosticMaterialId && data.checklist.material ? (
              <p className="w-full text-sm text-muted-foreground">
                Finish processing the uploaded material before generating the diagnostic.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <label className="flex items-start gap-3 rounded-lg border p-4 text-sm">
          <Checkbox
            checked={analyticsEnabled}
            onCheckedChange={(checked) => {
              const enabled = checked === true;
              setAnalyticsEnabled(enabled);
              setProductAnalyticsEnabled(enabled);
              if (enabled) void trackProductEvent(token, "onboarding_started");
            }}
          />
          <span>
            Share anonymous product usage analytics. This is optional and excludes course names, files,
            study content, and account details.
          </span>
        </label>

        <div className="flex justify-end">
          <Button
            onClick={() => void finish()}
            disabled={
              updateProfile.isPending ||
              !data.checklist.profile ||
              !data.checklist.course ||
              !data.checklist.material
            }
          >
            Finish setup
          </Button>
        </div>
      </div>
    </div>
  );
}
