"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardStudyFeed } from "@/components/dashboard/dashboard-study-feed";
import { StudyPlanList } from "@/components/dashboard/study-plan-list";
import { useAuth } from "@/components/providers/auth-provider";
import {
  useOnboardingQuery,
  useRefreshTodayStudyPlanMutation,
  useStudyFeedQuery,
  useStudyPlanItemMutation,
  useTodayStudyPlanQuery
} from "@/hooks/use-core-study";
import { useFlashcardStudyStatsQuery, useProgressOverviewQuery } from "@/hooks/use-billing";
import { useCoursesQuery } from "@/hooks/use-courses";
import { trackProductEvent } from "@/lib/analytics";
import type { StudyPlanAction, StudyPlanItem } from "@/lib/core-study";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

function itemHref(item: StudyPlanItem): string {
  if (item.target_id && (item.item_type === "flashcards" || item.item_type === "remediation_deck")) {
    return `/flashcards/${item.target_id}/study`;
  }
  if (item.target_id && (item.item_type === "weak_topic" || item.item_type === "remediation_retry")) {
    return `/quizzes/${item.target_id}/play`;
  }
  if (item.item_type === "remediation_explain") {
    return `/chat?context_type=study_plan&plan_item=${item.id}`;
  }
  return item.course_id ? `/courses/${item.course_id}` : "/courses";
}

export default function DashboardPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { data, isLoading, error } = useTodayStudyPlanQuery();
  const { data: feed, isLoading: feedLoading, error: feedError } = useStudyFeedQuery();
  const { data: onboarding } = useOnboardingQuery();
  const { data: courses = [], isLoading: coursesLoading } = useCoursesQuery();
  const { data: overview, isLoading: overviewLoading } = useProgressOverviewQuery();
  const { data: flashcardStats, isLoading: flashcardStatsLoading } = useFlashcardStudyStatsQuery();
  const refresh = useRefreshTodayStudyPlanMutation();
  const act = useStudyPlanItemMutation();
  const viewed = useRef(false);

  useEffect(() => {
    document.title = "Today";
  }, []);

  useEffect(() => {
    if (!data || viewed.current) return;
    viewed.current = true;
    void trackProductEvent(token, "study_plan_viewed", {
      item_count: data.items.length,
      generated: data.generated
    });
  }, [data, token]);

  const activeItems = useMemo(
    () =>
      [...(data?.items ?? [])]
        .filter((item) => item.status !== "dismissed")
        .sort((a, b) => b.priority - a.priority),
    [data]
  );

  const completedMinutes = activeItems
    .filter((item) => item.status === "completed")
    .reduce((sum, item) => sum + item.estimated_minutes, 0);
  const dailyMinutes = data?.daily_minutes ?? onboarding?.profile.daily_minutes ?? 30;
  const completedTasks = activeItems.filter((item) => item.status === "completed").length;

  const nextExam = [...courses]
    .filter((course) => course.exam_date && new Date(course.exam_date).getTime() >= Date.now())
    .sort((a, b) => new Date(a.exam_date!).getTime() - new Date(b.exam_date!).getTime())[0];

  const planCoversWeakTopics = activeItems.some(
    (item) => item.item_type === "weak_topic" || item.item_type === "remediation_retry"
  );

  async function updateItem(item: StudyPlanItem, action: StudyPlanAction) {
    try {
      await act.mutateAsync({ itemId: item.id, action });
      const eventName =
        action === "start"
          ? "study_plan_item_started"
          : action === "complete"
            ? "study_plan_item_completed"
            : "study_plan_item_dismissed";
      void trackProductEvent(token, eventName, {
        item_type: item.item_type,
        estimated_minutes: item.estimated_minutes
      });
      if (action === "complete") {
        showSuccess("Task marked complete.");
      } else if (action === "dismiss") {
        showSuccess("Task dismissed.");
      }
      if (action === "start") {
        router.push(asRoute(itemHref(item)));
      }
    } catch (err) {
      showError(err, "Failed to update study plan item.");
    }
  }

  async function refreshPlan() {
    try {
      const refreshed = await refresh.mutateAsync();
      showSuccess("Today's plan refreshed.");
      void trackProductEvent(token, "study_plan_refreshed", {
        item_count: refreshed.items.length
      });
    } catch (err) {
      showError(err, "Failed to refresh study plan.");
    }
  }

  const sidebarLoading = coursesLoading || overviewLoading || flashcardStatsLoading;
  const firstCourseId = courses[0]?.id;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {error || feedError ? (
        <p className="text-sm text-danger">
          {(error ?? feedError)?.message}
        </p>
      ) : null}

      <DashboardHero
        userName={user?.full_name}
        studyGoal={onboarding?.profile.study_goal}
        dailyMinutes={dailyMinutes}
        completedMinutes={completedMinutes}
        completedTasks={completedTasks}
        totalTasks={activeItems.length}
        nextExamTitle={nextExam?.title}
        nextExamDate={nextExam?.exam_date}
        firstCourseId={firstCourseId}
        flashcardDeckId={flashcardStats?.next_up?.deck_id}
        isRefreshing={refresh.isPending}
        onRefresh={refreshPlan}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="space-y-8">
          <StudyPlanList
            items={activeItems}
            courses={courses}
            isLoading={isLoading}
            hasCourses={courses.length > 0}
            itemHref={itemHref}
            onAction={(item, action) => void updateItem(item, action).catch(() => undefined)}
            isPending={act.isPending}
          />

          <DashboardStudyFeed
            feed={feed}
            firstCourseId={firstCourseId}
            hideWeakTopics={planCoversWeakTopics}
            isLoading={feedLoading}
          />
        </div>

        <div className="xl:sticky xl:top-6">
          <DashboardSidebar
            courses={courses}
            overview={overview}
            flashcardDue={flashcardStats?.cards_due}
            flashcardDeckId={flashcardStats?.next_up?.deck_id}
            flashcardPreview={flashcardStats?.next_up?.label}
            isLoading={sidebarLoading}
          />
        </div>
      </div>
    </div>
  );
}
