"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type LegalTocItem = {
  id: string;
  title: string;
};

function getScrollRoot(element: Element): Element | null {
  let parent = element.parentElement;

  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") {
      return parent;
    }
    parent = parent.parentElement;
  }

  return null;
}

export function LegalToc({ sections }: { sections: readonly LegalTocItem[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const nodes = sections
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (nodes.length === 0) return;

    const root = getScrollRoot(nodes[0]);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        root,
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0, 0.25, 0.5, 1]
      }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="On this page" className="min-w-0">
      <p className="mb-2 text-xs font-medium text-muted-foreground lg:mb-3">On this page</p>
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0">
        <ul className="flex w-max min-w-full gap-2 lg:w-auto lg:min-w-0 lg:flex-col lg:gap-0.5">
          {sections.map((section) => {
            const isActive = section.id === activeId;
            return (
              <li key={section.id} className="shrink-0 lg:shrink">
                <a
                  href={`#${section.id}`}
                  className={cn(
                    "block whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors sm:text-sm lg:whitespace-normal lg:rounded-lg lg:px-3 lg:py-2",
                    isActive
                      ? "bg-primary/10 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {section.title}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
