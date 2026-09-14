"use client";

import Link from "next/link";
import { useState } from "react";
import { Filter, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { SearchFiltersSkeleton } from "@/components/search/search-filters-skeleton";
import type { MaterialSummary } from "@/lib/materials";
import type { Course } from "@/lib/study";
import { ALL_COURSES } from "@/lib/search-url";
import { asRoute } from "@/lib/utils";

type SearchFiltersPanelProps = {
  courses: Course[];
  coursesLoading: boolean;
  selectedCourseId: string | null;
  selectedMaterialIds: string[];
  processedMaterials: MaterialSummary[];
  materialsLoading: boolean;
  hasActiveFilters: boolean;
  onCourseChange: (value: string) => void;
  onToggleMaterial: (materialId: string) => void;
  onClearFilters: () => void;
};

function MaterialFilters({
  selectedCourseId,
  processedMaterials,
  materialsLoading,
  selectedMaterialIds,
  onToggleMaterial
}: Pick<
  SearchFiltersPanelProps,
  "selectedCourseId" | "processedMaterials" | "materialsLoading" | "selectedMaterialIds" | "onToggleMaterial"
>) {
  if (!selectedCourseId) return null;

  if (materialsLoading) {
    return <SearchFiltersSkeleton />;
  }

  if (processedMaterials.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No processed materials in this course yet.{" "}
        <Link
          href={asRoute(`/courses/${selectedCourseId}?tab=materials`)}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Upload in workspace
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {processedMaterials.map((material) => {
        const selected = selectedMaterialIds.includes(material.id);
        return (
          <Button
            key={material.id}
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            onClick={() => onToggleMaterial(material.id)}
          >
            {material.title}
          </Button>
        );
      })}
    </div>
  );
}

export function SearchFiltersPanel({
  courses,
  coursesLoading,
  selectedCourseId,
  selectedMaterialIds,
  processedMaterials,
  materialsLoading,
  hasActiveFilters,
  onCourseChange,
  onToggleMaterial,
  onClearFilters
}: SearchFiltersPanelProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 w-full flex-1 space-y-1.5 sm:max-w-xs">
          <Label htmlFor="search-course" className="text-xs text-muted-foreground">
            Course scope
          </Label>
          <Select
            value={selectedCourseId ?? ALL_COURSES}
            onValueChange={onCourseChange}
            disabled={coursesLoading}
          >
            <SelectTrigger id="search-course" className="w-full">
              <SelectValue placeholder="All courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_COURSES}>All courses</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCourseId ? (
          <>
            <div className="hidden flex-1 flex-wrap gap-2 md:flex">
              <MaterialFilters
                selectedCourseId={selectedCourseId}
                processedMaterials={processedMaterials}
                materialsLoading={materialsLoading}
                selectedMaterialIds={selectedMaterialIds}
                onToggleMaterial={onToggleMaterial}
              />
            </div>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-2 md:hidden">
                  <Filter className="h-4 w-4" />
                  Materials
                  {selectedMaterialIds.length > 0 ? (
                    <Badge variant="secondary" className="ml-1">
                      {selectedMaterialIds.length}
                    </Badge>
                  ) : null}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter materials</SheetTitle>
                  <SheetDescription>Limit search to specific files in this course.</SheetDescription>
                </SheetHeader>
                <div className="mt-4">
                  <MaterialFilters
                    selectedCourseId={selectedCourseId}
                    processedMaterials={processedMaterials}
                    materialsLoading={materialsLoading}
                    selectedMaterialIds={selectedMaterialIds}
                    onToggleMaterial={onToggleMaterial}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </>
        ) : null}

        {hasActiveFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters} className="gap-2">
            <X className="h-4 w-4" />
            Clear
          </Button>
        ) : null}
      </div>

      {selectedMaterialIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedMaterialIds.map((materialId) => {
            const material = processedMaterials.find((item) => item.id === materialId);
            return (
              <Badge key={materialId} variant="secondary">
                {material?.title ?? materialId}
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
