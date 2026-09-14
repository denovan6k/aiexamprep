"use client";

import { useCallback, useEffect, useState } from "react";

import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export function useListPageState(pageSize: number = DEFAULT_PAGE_SIZE) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("");
  const [courseId, setCourseId] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [offset, setOffset] = useState(0);

  const applySearch = useCallback(() => {
    setQuery(searchInput.trim());
    setOffset(0);
  }, [searchInput]);

  const updateStatus = useCallback((value: string) => {
    setStatus(value);
    setOffset(0);
  }, []);

  const updateCourseId = useCallback((value: string) => {
    setCourseId(value);
    setOffset(0);
  }, []);

  const updateDifficulty = useCallback((value: string) => {
    setDifficulty(value);
    setOffset(0);
  }, []);

  const updateSource = useCallback((value: string) => {
    setSource(value);
    setOffset(0);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchInput("");
    setQuery("");
    setStatus("");
    setCourseId("");
    setDifficulty("");
    setSource("");
    setOffset(0);
  }, []);

  useEffect(() => {
    setOffset(0);
  }, [query, status, courseId, difficulty, source]);

  return {
    searchInput,
    setSearchInput,
    query,
    status,
    courseId,
    difficulty,
    source,
    offset,
    limit: pageSize,
    setOffset,
    applySearch,
    updateStatus,
    updateCourseId,
    updateDifficulty,
    updateSource,
    resetFilters
  };
}
