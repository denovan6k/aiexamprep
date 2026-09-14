"use client";

import Image from "next/image";
import {
  Bot,
  Brain,
  FileUp,
  Layers,
  LineChart,
  Mic,
  PenLine,
  Presentation,
  Sparkles,
  Target
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { landingEase, landingSpring } from "@/components/home/landing-motion";
import {
  CINEMATIC_BREAKPOINT,
  LANDING_STICKY_CLASS,
  landingSpacing,
  useLandingInViewViewport,
  useLandingScroll,
  useMinWidth
} from "@/components/home/landing-scroll";
import {
  featureAccentCallout,
  featureAccentIcon,
  featureAccentText,
  featureAccents,
  LandingContainer,
  landingAnchorClass,
  TopicScore,
  type FeatureAccent
} from "@/components/home/landing-ui";
import { agentProfiles } from "@/lib/content";
import { cn } from "@/lib/utils";

const formatTiles = [
  { label: "MCQs", detail: "Close distractors, single and multi-select", icon: Target, accent: "coral" as const },
  { label: "Theory", detail: "Short answers marked against a rubric", icon: PenLine, accent: "teal" as const },
  { label: "Essays", detail: "Long-form responses with structured notes", icon: FileUp, accent: "violet" as const },
  { label: "Flashcards", detail: "Spaced repetition from the same notes", icon: Layers, accent: "amber" as const },
  { label: "Mixed mock", detail: "Timed papers that blend every format", icon: Sparkles, accent: "coral" as const },
  { label: "Oral sim", detail: "Voice-style defense and viva practice", icon: Mic, accent: "teal" as const },
  { label: "Presentation", detail: "Slide defense Q&A with rubric feedback", icon: Presentation, accent: "violet" as const }
] as const;

type FormatLabel = (typeof formatTiles)[number]["label"];

function FormatTileAnimation({ label, accent }: { label: FormatLabel; accent: FeatureAccent }) {
  const reduceMotion = useReducedMotion();

  if (label === "MCQs") {
    return <McqTileAnimation accent={accent} paused={reduceMotion} />;
  }
  if (label === "Theory") {
    return <TheoryTileAnimation accent={accent} paused={reduceMotion} />;
  }
  if (label === "Essays") {
    return <EssayTileAnimation accent={accent} paused={reduceMotion} />;
  }
  if (label === "Flashcards") {
    return <FlashcardTileAnimation accent={accent} paused={reduceMotion} />;
  }
  if (label === "Mixed mock") {
    return <MixedMockTileAnimation accent={accent} paused={reduceMotion} />;
  }
  if (label === "Oral sim") {
    return <OralSimTileAnimation accent={accent} paused={reduceMotion} />;
  }
  return <PresentationTileAnimation accent={accent} paused={reduceMotion} />;
}

function McqTileAnimation({ accent, paused }: { accent: FeatureAccent; paused: boolean | null }) {
  const options = ["G-protein cascade", "Direct PKA phosphorylation", "Phosphodiesterase block"];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setActive((current) => (current + 1) % options.length), 2200);
    return () => window.clearInterval(id);
  }, [paused, options.length]);

  return (
    <div className="space-y-2">
      {options.map((option, index) => (
        <motion.div
          key={option}
          animate={paused ? undefined : { scale: index === active ? 1.02 : 1 }}
          className={cn(
            "rounded-xl border px-3 py-2.5 text-xs transition-colors",
            index === active ? cn("border-primary/35 font-medium", featureAccentCallout[accent]) : "border-border/70 text-muted-foreground"
          )}
        >
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-semibold">
            {String.fromCharCode(65 + index)}
          </span>
          {option}
        </motion.div>
      ))}
    </div>
  );
}

function TheoryTileAnimation({ accent, paused }: { accent: FeatureAccent; paused: boolean | null }) {
  const lines = ["Mechanism named correctly", "Rubric keyword matched", "Mark awarded"];
  const [filled, setFilled] = useState(paused ? lines.length : 0);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setFilled((current) => (current >= lines.length ? 1 : current + 1)), 1400);
    return () => window.clearInterval(id);
  }, [paused, lines.length]);

  return (
    <div className="space-y-2.5">
      {lines.map((line, index) => (
        <div key={line} className="flex items-center gap-2.5">
          <motion.span
            animate={{ scale: index < filled ? 1 : 0.85, opacity: index < filled ? 1 : 0.35 }}
            className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", featureAccentIcon[accent])}
          >
            {index < filled ? "✓" : ""}
          </motion.span>
          <span className={cn("text-xs", index < filled ? "text-foreground" : "text-muted-foreground")}>{line}</span>
        </div>
      ))}
    </div>
  );
}

function EssayTileAnimation({ accent, paused }: { accent: FeatureAccent; paused: boolean | null }) {
  const [words, setWords] = useState(paused ? 412 : 280);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setWords((current) => (current >= 412 ? 280 : current + Math.floor(Math.random() * 18 + 8)));
    }, 900);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <div className={cn("rounded-xl border p-3", featureAccentCallout[accent])}>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Draft response</span>
        <motion.span key={words} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className={cn("font-semibold tabular-nums", featureAccentText[accent])}>
          {words} words
        </motion.span>
      </div>
      <div className="mt-3 space-y-2">
        {[0.92, 0.78, 0.64, 0.48].map((width, index) => (
          <motion.div
            key={index}
            animate={paused ? undefined : { opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: index * 0.2, ease: landingEase }}
            className="h-2 rounded-full bg-muted"
            style={{ width: `${width * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function FlashcardTileAnimation({ accent, paused }: { accent: FeatureAccent; paused: boolean | null }) {
  const prompts = ["Define osmosis", "Key enzyme?", "Membrane role"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setIndex((current) => (current + 1) % prompts.length), 2400);
    return () => window.clearInterval(id);
  }, [paused, prompts.length]);

  return (
    <div className="relative h-[5.5rem]">
      <AnimatePresence mode="wait">
        <motion.div
          key={prompts[index]}
          initial={paused ? false : { opacity: 0, y: 14, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          exit={paused ? undefined : { opacity: 0, y: -10, rotateX: -8 }}
          transition={{ duration: 0.35, ease: landingEase }}
          className={cn("absolute inset-0 flex items-center justify-center rounded-xl border p-4 text-center text-sm font-medium", featureAccentCallout[accent])}
        >
          {prompts[index]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function MixedMockTileAnimation({ accent, paused }: { accent: FeatureAccent; paused: boolean | null }) {
  const [progress, setProgress] = useState(paused ? 62 : 28);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setProgress((current) => (current >= 96 ? 18 : current + 7));
    }, 1100);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Mixed mock · 60 min</span>
        <span className={cn("font-semibold tabular-nums", featureAccentText[accent])}>{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", featureAccentIcon[accent])}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.55, ease: landingEase }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-muted-foreground">
        {["MCQ", "Theory", "Essay"].map((part) => (
          <div key={part} className="rounded-lg border border-border/70 px-2 py-1.5">
            {part}
          </div>
        ))}
      </div>
    </div>
  );
}

function OralSimTileAnimation({ accent, paused }: { accent: FeatureAccent; paused: boolean | null }) {
  return (
    <div className="flex h-[5.5rem] items-end justify-center gap-1.5">
      {Array.from({ length: 12 }).map((_, index) => (
        <motion.span
          key={index}
          className={cn("w-1.5 rounded-full", featureAccentIcon[accent])}
          animate={
            paused
              ? { height: 16 }
              : { height: [10, 22 + (index % 4) * 6, 12 + (index % 3) * 4, 18] }
          }
          transition={{ duration: 1.1, repeat: Infinity, delay: index * 0.08, ease: landingEase }}
        />
      ))}
    </div>
  );
}

function PresentationTileAnimation({ accent, paused }: { accent: FeatureAccent; paused: boolean | null }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setActive((current) => (current + 1) % 4), 1800);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <motion.div
            key={index}
            animate={paused ? undefined : { scale: index === active ? 1.05 : 1, opacity: index === active ? 1 : 0.45 }}
            className={cn("aspect-[4/3] rounded-lg border", index === active ? featureAccentCallout[accent] : "border-border/70 bg-muted/30")}
          />
        ))}
      </div>
      <p className="text-center text-[11px] text-muted-foreground">Slide {active + 1} · defense Q&A</p>
    </div>
  );
}

function FormatTile({
  label,
  detail,
  icon: Icon,
  accent
}: {
  label: FormatLabel;
  detail: string;
  icon: (typeof formatTiles)[number]["icon"];
  accent: FeatureAccent;
}) {
  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={landingSpring}
      className={cn(
        "flex h-[24rem] w-[min(17rem,calc(100vw-3rem))] shrink-0 snap-start flex-col rounded-3xl border p-5 sm:h-[27rem] sm:w-[min(22rem,calc(100vw-3rem))] sm:p-6",
        featureAccentCallout[accent]
      )}
    >
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", featureAccentIcon[accent])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-5">
        <h3 className="text-2xl font-semibold tracking-tight">{label}</h3>
        <p className="mt-2 max-w-[18ch] text-sm leading-relaxed text-muted-foreground">{detail}</p>
      </div>
      <div className="mt-auto pt-6">
        <FormatTileAnimation label={label} accent={accent} />
      </div>
    </motion.article>
  );
}

function FormatsPanScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useLandingScroll(sectionRef);
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-72%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.14], [0.9, 1]);

  const tiles = formatTiles.map((tile) => <FormatTile key={tile.label} {...tile} />);

  return (
    <section ref={sectionRef} className="relative h-[145vh] border-y border-border bg-muted/40 xl:h-[150vh]">
      <div
        className={cn(
          "sticky flex min-h-[100dvh] flex-col justify-start pt-14 lg:pt-16",
          landingSpacing.sectionCinematicPad,
          LANDING_STICKY_CLASS
        )}
      >
        <motion.div style={{ opacity: contentOpacity }} className="flex w-full flex-col gap-10 sm:gap-12">
          <LandingContainer>
            <h2 className="max-w-xl text-balance text-2xl font-semibold leading-[1.12] tracking-tight sm:text-3xl lg:text-4xl">
              One upload. Every exam format.
            </h2>
            <p className="mt-3 max-w-[65ch] text-base leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg">
              Switch from flashcards to a timed mixed mock without re-indexing your files.
            </p>
          </LandingContainer>
          <div className="w-full overflow-hidden">
            <motion.div
              style={{ x }}
              className="w-max will-change-transform pl-4 sm:pl-6 xl:pl-[max(2rem,calc((100vw-72rem)/2+2rem))]"
            >
              <div className="flex gap-4 pr-4 sm:gap-5 sm:pr-6">{tiles}</div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function LandingFormatsPanSection() {
  const reduceMotion = useReducedMotion();
  const isDesktop = useMinWidth(CINEMATIC_BREAKPOINT);
  const enablePan = Boolean(!reduceMotion && isDesktop);

  const tiles = formatTiles.map((tile) => <FormatTile key={tile.label} {...tile} />);

  if (!enablePan) {
    return (
      <section className={cn("border-y border-border bg-muted/40", landingSpacing.sectionDefault)}>
        <LandingContainer>
          <h2 className="max-w-xl text-balance text-2xl font-semibold leading-[1.12] tracking-tight sm:text-3xl lg:text-4xl">
            One upload. Every exam format.
          </h2>
          <p className="mt-3 max-w-[65ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
            Switch from flashcards to a timed mixed mock without re-indexing your files.
          </p>
        </LandingContainer>
        <div className="landing-horizontal-scroll mt-10 scroll-pl-4 pb-2 sm:mt-12 sm:scroll-pl-6 lg:scroll-pl-8">
          <div className="flex w-max gap-4 pl-4 pr-4 sm:gap-5 sm:pl-6 sm:pr-6 lg:pl-8 lg:pr-8">
            {tiles}
            <div aria-hidden className="w-4 shrink-0 sm:w-6 lg:w-8" />
          </div>
        </div>
      </section>
    );
  }

  return <FormatsPanScroll />;
}

function RevealImage() {
  const reduceMotion = useReducedMotion();
  const viewport = useLandingInViewViewport();

  return (
    <motion.div
      className="relative mt-8 aspect-[16/9] overflow-hidden rounded-[1.75rem] border border-border"
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.99 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={viewport}
      transition={{ duration: 0.5, ease: landingEase }}
    >
      <Image
        src="/images/marketing/notes-quiz.png"
        alt="Course notes transformed into practice questions"
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 72rem"
      />
    </motion.div>
  );
}

function PanelReveal({
  children,
  delay = 0
}: {
  children: ReactNode;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const viewport = useLandingInViewViewport();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewport}
      transition={delay > 0 ? { ...landingSpring, delay } : landingSpring}
    >
      {children}
    </motion.div>
  );
}

export function LandingProductStackSection() {
  const panels = [
    {
      icon: Brain,
      accent: "teal" as const,
      title: "Questions stay tied to your notes",
      body: "Every prompt is grounded in the PDFs, slides, and papers you uploaded, with citations back to the source.",
      content: (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {(["PDF", "DOCX", "Markdown", "PPTX"] as const).map((type, index) => {
              const accent = featureAccents[index % featureAccents.length];
              return (
                <span
                  key={type}
                  className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", featureAccentCallout[accent])}
                >
                  {type}
                </span>
              );
            })}
          </div>
          <RevealImage />
        </>
      )
    },
    {
      icon: Bot,
      accent: "violet" as const,
      title: "Mark the way your examiner marks",
      body: "Configure tone, traps, and strictness once. Reuse that agent across every mock this semester.",
      content: (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {agentProfiles.map((agent, index) => {
            const accent = featureAccents[index % featureAccents.length];
            const initials = agent.title
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("");
            return (
              <div key={agent.title} className={cn("flex items-start gap-3 rounded-2xl border p-4", featureAccentCallout[accent])}>
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    featureAccentIcon[accent]
                  )}
                >
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{agent.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{agent.style}</p>
                </div>
              </div>
            );
          })}
        </div>
      )
    },
    {
      icon: LineChart,
      accent: "coral" as const,
      title: "See what to study next",
      body: "After each attempt, weak topics surface with a concrete next action. Not a vanity dashboard.",
      content: (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <TopicScore label="Membrane transport" value={91} tone="success" />
            <TopicScore label="Signal transduction" value={68} tone="warning" />
            <TopicScore label="Enzyme kinetics" value={54} tone="danger" />
          </div>
          <div className={cn("rounded-2xl border p-5", featureAccentCallout.amber)}>
            <p className={cn("text-sm font-medium", featureAccentText.amber)}>Recommended next</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              12 flashcards on signal transduction. About 18 minutes.
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <section id="product" className={cn("relative bg-background", landingAnchorClass, landingSpacing.sectionDefault)}>
      <div className="flex flex-col gap-10 sm:gap-12 lg:gap-14">
        {panels.map((panel, index) => {
          const Icon = panel.icon;
          return (
            <PanelReveal key={panel.title} delay={index * 0.04}>
              <LandingContainer>
                <div
                  className={cn(
                    "rounded-[1.5rem] border p-5 sm:rounded-[1.75rem] sm:p-8 lg:p-10",
                    featureAccentCallout[panel.accent]
                  )}
                >
                  <Icon className={cn("h-6 w-6", featureAccentText[panel.accent])} />
                  <h2 className="mt-4 max-w-xl text-balance text-2xl font-semibold leading-[1.12] tracking-tight sm:mt-5 sm:text-3xl lg:text-4xl">
                    {panel.title}
                  </h2>
                  <p className="mt-3 max-w-[65ch] text-base leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg">
                    {panel.body}
                  </p>
                  {panel.content}
                </div>
              </LandingContainer>
            </PanelReveal>
          );
        })}
      </div>
    </section>
  );
}

export function ScrollEnter({
  children,
  className,
  delay = 0
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const viewport = useLandingInViewViewport();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewport}
      transition={delay ? { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] } : landingSpring}
    >
      {children}
    </motion.div>
  );
}
