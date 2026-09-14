"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  duration?: number;
  once?: boolean;
  threshold?: number;
};

const hiddenTransforms: Record<NonNullable<ScrollRevealProps["direction"]>, string> = {
  up: "translate-y-8 opacity-0",
  down: "-translate-y-8 opacity-0",
  left: "translate-x-8 opacity-0",
  right: "-translate-x-8 opacity-0",
  none: "opacity-0"
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

function isInScrollView(element: Element, root: Element | null) {
  const elementRect = element.getBoundingClientRect();
  const rootRect = root?.getBoundingClientRect() ?? {
    top: 0,
    left: 0,
    bottom: window.innerHeight,
    right: window.innerWidth
  };

  return elementRect.top < rootRect.bottom && elementRect.bottom > rootRect.top;
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  direction = "up",
  duration = 700,
  once = true,
  threshold = 0.08
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setVisible(true);
      return;
    }

    const root = getScrollRoot(element);

    if (isInScrollView(element, root)) {
      setVisible(true);
      if (once) return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(element);
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, root, rootMargin: "0px 0px -5% 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [once, threshold]);

  return (
    <div
      ref={ref}
      className={cn(
        !visible && "will-change-[transform,opacity]",
        visible ? "opacity-100" : hiddenTransforms[direction],
        className
      )}
      style={{
        transitionProperty: "transform, opacity",
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
}

type StaggerRevealProps = {
  children: ReactNode[];
  className?: string;
  itemClassName?: string;
  stagger?: number;
  direction?: ScrollRevealProps["direction"];
  asContents?: boolean;
};

export function StaggerReveal({
  children,
  className,
  itemClassName,
  stagger = 80,
  direction = "up",
  asContents = false
}: StaggerRevealProps) {
  return (
    <div className={cn(asContents && "contents", className)}>
      {children.map((child, index) => (
        <ScrollReveal key={index} delay={index * stagger} direction={direction} className={itemClassName}>
          {child}
        </ScrollReveal>
      ))}
    </div>
  );
}
