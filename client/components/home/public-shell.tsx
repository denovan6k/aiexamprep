"use client";

import { useRef, type ReactNode, type RefObject } from "react";

import { ScrollRootProvider, useLandingHashScroll } from "@/components/motion/scroll-root";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function PublicShell({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useLandingHashScroll(scrollRef as RefObject<HTMLElement | null>);

  return (
    <ScrollRootProvider scrollRef={scrollRef as RefObject<HTMLElement | null>}>
      <div
        ref={scrollRef}
        className="landing-scroll-root relative flex h-dvh min-h-0 flex-col overflow-x-clip overflow-y-auto scroll-smooth"
        style={{ scrollPaddingTop: "5.5rem" }}
      >
        <SiteHeader />
        <div className="min-w-0 flex-1">{children}</div>
        <SiteFooter />
      </div>
    </ScrollRootProvider>
  );
}
