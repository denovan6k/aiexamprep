"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Brain,
  Clock,
  FileText,
  Flag,
  Sparkles,
  Target,
  TrendingUp
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { landingEase } from "@/components/home/landing-motion";
import { featureAccentCallout, featureAccentIcon, featureAccentText } from "@/components/home/landing-ui";
import { useScrollRoot } from "@/components/motion/scroll-root";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

const options = [
  "G-protein activation of adenylyl cyclase",
  "Direct phosphorylation of PKA",
  "Inhibition of phosphodiesterase"
];

const weakTopics = [
  { label: "Signal transduction", score: 68, tone: "warning" as const },
  { label: "Enzyme kinetics", score: 54, tone: "danger" as const },
  { label: "Membrane transport", score: 91, tone: "success" as const }
];

const mobileStats = [
  { label: "Last mock", value: "74%" },
  { label: "Cards due", value: "42" },
  { label: "Time left", value: "18:42" }
];

export function HeroProductPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const scrollRoot = useScrollRoot();
  const [active, setActive] = useState(false);
  const [selectedOption, setSelectedOption] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.unobserve(element);
        }
      },
      {
        threshold: 0.15,
        root: scrollRoot?.current ?? null
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!active || reduceMotion) return;

    const interval = window.setInterval(() => {
      setSelectedOption((current) => (current + 1) % options.length);
    }, 2800);

    return () => window.clearInterval(interval);
  }, [active, reduceMotion]);

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
            </div>
            <span className="truncate text-xs text-muted-foreground">
              {siteConfig.name} · Biology 201 mock exam
            </span>
          </div>
          <div className="hidden items-center gap-2 text-[10px] text-muted-foreground sm:flex">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", featureAccentCallout.coral)}>
              <Sparkles className="mr-1 inline h-3 w-3 text-accent-glow-foreground" />
              Dr. Chen agent
            </span>
            <span className="rounded-full border border-border bg-background px-2 py-0.5">Timed · 60 min</span>
          </div>
        </div>

        <div className="grid gap-px bg-border lg:grid-cols-[minmax(0,1fr)_200px_180px]">
          <div className="flex flex-col bg-background p-4 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Question 12 of 40</p>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", featureAccentCallout.amber)}>
                Application MCQ
              </span>
            </div>

            <p className="mt-4 text-sm font-medium leading-relaxed sm:text-base">
              Which mechanism best explains the sustained elevation of cAMP in response to glucagon binding?
            </p>

            <div className="mt-2 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Source: Lecture 12, Signal transduction, slide 18. Glucagon receptor pathway
              </p>
            </div>

            <div className="mt-5 space-y-2.5">
              {options.map((option, index) => {
                const isSelected = index === selectedOption;

                return (
                  <div
                    key={option}
                    className={cn(
                      "relative overflow-hidden rounded-lg border px-3.5 py-3 text-sm",
                      isSelected ? "border-primary/40 font-medium text-foreground" : "border-border text-muted-foreground"
                    )}
                  >
                    <AnimatePresence>
                      {isSelected ? (
                        <motion.span
                          layoutId={reduceMotion ? undefined : "hero-option-fill"}
                          className="absolute inset-0 bg-primary/5"
                          initial={reduceMotion ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.35, ease: landingEase }}
                        />
                      ) : null}
                    </AnimatePresence>
                    <span className="relative">
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-semibold">
                        {String.fromCharCode(65 + index)}
                      </span>
                      {option}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 lg:hidden">
              {mobileStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border bg-muted/20 p-2 text-center">
                  <p className="text-sm font-semibold tabular-nums">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 lg:hidden">
              <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", featureAccentCallout.coral)}>
                <Sparkles className="h-3 w-3 text-accent-glow-foreground" />
                Dr. Chen agent
              </span>
              <span className="text-[11px] text-muted-foreground">8 / 11 correct</span>
            </div>

            <div className="mt-auto hidden border-t border-border pt-4 sm:block">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5" />
                  3 flagged for review
                </span>
                <span>Next: short-answer theory block</span>
              </div>
            </div>
          </div>

          <div className="hidden flex-col bg-background p-4 lg:flex">
            <div className="flex items-start gap-2.5">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", featureAccentIcon.violet)}>
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Dr. Chen agent</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Application-heavy MCQs</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {[
                { label: "Last mock", value: "74%" },
                { label: "Cards due", value: "42" },
                { label: "Streak", value: "6d" },
                { label: "Sessions", value: "18" }
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
                  <p className="text-base font-semibold tabular-nums">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <TrendingUp className={cn("h-3.5 w-3.5", featureAccentText.teal)} />
                Topic breakdown
              </p>
              <div className="mt-3 space-y-2">
                {weakTopics.map((topic) => (
                  <div key={topic.label}>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="truncate text-muted-foreground">{topic.label}</span>
                      <span className="font-medium tabular-nums">{topic.score}%</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className={cn(
                          "h-full origin-left rounded-full",
                          topic.tone === "success" ? "bg-success" : topic.tone === "warning" ? "bg-warning" : "bg-danger"
                        )}
                        initial={{ scaleX: reduceMotion || !active ? topic.score / 100 : 0 }}
                        animate={{ scaleX: topic.score / 100 }}
                        transition={{ duration: 0.8, delay: 0.35, ease: landingEase }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden flex-col bg-background p-4 lg:flex">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                18:42 left
              </span>
              <span className={cn("font-semibold tabular-nums", featureAccentText.teal)}>30%</span>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full origin-left rounded-full bg-gradient-to-r from-[hsl(var(--chart-2))] to-accent-glow"
                initial={{ scaleX: reduceMotion || !active ? 0.3 : 0 }}
                animate={{ scaleX: 0.3 }}
                transition={{ duration: 0.9, delay: 0.4, ease: landingEase }}
              />
            </div>

            <div className="mt-4 flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Target className="h-3.5 w-3.5 text-success" />
                Correct so far
              </span>
              <span className="font-semibold tabular-nums">8 / 11</span>
            </div>

            <div className="mt-3 space-y-2">
              {[
                { label: "Answered", value: "12" },
                { label: "Skipped", value: "1" },
                { label: "Avg. time", value: "42s" }
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5 text-[11px]">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>

            <div className={cn("mt-auto rounded-lg border p-3", featureAccentCallout.amber)}>
              <p className={cn("text-xs font-medium", featureAccentText.amber)}>Focus next</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Signal transduction flashcards, 12 cards due today
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <FileText className="h-3 w-3" />
                Generated from Lecture 12 PDF
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
