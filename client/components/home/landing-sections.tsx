"use client";

import Link from "next/link";
import { ArrowRight, Bot, Check, FileUp, GraduationCap, Target, Users, Zap } from "lucide-react";
import { motion, useReducedMotion, useTransform } from "motion/react";
import { useRef, useState } from "react";

import { ScrollEnter } from "@/components/home/landing-cinematic";
import { LandingPrimaryCta } from "@/components/home/landing-auth-cta";
import { SubtleButton } from "@/components/home/landing-motion";
import { landingSpacing, useLandingInViewViewport, useLandingScroll } from "@/components/home/landing-scroll";
import {
  AgentChip,
  featureAccentCallout,
  featureAccentIcon,
  featureAccentSolid,
  featureAccentText,
  featureAccentTint,
  featureAccents,
  heroProofItems,
  LandingContainer,
  MarketingPageHeader,
  MarketingSection,
  type FeatureAccent
} from "@/components/home/landing-ui";
import { FormatsMarquee, TestimonialsMarquee } from "@/components/home/landing-marquee";
import { LandingWorkflowScroll, type WorkflowStep } from "@/components/home/landing-workflow";
import { PricingPlanCta } from "@/components/pricing/pricing-plan-cta";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { faqs, pricingPlans, targetUsers, testimonials, assessmentFormats } from "@/lib/content";
import { asRoute, cn } from "@/lib/utils";

const audienceIcons = [GraduationCap, Zap, Users] as const;
const audienceAccents: FeatureAccent[] = ["teal", "coral", "amber"];

const workflowSteps: WorkflowStep[] = [
  {
    id: "upload",
    icon: FileUp,
    title: "Upload",
    description: "Drop PDFs, DOCX, and notes. Knorvex chunks and indexes them for retrieval.",
    preview: (
      <div className="flex h-full flex-col justify-between gap-4 overflow-hidden p-4 sm:p-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Course materials</p>
            <span className="text-[11px] text-muted-foreground">3 files</span>
          </div>
          {["Lecture 12, Signal transduction.pdf", "Midterm review notes.docx", "Chapter 7, Enzymes.md"].map((file) => (
            <div key={file} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <FileUp className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-xs">{file}</span>
              <Badge variant="success" className="ml-auto shrink-0 text-[10px]">
                Indexed
              </Badge>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Ready to generate. Indexed in 12 seconds.</p>
      </div>
    )
  },
  {
    id: "configure",
    icon: Bot,
    title: "Configure",
    description: "Describe your examiner: traps, tone, marking strictness, and favorite topics.",
    preview: (
      <div className="flex h-full flex-col justify-between gap-4 overflow-hidden p-4 sm:p-5">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            &ldquo;Application-heavy MCQs with close distractors. Mark strictly on mechanism details.&rdquo;
          </p>
          <AgentChip name="Dr. Valeria Chen MCQ Examiner" style="Application-heavy, tricky distractors" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Format", value: "MCQ" },
            { label: "Strictness", value: "High" },
            { label: "Traps", value: "Close" }
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-muted/20 px-2 py-2 text-center">
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
              <p className="mt-0.5 text-xs font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    id: "practice",
    icon: Target,
    title: "Practice",
    description: "Timed mocks, weak-topic focus, and spaced repetition until exam day.",
    preview: (
      <div className="flex h-full flex-col justify-between gap-4 overflow-hidden p-4 sm:p-5">
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Mock exam · Biology 201</p>
            <p className="mt-1 text-xs text-muted-foreground">40 questions · 60 min · Dr. Chen agent</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Avg score", value: "74%" },
              { label: "Weak topics", value: "2" },
              { label: "Cards due", value: "42" }
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-muted/20 p-2 text-center">
                <p className="text-sm font-semibold tabular-nums">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Next: 12 flashcards on signal transduction.</p>
      </div>
    )
  }
];

export function LandingProofStrip() {
  return (
    <MarketingSection variant="muted" className="py-10 sm:py-12 lg:py-14">
      <LandingContainer>
        <ScrollEnter>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-center text-sm text-muted-foreground sm:gap-x-8">
            {heroProofItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="mt-8">
            <p className="mb-4 text-center text-sm font-medium text-muted-foreground">Supported assessment formats</p>
            <FormatsMarquee formats={assessmentFormats} />
          </div>
        </ScrollEnter>
      </LandingContainer>
    </MarketingSection>
  );
}

export function LandingWorkflowSection() {
  return <LandingWorkflowScroll steps={workflowSteps} />;
}

export function LandingAudienceProofSection() {
  const [activeAudience, setActiveAudience] = useState(0);

  return (
    <MarketingSection>
      <LandingContainer>
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
          <ScrollEnter>
            <MarketingPageHeader
              title="Built for people who take exams seriously"
              description="Finals, certifications, and group study. Practice stays tied to your real course materials."
            />

            <div className="mt-8 space-y-2">
              {targetUsers.map((user, index) => {
                const Icon = audienceIcons[index] ?? Users;
                const accent = audienceAccents[index] ?? "violet";
                const isActive = index === activeAudience;
                return (
                  <button
                    key={user.title}
                    type="button"
                    onClick={() => setActiveAudience(index)}
                    className={cn(
                      "flex w-full gap-4 rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
                      isActive
                        ? cn("bg-card shadow-subtle", featureAccentTint[accent])
                        : "border-transparent hover:border-border hover:bg-card/60"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                        isActive ? featureAccentSolid[accent] : featureAccentIcon[accent]
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{user.title}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">{user.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollEnter>

          <ScrollEnter delay={0.08}>
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <h3 className="text-xl font-medium tracking-tight sm:text-2xl">
                Built for exam weeks that actually matter
              </h3>
              <div className="mt-8">
                <TestimonialsMarquee testimonials={testimonials} compact />
              </div>
            </div>
          </ScrollEnter>
        </div>
      </LandingContainer>
    </MarketingSection>
  );
}

export function LandingPricingSection() {
  const freePlan = pricingPlans[0];
  const proPlan = pricingPlans.find((plan) => plan.highlighted) ?? pricingPlans[1];

  return (
    <MarketingSection id="pricing" variant="muted">
      <LandingContainer>
        <ScrollEnter>
          <MarketingPageHeader
            align="center"
            title="Start free. Scale when exams get serious."
            description="No credit card to begin. Upgrade for unlimited generations and advanced quiz configuration."
            className="mx-auto"
          />
        </ScrollEnter>

        <div className="mt-10 grid gap-5 sm:mt-12 md:grid-cols-2 md:items-stretch md:gap-6">
          <ScrollEnter>
            <PricingCard plan={freePlan} />
          </ScrollEnter>
          <ScrollEnter delay={0.08}>
            <div className="landing-pricing-featured relative flex h-full flex-col rounded-2xl bg-card p-6 sm:p-8">
              <Badge className="mb-4 w-fit">Most popular</Badge>
              <PricingCard plan={proPlan} embedded />
            </div>
          </ScrollEnter>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href={asRoute("/pricing")} className="underline-offset-4 hover:underline">
            Compare full plan details
            <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </Link>
        </p>
      </LandingContainer>
    </MarketingSection>
  );
}

function PricingCard({
  plan,
  embedded = false
}: {
  plan: (typeof pricingPlans)[number];
  embedded?: boolean;
}) {
  return (
    <div className={cn("flex h-full flex-col", !embedded && "rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-subtle")}>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
          {plan.period ? <span className="text-sm text-muted-foreground">{plan.period}</span> : null}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{plan.detail}</p>
      </div>
      <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
        {plan.features.slice(0, 5).map((feature, index) => {
          const accent = featureAccents[index % featureAccents.length];
          return (
            <li key={feature} className="flex gap-2">
              <Check className={cn("mt-0.5 h-4 w-4 shrink-0", featureAccentText[accent])} />
              {feature}
            </li>
          );
        })}
      </ul>
      <div className="mt-auto pt-8">
        <PricingPlanCta
          cta={plan.cta}
          highlighted={embedded || plan.highlighted}
          href={plan.href}
          planCode={"planCode" in plan ? plan.planCode : undefined}
        />
      </div>
    </div>
  );
}

export function LandingFaqSection() {
  const previewFaqs = faqs.slice(0, 5);
  const reduceMotion = useReducedMotion();
  const viewport = useLandingInViewViewport();

  return (
    <MarketingSection id="faq">
      <LandingContainer>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] lg:items-start">
          <ScrollEnter>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Questions before your first session</h2>
            <p className="mt-4 text-muted-foreground">
              Uploads, billing, agents, and privacy. The essentials before you start practicing.
            </p>
            <Button className="mt-8 rounded-full" variant="outline" asChild>
              <Link href={asRoute("/faq")}>
                All answers
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </ScrollEnter>

          <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card px-2">
            {previewFaqs.map((faq, index) => (
              <motion.div
                key={faq.question}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewport}
                transition={{ duration: 0.45, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
              >
                <AccordionItem value={`landing-faq-${index}`} className="border-border/60 px-4">
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      </LandingContainer>
    </MarketingSection>
  );
}

export function LandingCtaSection() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useLandingScroll(ref, ["start end", "center center"]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.96, 1]);

  return (
    <MarketingSection className={cn(landingSpacing.sectionCompact, "pb-16 pt-4 sm:pb-20")}>
      <LandingContainer>
        <motion.div
          ref={ref}
          style={reduceMotion ? undefined : { scale }}
          className="origin-bottom will-change-transform"
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground landing-surface-tint">
            <div className="grid gap-8 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-10 lg:py-16">
              <div>
                <h2 className="max-w-xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                  Your next mock exam starts here
                </h2>
                <p className="mt-4 max-w-lg text-muted-foreground">
                  Upload material, pick an agent, and generate your first quiz in under five minutes.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <SubtleButton>
                    <LandingPrimaryCta className="h-12 rounded-full px-8" />
                  </SubtleButton>
                  <SubtleButton>
                    <Button size="lg" variant="outline" asChild className="h-12 rounded-full px-8">
                      <Link href="/pricing">View pricing</Link>
                    </Button>
                  </SubtleButton>
                </div>
              </div>

              <div className={cn("rounded-xl border p-5 sm:p-6", featureAccentCallout.violet)}>
                <p className={cn("text-sm font-medium", featureAccentText.violet)}>What you get on day one</p>
                <ul className="mt-4 space-y-3">
                  {[
                    "Upload PDFs, DOCX, and markdown notes",
                    "Configure one professor-style agent",
                    "Generate MCQs, flashcards, or a mixed mock",
                    "See weak topics after your first attempt"
                  ].map((item, index) => {
                    const accent = featureAccents[index % featureAccents.length];
                    return (
                      <li key={item} className="flex gap-2.5 text-sm text-muted-foreground">
                        <Check className={cn("mt-0.5 h-4 w-4 shrink-0", featureAccentText[accent])} />
                        {item}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/60 pt-5">
                  {[
                    { label: "Formats", value: "7+", accent: "teal" as const },
                    { label: "To first quiz", value: "< 5 min", accent: "coral" as const },
                    { label: "Free uploads", value: "Unlimited", accent: "amber" as const }
                  ].map((stat) => (
                    <div key={stat.label} className={cn("rounded-lg border px-2 py-2.5 text-center", featureAccentCallout[stat.accent])}>
                      <p className={cn("text-sm font-semibold", featureAccentText[stat.accent])}>{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </LandingContainer>
    </MarketingSection>
  );
}
