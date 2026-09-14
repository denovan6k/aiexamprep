"use client";

import {
  FileText,
  FolderOpen,
  Plus,
  Search
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { CourseCard } from "@/components/courses/course-card";
import { CoursesQuickActions } from "@/components/courses/courses-quick-actions";
import { CreateCourseDialog } from "@/components/courses/create-course-dialog";
import { MaterialCard } from "@/components/materials/material-card";
import { PageHeader, SectionGrid, SectionTitle, StatStrip } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoursesQuery } from "@/hooks/use-courses";
import { useListPageState } from "@/hooks/use-list-page-state";
import { useMaterialsQuery } from "@/hooks/use-materials";
import { asRoute } from "@/lib/utils";

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function CoursesPage() {
  const { data: courses = [], isLoading, error } = useCoursesQuery();
  const listState = useListPageState();
  const {
    data: materialsData,
    isLoading: isLoadingMaterials,
    error: materialsError
  } = useMaterialsQuery({
    limit: listState.limit,
    offset: listState.offset,
    q: listState.query || undefined,
    status: listState.status || undefined,
    courseId: listState.courseId || undefined,
    source: listState.source || undefined
  });
  const { data: processedMaterialsData } = useMaterialsQuery({
    limit: 1,
    offset: 0,
    status: "processed"
  });

  const materials = materialsData?.items ?? [];
  const materialsTotal = materialsData?.total ?? 0;
  const processedTotal = processedMaterialsData?.total ?? 0;
  const firstCourseId = courses[0]?.id ?? null;

  const nextExam = useMemo(
    () =>
      [...courses]
        .filter((course) => course.exam_date && new Date(course.exam_date).getTime() >= Date.now())
        .sort((a, b) => new Date(a.exam_date!).getTime() - new Date(b.exam_date!).getTime())[0],
    [courses]
  );

  const nextExamDays = nextExam?.exam_date ? daysUntil(nextExam.exam_date) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background p-4 shadow-sm sm:p-5">
        <PageHeader
          eyebrow="Courses"
          title="Your study library"
          description="Organize materials, quizzes, and flashcards by course. Upload files, search notes, and generate practice from one workspace."
          actions={
            <CreateCourseDialog
              trigger={
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add course
                </Button>
              }
            />
          }
        />

        <StatStrip
          items={[
            {
              label: "Courses",
              value: isLoading ? "—" : String(courses.length)
            },
            {
              label: "Materials",
              value: isLoadingMaterials ? "—" : String(materialsTotal)
            },
            {
              label: "Searchable",
              value: isLoading ? "—" : String(processedTotal),
              tone: "success",
              hint: "Ready for search"
            },
            {
              label: "Next exam",
              value: isLoading
                ? "—"
                : nextExam
                  ? nextExamDays !== null && nextExamDays <= 14
                    ? `${nextExamDays}d`
                    : new Date(nextExam.exam_date!).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric"
                      })
                  : "None",
              tone: nextExamDays !== null && nextExamDays <= 7 ? "warning" : "default",
              hint: nextExam?.title
            }
          ]}
        />

        <div className="mt-4">
          <CoursesQuickActions firstCourseId={firstCourseId} />
        </div>
      </section>

      {error ? <p className="text-sm text-danger">{error.message}</p> : null}

      <SectionTitle
        title="Course workspaces"
        description="Each course groups materials, generated quizzes, flashcards, and scoped chat."
      />

      {isLoading ? (
        <SectionGrid>
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-52 w-full rounded-xl" />
          ))}
        </SectionGrid>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No courses yet"
          description="Create a course to group your study materials and generated content."
          action={
            <CreateCourseDialog
              trigger={
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create your first course
                </Button>
              }
            />
          }
        />
      ) : (
        <SectionGrid>
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </SectionGrid>
      )}

      <SectionTitle
        title="Materials library"
        description="Browse course uploads and chat attachments. Preview, filter, or jump back into the related thread."
      />

      <ListToolbar
        searchValue={listState.searchInput}
        onSearchValueChange={listState.setSearchInput}
        onSearchSubmit={listState.applySearch}
        searchPlaceholder="Search materials by title or filename..."
      >
        {courses.length > 0 ? (
          <Select value={listState.courseId || "__all__"} onValueChange={(value) => listState.updateCourseId(value === "__all__" ? "" : value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All courses</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select value={listState.source || "__all__"} onValueChange={(value) => listState.updateSource(value === "__all__" ? "" : value)}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All sources</SelectItem>
            <SelectItem value="material">Courses</SelectItem>
            <SelectItem value="chat">Chat</SelectItem>
          </SelectContent>
        </Select>
        <Select value={listState.status || "__all__"} onValueChange={(value) => listState.updateStatus(value === "__all__" ? "" : value)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="uploaded">Uploaded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Button asChild variant="outline" size="default">
          <Link href={asRoute("/search")} className="gap-2">
            <Search className="h-4 w-4" />
            Search all
          </Link>
        </Button>
      </ListToolbar>

      {materialsError ? <p className="mb-4 text-sm text-danger">{materialsError.message}</p> : null}
      {isLoadingMaterials ? (
        <div className="space-y-2">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            listState.query || listState.status || listState.courseId || listState.source
              ? "No materials match your filters"
              : "No materials yet"
          }
          description={
            listState.query || listState.status || listState.courseId || listState.source
              ? "Try different filters or clear them."
              : "Upload files in chat or from a course workspace, then search or ask questions against them."
          }
          action={
            listState.query || listState.status || listState.courseId || listState.source ? (
              <Button variant="outline" onClick={listState.resetFilters}>
                Clear filters
              </Button>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href={asRoute("/chat")}>Upload in chat</Link>
                </Button>
                {firstCourseId ? (
                  <Button asChild variant="outline">
                    <Link href={asRoute(`/courses/${firstCourseId}?tab=materials`)}>Upload to course</Link>
                  </Button>
                ) : null}
              </div>
            )
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {materials.map((material) => {
              const course = courses.find((item) => item.id === material.course_id);
              return (
                <MaterialCard
                  key={material.id}
                  material={material}
                  variant="row"
                  courseTitle={course?.title}
                  showCourseChat={Boolean(course)}
                  courseId={course?.id}
                />
              );
            })}
          </div>
          <PaginationControls
            className="mt-6"
            total={materialsTotal}
            limit={listState.limit}
            offset={listState.offset}
            onPageChange={listState.setOffset}
          />
        </>
      )}
    </div>
  );
}
