"use client";

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { landingEase } from "@/components/home/landing-motion";
import { landingSpacing } from "@/components/home/landing-scroll";
import {
  featureAccentIcon,
  featureAccentSolid,
  LandingContainer,
  landingAnchorClass,
  ProductFrame
} from "@/components/home/landing-ui";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export type WorkflowStep = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  preview: ReactNode;
};

const stepAccents = ["teal", "violet", "coral"] as const;

const stepWash = {
  teal: "bg-[hsl(var(--chart-2))]/14 dark:bg-accent/30",
  violet: "bg-primary/14 dark:bg-primary/10",
  coral: "bg-accent-glow/22 dark:bg-accent-glow/10"
} as const;

function WorkflowCopy() {
  return (
    <>
      <h2 className="max-w-2xl text-balance text-2xl font-semibold leading-[1.12] tracking-tight text-foreground sm:text-3xl lg:text-4xl">
        Upload once. Practice all semester.
      </h2>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        Three steps from raw notes to exam-realistic mocks.
      </p>
    </>
  );
}

function StepBody({
  step,
  accent,
  iconSolid
}: {
  step: WorkflowStep;
  accent: (typeof stepAccents)[number];
  iconSolid?: boolean;
}) {
  const Icon = step.icon;

  return (
    <div className="relative flex items-start gap-3 sm:gap-4">
      <span
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl sm:h-10 sm:w-10",
          iconSolid ? featureAccentSolid[accent] : featureAccentIcon[accent]
        )}
      >
        <Icon className="relative h-4 w-4 sm:h-5 sm:w-5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold sm:text-base">{step.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
      </div>
    </div>
  );
}

export function LandingWorkflowScroll({ steps }: { steps: WorkflowStep[] }) {
  const [activeStep, setActiveStep] = useState(0);
  const step = steps[activeStep] ?? steps[0];
  const reduceMotion = useReducedMotion();

  return (
    <section id="how-it-works" className={cn("relative bg-background", landingAnchorClass, landingSpacing.sectionDefault)}>
      <LandingContainer>
        <WorkflowCopy />
        <div className="mt-8 grid gap-5 md:mt-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-stretch lg:gap-8">
          <div className="flex flex-col gap-2.5">
            {steps.map((item, index) => {
              const accent = stepAccents[index] ?? "violet";
              const isActive = index === activeStep;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={cn(
                    "relative isolate w-full overflow-hidden rounded-2xl border p-4 text-left sm:p-5",
                    "transition-colors active:scale-[0.99]",
                    isActive ? "border-transparent bg-card" : "border-border bg-card hover:bg-muted/40"
                  )}
                >
                  {isActive ? (
                    <span aria-hidden className={cn("pointer-events-none absolute inset-0 rounded-2xl", stepWash[accent])} />
                  ) : null}
                  <StepBody step={item} accent={accent} iconSolid={isActive} />
                </button>
              );
            })}
          </div>
          <ProductFrame title={`${siteConfig.name} · ${step.title}`} className="h-full min-h-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                className="h-full"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: landingEase }}
              >
                {step.preview}
              </motion.div>
            </AnimatePresence>
          </ProductFrame>
        </div>
      </LandingContainer>
    </section>
  );
}
