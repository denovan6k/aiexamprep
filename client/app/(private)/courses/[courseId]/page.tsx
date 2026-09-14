"use client";

import {
  BarChart3,
  BookOpen,
  CalendarDays,
  FileText,
  Layers,
  MessageSquare,
  Upload
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

import { MaterialCard } from "@/components/materials/material-card";
import { MaterialPreviewDialog } from "@/components/materials/material-preview-dialog";
import { MaterialUploadPanel } from "@/components/materials/material-upload-panel";
import { PageHeader, SectionGrid, Stat } from "@/components/page-kit";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useCourseWorkspaceQuery } from "@/hooks/use-core-study";
import { useFlashcardDecksQuery } from "@/hooks/use-flashcards";
import { useListPageState } from "@/hooks/use-list-page-state";
import { useMaterialsQuery, useUploadMaterialMutation } from "@/hooks/use-materials";
import { useQuizzesQuery } from "@/hooks/use-quizzes";
import { trackProductEvent } from "@/lib/analytics";
import { materialFileTypeLabel } from "@/lib/materials";
import { asRoute, cn } from "@/lib/utils";

const tabs = ["overview", "materials", "practice", "progress"] as const;
type WorkspaceTab = (typeof tabs)[number];

function CourseWorkspaceContent() {
  const { token } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: WorkspaceTab = tabs.includes(requestedTab as WorkspaceTab)
    ? (requestedTab as WorkspaceTab)
    : "overview";
  const workspace = useCourseWorkspaceQuery(courseId);
  const materialsListState = useListPageState();
  const materials = useMaterialsQuery({
    courseId,
    limit: materialsListState.limit,
    offset: materialsListState.offset,
    q: materialsListState.query || undefined,
    status: materialsListState.status || undefined
  });
  const quizzes = useQuizzesQuery({ course_id: courseId, limit: 100, offset: 0 });
  const decks = useFlashcardDecksQuery({ course_id: courseId, limit: 100, offset: 0 });
  const upload = useUploadMaterialMutation();
  const data = workspace.data;
  const viewed = useRef(false);

  useEffect(() => {
    if (!data || viewed.current) return;
    viewed.current = true;
    void trackProductEvent(token, "course_workspace_viewed", {
      material_count: data.materials.length,
      quiz_count: data.quizzes.length,
      deck_count: data.flashcard_decks.length
    });
  }, [data, token]);

  if (workspace.isLoading || !data) {
    return <Skeleton className="mx-auto h-[520px] max-w-6xl rounded-xl" />;
  }

  const error = workspace.error ?? materials.error ?? quizzes.error ?? decks.error ?? upload.error;
  const materialItems = materials.data?.items ?? [];
  const materialsTotal = materials.data?.total ?? 0;
  const quizItems = quizzes.data?.items ?? [];
  const deckItems = decks.data?.items ?? [];
  const hasMaterialFilters = Boolean(materialsListState.query || materialsListState.status);

  async function handleUpload(file: File) {
    await upload.mutateAsync({ file, courseId });
    void trackProductEvent(token, "material_uploaded", {
      scoped_to_course: true,
      file_type: file.type || "unknown"
    });
  }

  const subtitle = [
    data.exam_date ? `Exam ${new Date(data.exam_date).toLocaleDateString()}` : "No exam date",
    data.confidence_level ? `${data.confidence_level} confidence` : null
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background p-4 shadow-sm sm:p-5">
        <PageHeader
          eyebrow="Course workspace"
          title={data.title}
          description={subtitle}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link href={asRoute(`/courses/${courseId}?tab=materials`)}>
                  <Upload className="h-4 w-4" />
                  Upload
                </Link>
              </Button>
              <Button asChild size="sm" className="gap-2">
                <Link href={asRoute(`/chat?course_id=${courseId}`)}>
                  <MessageSquare className="h-4 w-4" />
                  Course chat
                </Link>
              </Button>
            </div>
          }
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {data.exam_date ? (
            <Badge variant="outline" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(data.exam_date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric"
              })}
            </Badge>
          ) : null}
          {data.confidence_level ? (
            <Badge variant="secondary" className="capitalize">
              {data.confidence_level} confidence
            </Badge>
          ) : null}
          <Badge variant="outline">{materialItems.length} materials</Badge>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2 border-b pb-3" aria-label="Course sections">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={asRoute(`/courses/${courseId}?tab=${tab}`)}
            onClick={() => {
              if (tab !== activeTab) {
                void trackProductEvent(token, "course_workspace_tab_changed", { tab });
              }
            }}
            className={cn(
              buttonVariants({ variant: activeTab === tab ? "default" : "ghost", size: "sm" }),
              "capitalize"
            )}
          >
            {tab}
          </Link>
        ))}
      </nav>

      {error ? <p className="text-sm text-danger">{error.message}</p> : null}

      {activeTab === "overview" ? (
        <>
          <SectionGrid cols={3}>
            <Stat label="Materials" value={String(materialItems.length)} icon={FileText} />
            <Stat label="Quizzes" value={String(quizItems.length)} icon={BookOpen} tone="success" />
            <Stat label="Flashcard decks" value={String(deckItems.length)} icon={Layers} tone="warning" />
          </SectionGrid>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Course materials</CardTitle>
                <CardDescription>
                  Upload notes and readings, then preview, download, or search within each file.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {materials.isLoading ? (
                  <Skeleton className="h-32 rounded-xl" />
                ) : materialItems.length ? (
                  <div className="space-y-2">
                    {materialItems.slice(0, 4).map((material) => (
                      <div
                        key={material.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{material.title || material.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {materialFileTypeLabel(material)} · {material.status} · {material.chunk_count} sections
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <MaterialPreviewDialog
                            material={material}
                            trigger={
                              <Button type="button" variant="ghost" size="sm">
                                Preview
                              </Button>
                            }
                          />
                          <Button asChild variant="ghost" size="sm">
                            <Link href={asRoute(`/courses/${courseId}?tab=materials`)}>Manage</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                    {materialItems.length > 4 ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={asRoute(`/courses/${courseId}?tab=materials`)}>
                          View all {materialItems.length} materials
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title="No materials yet"
                    description="Upload your first source file to start generating practice from this course."
                    action={
                      <Button asChild size="sm">
                        <Link href={asRoute(`/courses/${courseId}?tab=materials`)}>Upload material</Link>
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Next steps</CardTitle>
                <CardDescription>Keep the study loop moving inside this course.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button asChild variant="outline" className="justify-start">
                  <Link href={asRoute(`/courses/${courseId}?tab=materials`)}>Upload or manage materials</Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href={asRoute(`/chat?course_id=${courseId}`)}>Generate practice in chat</Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href={asRoute(`/search?course_id=${courseId}`)}>Search course content</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {activeTab === "materials" ? (
        <div className="space-y-6">
          <MaterialUploadPanel
            onUpload={handleUpload}
            isUploading={upload.isPending}
            description="Files uploaded here are scoped to this course for chat, search, and practice generation."
          />

          <ListToolbar
            searchValue={materialsListState.searchInput}
            onSearchValueChange={materialsListState.setSearchInput}
            onSearchSubmit={materialsListState.applySearch}
            searchPlaceholder="Search by title or filename..."
          >
            <Select
              value={materialsListState.status || "__all__"}
              onValueChange={(value) => materialsListState.updateStatus(value === "__all__" ? "" : value)}
            >
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
          </ListToolbar>

          {materials.isLoading ? (
            <SectionGrid cols={2}>
              {[1, 2].map((item) => (
                <Skeleton key={item} className="h-52 rounded-xl" />
              ))}
            </SectionGrid>
          ) : materialItems.length ? (
            <>
              <SectionGrid cols={2}>
                {materialItems.map((material) => (
                  <MaterialCard key={material.id} material={material} courseId={courseId} />
                ))}
              </SectionGrid>
              <PaginationControls
                className="mt-2"
                total={materialsTotal}
                limit={materialsListState.limit}
                offset={materialsListState.offset}
                onPageChange={materialsListState.setOffset}
              />
            </>
          ) : (
            <EmptyState
              icon={FileText}
              title={hasMaterialFilters ? "No materials match your filters" : "No course materials"}
              description={
                hasMaterialFilters
                  ? "Try different filters or clear them."
                  : "Upload PDFs, slides, or notes to build your course library."
              }
              action={
                hasMaterialFilters ? (
                  <Button variant="outline" onClick={materialsListState.resetFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      ) : null}

      {activeTab === "practice" ? (
        <div className="space-y-8">
          <section>
            <h2 className="mb-4 text-lg font-medium">Quizzes</h2>
            {quizItems.length ? (
              <SectionGrid cols={2}>
                {quizItems.map((quiz) => (
                  <Card key={quiz.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{quiz.title}</CardTitle>
                      <CardDescription>
                        {quiz.question_count} questions · {quiz.status}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button asChild size="sm">
                        <Link href={asRoute(`/quizzes/${quiz.id}/play`)}>Start quiz</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </SectionGrid>
            ) : (
              <p className="text-sm text-muted-foreground">No quizzes in this course yet.</p>
            )}
          </section>
          <section>
            <h2 className="mb-4 text-lg font-medium">Flashcard decks</h2>
            {deckItems.length ? (
              <SectionGrid cols={2}>
                {deckItems.map((deck) => (
                  <Card key={deck.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{deck.title}</CardTitle>
                      <CardDescription>{deck.card_count} cards</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button asChild variant="outline" size="sm">
                        <Link href={asRoute(`/flashcards/${deck.id}/study`)}>Study deck</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </SectionGrid>
            ) : (
              <p className="text-sm text-muted-foreground">No flashcard decks in this course yet.</p>
            )}
          </section>
        </div>
      ) : null}

      {activeTab === "progress" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" /> Course progress
            </CardTitle>
            <CardDescription>Signals calculated from course-scoped attempts and review activity.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {Object.entries(data.progress).map(([key, value]) => (
              <div key={key} className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {key.replaceAll("_", " ")}
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {Array.isArray(value) ? value.length : typeof value === "object" ? "—" : String(value)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function CourseWorkspacePage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[520px] max-w-6xl rounded-xl" />}>
      <CourseWorkspaceContent />
    </Suspense>
  );
}
