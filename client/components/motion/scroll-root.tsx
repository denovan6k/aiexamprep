"use client";

import { createContext, useContext, useEffect, type ReactNode, type RefObject } from "react";

/** Offset for fixed homepage header when scrolling to anchors (px). */
export const LANDING_HEADER_OFFSET = 88;

const ScrollRootContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function ScrollRootProvider({
  scrollRef,
  children
}: {
  scrollRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return <ScrollRootContext.Provider value={scrollRef}>{children}</ScrollRootContext.Provider>;
}

export function useScrollRoot() {
  return useContext(ScrollRootContext);
}

export function scrollToAnchor(
  container: HTMLElement,
  hash: string,
  offset = LANDING_HEADER_OFFSET
) {
  if (!hash.startsWith("#")) return;
  const target = container.querySelector<HTMLElement>(hash);
  if (!target) return;

  const containerTop = container.getBoundingClientRect().top;
  const targetTop = target.getBoundingClientRect().top;
  const nextTop = targetTop - containerTop + container.scrollTop - offset;

  container.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
}

export function useLandingHashScroll(scrollRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const run = () => {
      const hash = window.location.hash;
      if (hash) scrollToAnchor(container, hash);
    };

    run();
    window.addEventListener("hashchange", run);
    return () => window.removeEventListener("hashchange", run);
  }, [scrollRef]);
}
