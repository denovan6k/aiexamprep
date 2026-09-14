"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ALL_COURSES } from "@/lib/search-url";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCoursesQuery } from "@/hooks/use-courses";
import { useMaterialsQuery } from "@/hooks/use-materials";
import { useAskMaterialsStreamMutation, useSearchMaterialsQuery } from "@/hooks/use-search";
import { getClientErrorMessage } from "@/lib/api";
import type { AskSearchResponse } from "@/lib/search";
import { buildSearchHref, buildSearchParams, parseMaterialIds } from "@/lib/search-url";
import { SEARCH_FETCH_LIMIT } from "@/lib/search-results";

export type StudySearchMode = "search" | "ask";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_SEARCH_QUERY_LENGTH = 2;

export function useStudySearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialCourseId = searchParams.get("course_id");
  const initialMaterialIds = parseMaterialIds(searchParams.get("material_ids"));
  const initialQuery = searchParams.get("q") ?? "";

  const courses = useCoursesQuery();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(initialCourseId);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(initialMaterialIds);
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<StudySearchMode>("search");
  const [answer, setAnswer] = useState<AskSearchResponse | null>(null);
  const [immediateQuery, setImmediateQuery] = useState<string | null>(
    initialQuery.trim().length >= MIN_SEARCH_QUERY_LENGTH ? initialQuery.trim() : null
  );

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const trimmedQuery = query.trim();
  const debouncedTrimmed = debouncedQuery.trim();

  // Prefer an explicit immediate search (Enter / example prompt); otherwise wait for debounce.
  const activeSearchQuery = (immediateQuery ?? debouncedTrimmed).trim();

  useEffect(() => {
    if (immediateQuery === null) return;
    if (debouncedTrimmed === immediateQuery) {
      setImmediateQuery(null);
    }
  }, [debouncedTrimmed, immediateQuery]);

  const materials = useMaterialsQuery({
    courseId: selectedCourseId ?? undefined,
    limit: 100,
    offset: 0
  });

  const allMaterials = useMaterialsQuery({
    limit: 100,
    offset: 0,
    status: "processed"
  });

  const processedMaterials = useMemo(
    () =>
      (materials.data?.items ?? []).filter(
        (material) => material.status === "processed" && (material.chunk_count ?? 0) > 0
      ),
    [materials.data?.items]
  );

  const courseTitle = selectedCourseId
    ? courses.data?.find((course) => course.id === selectedCourseId)?.title ?? null
    : null;

  const searchableInScope = selectedCourseId
    ? processedMaterials.length
    : (allMaterials.data?.items ?? []).filter(
        (material) => material.status === "processed" && (material.chunk_count ?? 0) > 0
      ).length;

  const shouldSearch =
    mode === "search" && activeSearchQuery.length >= MIN_SEARCH_QUERY_LENGTH;

  const searchRequest = shouldSearch
    ? {
        query: activeSearchQuery,
        course_id: selectedCourseId,
        material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds : undefined,
        limit: SEARCH_FETCH_LIMIT
      }
    : null;

  const searchQuery = useSearchMaterialsQuery(searchRequest);
  const askStreamMutation = useAskMaterialsStreamMutation();

  const urlStateRef = useRef({ selectedCourseId, selectedMaterialIds, query });
  urlStateRef.current = { selectedCourseId, selectedMaterialIds, query };

  const replaceSearchUrl = useCallback(
    (overrides?: Partial<{ courseId: string | null; materialIds: string[]; q: string }>) => {
      const state = urlStateRef.current;
      const nextState = {
        courseId: overrides?.courseId !== undefined ? overrides.courseId : state.selectedCourseId,
        materialIds: overrides?.materialIds ?? state.selectedMaterialIds,
        q: overrides?.q !== undefined ? overrides.q : state.query
      };
      const nextParams = buildSearchParams(nextState).toString();
      if (nextParams === searchParams.toString()) return;
      router.replace(buildSearchHref(nextState), { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (mode !== "search") return;
    if (activeSearchQuery.length < MIN_SEARCH_QUERY_LENGTH) {
      if (!trimmedQuery) replaceSearchUrl({ q: "" });
      return;
    }
    replaceSearchUrl({ q: activeSearchQuery });
  }, [activeSearchQuery, mode, replaceSearchUrl, trimmedQuery]);

  useEffect(() => {
    if (!selectedCourseId || materials.isLoading) return;
    const validIds = new Set(processedMaterials.map((material) => material.id));
    const filtered = selectedMaterialIds.filter((id) => validIds.has(id));
    if (filtered.length === selectedMaterialIds.length) return;
    setSelectedMaterialIds(filtered);
    replaceSearchUrl({ materialIds: filtered });
  }, [materials.isLoading, processedMaterials, replaceSearchUrl, selectedCourseId, selectedMaterialIds]);

  const handleCourseChange = useCallback(
    (value: string) => {
      const nextCourseId = value === ALL_COURSES ? null : value;
      setSelectedCourseId(nextCourseId);
      setSelectedMaterialIds([]);
      setAnswer(null);
      replaceSearchUrl({ courseId: nextCourseId, materialIds: [] });
    },
    [replaceSearchUrl]
  );

  const toggleMaterial = useCallback(
    (materialId: string) => {
      setSelectedMaterialIds((current) => {
        const next = current.includes(materialId)
          ? current.filter((id) => id !== materialId)
          : [...current, materialId];
        replaceSearchUrl({ materialIds: next });
        return next;
      });
    },
    [replaceSearchUrl]
  );

  const clearFilters = useCallback(() => {
    setSelectedCourseId(null);
    setSelectedMaterialIds([]);
    replaceSearchUrl({ courseId: null, materialIds: [] });
  }, [replaceSearchUrl]);

  const handleQueryChange = useCallback((value: string) => {
    setImmediateQuery(null);
    setQuery(value);
    if (!value.trim()) {
      setAnswer(null);
    }
  }, []);

  const runImmediateSearch = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      setQuery(prompt);
      if (trimmed.length >= MIN_SEARCH_QUERY_LENGTH) {
        setImmediateQuery(trimmed);
      } else {
        setImmediateQuery(null);
      }
      replaceSearchUrl({ q: trimmed });
    },
    [replaceSearchUrl]
  );

  const applyPrompt = useCallback(
    (prompt: string) => {
      if (mode === "search") {
        runImmediateSearch(prompt);
        return;
      }

      setQuery(prompt);
      setAnswer(null);
      askStreamMutation.reset();
      const nextAnswer: AskSearchResponse = {
        query: prompt,
        plan: [],
        answer: "",
        citations: [],
        token_estimate: 0,
        truncated: false,
        used_fallback: false
      };
      setAnswer(nextAnswer);
      askStreamMutation.mutate(
        {
          request: {
            query: prompt,
            course_id: selectedCourseId,
            material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds : undefined,
            limit: 8,
            max_subqueries: 3
          },
          onEvent: (streamEvent) => {
            if (streamEvent.type === "retrieval_plan") {
              nextAnswer.plan = streamEvent.plan;
            } else if (streamEvent.type === "answer") {
              nextAnswer.answer = streamEvent.answer;
              nextAnswer.used_fallback = streamEvent.used_fallback;
            } else if (streamEvent.type === "citations") {
              nextAnswer.citations = streamEvent.citations;
              nextAnswer.token_estimate = streamEvent.token_estimate;
              nextAnswer.truncated = streamEvent.truncated;
            }
            setAnswer({ ...nextAnswer });
          }
        },
        {
          onError: () => setAnswer(null)
        }
      );
      replaceSearchUrl({ q: prompt });
    },
    [askStreamMutation, mode, replaceSearchUrl, runImmediateSearch, selectedCourseId, selectedMaterialIds]
  );

  const switchToSearchMode = useCallback(() => {
    setMode("search");
    setAnswer(null);
    askStreamMutation.reset();
  }, [askStreamMutation]);

  const switchToAskMode = useCallback(() => {
    setMode("ask");
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;

      setAnswer(null);
      askStreamMutation.reset();

      if (mode === "ask") {
        const nextAnswer: AskSearchResponse = {
          query: trimmed,
          plan: [],
          answer: "",
          citations: [],
          token_estimate: 0,
          truncated: false,
          used_fallback: false
        };
        setAnswer(nextAnswer);
        askStreamMutation.mutate(
          {
            request: {
              query: trimmed,
              course_id: selectedCourseId,
              material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds : undefined,
              limit: 8,
              max_subqueries: 3
            },
            onEvent: (streamEvent) => {
              if (streamEvent.type === "retrieval_plan") {
                nextAnswer.plan = streamEvent.plan;
              } else if (streamEvent.type === "answer") {
                nextAnswer.answer = streamEvent.answer;
                nextAnswer.used_fallback = streamEvent.used_fallback;
              } else if (streamEvent.type === "citations") {
                nextAnswer.citations = streamEvent.citations;
                nextAnswer.token_estimate = streamEvent.token_estimate;
                nextAnswer.truncated = streamEvent.truncated;
              }
              setAnswer({ ...nextAnswer });
            }
          },
          {
            onError: () => setAnswer(null)
          }
        );
        replaceSearchUrl({ q: trimmed });
        return;
      }

      runImmediateSearch(trimmed);
    },
    [askStreamMutation, mode, query, replaceSearchUrl, runImmediateSearch, selectedCourseId, selectedMaterialIds]
  );

  const isLoading = mode === "search" ? searchQuery.isFetching : askStreamMutation.isPending;
  const results = searchQuery.data?.results ?? [];
  const error = searchQuery.error
    ? getClientErrorMessage(searchQuery.error)
    : askStreamMutation.error
      ? getClientErrorMessage(askStreamMutation.error)
      : null;
  const hasSubmitted =
    mode === "search"
      ? shouldSearch && (searchQuery.isFetched || searchQuery.isFetching || searchQuery.isPlaceholderData)
      : Boolean(answer);
  const hasActiveFilters = Boolean(selectedCourseId) || selectedMaterialIds.length > 0;

  return {
    courses,
    materials,
    mode,
    query,
    answer,
    results,
    error,
    isLoading,
    hasSubmitted,
    hasActiveFilters,
    courseTitle,
    searchableInScope,
    selectedCourseId,
    selectedMaterialIds,
    processedMaterials,
    activeSearchQuery,
    handleCourseChange,
    toggleMaterial,
    clearFilters,
    handleQueryChange,
    applyPrompt,
    switchToSearchMode,
    switchToAskMode,
    handleSubmit
  };
}
