import { apiRequest } from "@/lib/api";
import type { Course } from "@/lib/study";

export type ConfidenceLevel = "low" | "medium" | "high";

export type OnboardingChecklist = {
  profile: boolean;
  course: boolean;
  material: boolean;
  quiz: boolean;
  attempt: boolean;
  complete: boolean;
};

export type OnboardingState = {
  profile: {
    daily_minutes: number;
    study_goal: string | null;
    onboarding_completed_at: string | null;
  };
  checklist: OnboardingChecklist;
};

export type OnboardingProfilePatch = {
  daily_minutes?: number;
  study_goal?: string;
  onboarding_completed?: boolean;
};

export type OnboardingCourseInput = {
  title: string;
  description?: string;
  exam_date?: string;
  confidence_level?: ConfidenceLevel;
};

export type WorkspaceResource = {
  id: string;
  title: string;
  status: string | null;
  count: number | null;
  updated_at: string | null;
};

export type CourseWorkspace = {
  course_id: string;
  title: string;
  confidence_level: string | null;
  exam_date: string | null;
  materials: WorkspaceResource[];
  quizzes: WorkspaceResource[];
  flashcard_decks: WorkspaceResource[];
  progress: Record<string, unknown>;
};

export type StudyPlanAction = "start" | "complete" | "dismiss";

export type StudyPlanItemCreate = {
  title: string;
  estimated_minutes?: number;
  item_type?: "custom" | "flashcards" | "weak_topic" | "course_review";
  course_id?: string | null;
  topic?: string | null;
  target_id?: string | null;
};

export type StudyPlanItem = {
  id: string;
  course_id: string | null;
  plan_date: string;
  item_type: string;
  title: string;
  topic: string | null;
  target_id: string | null;
  estimated_minutes: number;
  priority: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  dismissed_at: string | null;
};

export type TodayStudyPlan = {
  date: string;
  daily_minutes: number;
  generated: boolean;
  items: StudyPlanItem[];
};

export type FeedResourceMeta = {
  question_count?: number | null;
  card_count?: number | null;
  status?: string | null;
  score_pct?: number | null;
  file_name?: string | null;
  chunk_count?: number | null;
};

export type FeedResourceItem = {
  kind: "quiz" | "deck" | "material";
  id: string;
  title: string;
  course_id: string | null;
  course_title: string | null;
  last_activity_at: string;
  activity_label: string;
  meta: FeedResourceMeta;
  preview: string[];
  href: string;
};

export type CourseSummary = {
  id: string;
  title: string;
  exam_date: string | null;
};

export type StudyFeed = {
  next_exam: CourseSummary | null;
  exam_items: FeedResourceItem[];
  recent_items: FeedResourceItem[];
  weak_topics: { topic: string; score_pct: number }[];
  recommendations: string[];
};

export type RemediationAction = "deck" | "retry" | "explain";

export type RemediationResult = {
  attempt_id: string;
  action: RemediationAction;
  topics: string[];
  status: string;
  resource_id: string | null;
  url: string;
  context: Record<string, unknown>;
};

export type RemediationOptions = {
  attempt_id: string;
  weak_topics: string[];
  available_actions: RemediationAction[];
  existing: RemediationResult[];
};

export function getOnboarding(token: string) {
  return apiRequest<OnboardingState>("/onboarding", { token });
}

export function updateOnboarding(token: string, patch: OnboardingProfilePatch) {
  return apiRequest<OnboardingState>("/onboarding", {
    method: "PATCH",
    token,
    body: JSON.stringify(patch)
  });
}

export function createOnboardingCourse(token: string, input: OnboardingCourseInput) {
  return apiRequest<Course>("/onboarding/course", {
    method: "POST",
    token,
    body: JSON.stringify(input)
  });
}

export function getCourseWorkspace(token: string, courseId: string) {
  return apiRequest<CourseWorkspace>(`/courses/${courseId}/workspace`, { token });
}

export function getTodayStudyPlan(token: string) {
  return apiRequest<TodayStudyPlan>("/study/today", { token });
}

export function getStudyFeed(token: string) {
  return apiRequest<StudyFeed>("/study/feed", { token });
}

export function refreshTodayStudyPlan(token: string) {
  return apiRequest<TodayStudyPlan>("/study/today/refresh", { method: "POST", token });
}

export function updateStudyPlanItem(token: string, itemId: string, action: StudyPlanAction) {
  return apiRequest<StudyPlanItem>(`/study/plan-items/${itemId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ action })
  });
}

export function createStudyPlanItem(token: string, input: StudyPlanItemCreate) {
  return apiRequest<StudyPlanItem>("/study/plan-items", {
    method: "POST",
    token,
    body: JSON.stringify(input)
  });
}

export function getRemediationOptions(token: string, attemptId: string) {
  return apiRequest<RemediationOptions>(`/quizzes/attempts/${attemptId}/remediation`, { token });
}

export function createRemediation(
  token: string,
  attemptId: string,
  action: RemediationAction,
  topics: string[] = []
) {
  return apiRequest<RemediationResult>(`/quizzes/attempts/${attemptId}/remediation`, {
    method: "POST",
    token,
    body: JSON.stringify({ action, topics })
  });
}
