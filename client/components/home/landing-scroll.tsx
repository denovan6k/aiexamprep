"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue
} from "motion/react";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from "react";

import { useScrollRoot } from "@/components/motion/scroll-root";
import { cn } from "@/lib/utils";

type ScrollOffset = NonNullable<Parameters<typeof useScroll>[0]>["offset"];

export const CINEMATIC_BREAKPOINT = 1280;

/** Shared sticky offset matching fixed header height. */
export const LANDING_STICKY_CLASS = "top-[5.5rem]";

export const landingSpacing = {
  sectionCompact: "py-14 sm:py-16",
  sectionDefault: "py-16 sm:py-20 lg:py-24",
  sectionCinematicPad: "py-14 lg:py-16"
} as const;

export function useMinWidth(px: number) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${px}px)`);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [px]);

  return matches;
}

export function useDesktopMedia() {
  return useMinWidth(CINEMATIC_BREAKPOINT);
}

export function useLandingScroll(
  target: RefObject<HTMLElement | null>,
  offset: ScrollOffset = ["start start", "end end"]
) {
  const container = useScrollRoot();
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    const ready = Boolean(target.current) && (!container || Boolean(container.current));
    setHydrated((current) => (current === ready ? current : ready));
  });

  return useScroll(
    hydrated
      ? {
          target,
          container: container ?? undefined,
          offset
        }
      : {}
  );
}

export function useLandingInViewViewport() {
  const scrollRoot = useScrollRoot();

  return {
    once: true as const,
    amount: 0.25 as const,
    root: scrollRoot ?? undefined
  };
}

const WORD_SPREAD = 0.78;
const WORD_DURATION = 0.22;

function getWordRange(index: number, count: number) {
  const start = count <= 1 ? 0 : (index / (count - 1)) * WORD_SPREAD;
  return {
    start,
    end: Math.min(1, start + WORD_DURATION)
  };
}

function ScrollWord({
  children,
  progress,
  index,
  count,
  reducedMotion
}: {
  children: string;
  progress: MotionValue<number>;
  index: number;
  count: number;
  reducedMotion: boolean;
}) {
  const range = getWordRange(index, count);
  const color = useTransform(
    progress,
    [range.start, range.end],
    ["hsl(var(--muted-foreground))", "hsl(var(--foreground))"]
  );

  return (
    <motion.span aria-hidden="true" style={reducedMotion ? undefined : { color }}>
      {children}
    </motion.span>
  );
}

function LandingScrollWordsCinematic({ text }: { text: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useLandingScroll(sectionRef);
  const words = text.split(" ");

  return (
    <section
      ref={sectionRef}
      className="relative hidden h-[115vh] bg-background xl:block xl:h-[118vh] 2xl:h-[126vh]"
    >
      <div
        className={cn(
          "sticky flex min-h-[72dvh] items-center overflow-hidden px-4 py-12 sm:px-6 md:min-h-[78dvh] lg:min-h-[88dvh] lg:px-8",
          LANDING_STICKY_CLASS
        )}
      >
        <h2
          aria-label={text}
          className="mx-auto max-w-[18ch] text-balance text-3xl font-semibold leading-[1.15] tracking-tight text-foreground sm:text-4xl lg:text-6xl"
        >
          {words.map((word, index) => (
            <Fragment key={`${word}-${index}`}>
              <ScrollWord
                progress={scrollYProgress}
                index={index}
                count={words.length}
                reducedMotion={false}
              >
                {word}
              </ScrollWord>
              {index < words.length - 1 ? " " : null}
            </Fragment>
          ))}
        </h2>
      </div>
    </section>
  );
}

export function LandingScrollWordsSection({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  const isCinematic = useDesktopMedia();

  if (reduceMotion || !isCinematic) {
    return (
      <section
        className={cn(
          "bg-background px-4 sm:px-6 lg:px-8",
          landingSpacing.sectionDefault
        )}
      >
        <h2 className="mx-auto max-w-[18ch] text-balance text-2xl font-semibold leading-[1.12] tracking-tight text-foreground sm:text-3xl lg:text-4xl xl:text-5xl">
          {text}
        </h2>
      </section>
    );
  }

  return <LandingScrollWordsCinematic text={text} />;
}
