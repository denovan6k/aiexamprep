"use client";

import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { landingSpring } from "@/components/home/landing-motion";
import { landingSpacing } from "@/components/home/landing-scroll";
import { cn } from "@/lib/utils";

export const landingAnchorClass = "scroll-mt-24 lg:scroll-mt-28";

export function LandingContainer({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function MarketingSection({
  children,
  className,
  variant = "default",
  id
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "muted" | "inverted";
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden",
        landingSpacing.sectionDefault,
        id && landingAnchorClass,
        variant === "default" && "bg-background",
        variant === "muted" && "border-y border-border bg-muted/40",
        variant === "inverted" && "bg-foreground text-background",
        className
      )}
    >
      {children}
    </section>
  );
}

export const LandingSection = MarketingSection;

export function MarketingPageHeader({
  eyebrow,
  title,
  description,
  align = "left",
  accent = "violet",
  className
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  accent?: FeatureAccent;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p className={cn("mb-3 text-sm font-medium", featureAccentText[accent])}>{eyebrow}</p>
      ) : null}
      <h2 className="text-balance text-3xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {description ? <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  eyebrowIcon: _eyebrowIcon,
  title,
  description,
  align = "left",
  className
}: {
  eyebrow?: ReactNode;
  eyebrowIcon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <MarketingPageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      align={align}
      className={className}
    />
  );
}

export function SectionEyebrow({
  children,
  icon: Icon,
  accent = "violet",
  className
}: {
  children: ReactNode;
  icon?: LucideIcon;
  accent?: FeatureAccent;
  className?: string;
}) {
  return (
    <p className={cn("inline-flex items-center gap-2 text-sm font-medium", featureAccentText[accent], className)}>
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </p>
  );
}

export type FeatureAccent = "teal" | "coral" | "amber" | "violet";

/** Marketing accent aliases mapped to the project palette (purple primary, teal accent, mint glow, success). */
export const featureAccents: FeatureAccent[] = ["teal", "violet", "coral", "amber"];

export const featureAccentStyles = {
  teal: "bg-accent text-accent-foreground border-border",
  coral: "bg-accent-glow/12 text-accent-glow-foreground border-border",
  amber: "bg-success/10 text-success border-success/20",
  violet: "bg-primary/10 text-primary border-primary/20"
} as const;

export const featureAccentIcon = {
  teal: "bg-accent text-accent-foreground",
  coral: "bg-accent-glow/15 text-accent-glow-foreground",
  amber: "bg-success/10 text-success",
  violet: "bg-primary/10 text-primary"
} as const;

export const featureAccentText = {
  teal: "text-[hsl(var(--chart-2))]",
  coral: "text-accent-glow-foreground",
  amber: "text-success",
  violet: "text-primary"
} as const;

export const featureAccentTint = {
  teal: "bg-accent/40 border-border hover:border-primary/25",
  coral: "bg-accent-glow/5 border-border hover:border-accent-glow/30",
  amber: "bg-success/[0.04] border-border hover:border-success/25",
  violet: "bg-primary/[0.04] border-primary/15 hover:border-primary/30"
} as const;

export const featureAccentSolid = {
  teal: "bg-[hsl(var(--chart-2))] text-primary-foreground",
  coral: "bg-accent-glow-foreground text-primary-foreground",
  amber: "bg-success text-white",
  violet: "bg-primary text-primary-foreground"
} as const;

export const featureAccentCallout = {
  teal: "border-border bg-accent/50",
  coral: "border-border bg-accent-glow/10",
  amber: "border-success/20 bg-success/[0.08]",
  violet: "border-primary/20 bg-primary/5"
} as const;

export const featureAccentDot = {
  teal: "bg-[hsl(var(--chart-2))]",
  coral: "bg-accent-glow-foreground",
  amber: "bg-success",
  violet: "bg-primary"
} as const;

export function FeatureCategoryCard({
  icon: Icon,
  title,
  description,
  accent = "violet",
  className
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: keyof typeof featureAccentStyles;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "flex h-full min-w-[240px] snap-start flex-col rounded-2xl border p-6 sm:min-w-0",
        featureAccentStyles[accent],
        className
      )}
      whileHover={reduceMotion ? undefined : { y: -6 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={landingSpring}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card/80">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </motion.div>
  );
}

export function TrustStrip({
  proofItems,
  metrics
}: {
  proofItems: readonly string[];
  metrics: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {proofItems.map((item) => (
          <span key={item} className="text-sm text-muted-foreground">
            {item}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const accent = featureAccents[index % featureAccents.length];
          return (
          <div
            key={metric.label}
            className={cn(
              "rounded-2xl border bg-card px-4 py-5 text-center shadow-subtle sm:px-5 sm:py-6",
              featureAccentTint[accent]
            )}
          >
            <p className={cn("text-2xl font-semibold tabular-nums sm:text-3xl", featureAccentText[accent])}>
              {metric.value}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">{metric.label}</p>
          </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProductFrame({
  children,
  title,
  className
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card landing-shadow-primary">
        {title ? (
          <div className="shrink-0 border-b border-border px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">{title}</span>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden bg-card">{children}</div>
      </div>
    </div>
  );
}

export function BentoCell({
  children,
  className,
  span = "default",
  tint,
  accent
}: {
  children: ReactNode;
  className?: string;
  span?: "default" | "wide" | "tall" | "hero";
  tint?: "default" | "primary" | "muted";
  accent?: FeatureAccent;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "group relative h-full overflow-hidden rounded-2xl border p-5 sm:p-6",
        accent && featureAccentTint[accent],
        !accent && "border-border hover:border-primary/25",
        !accent && tint === "primary" && "bg-primary/[0.04]",
        !accent && tint === "muted" && "bg-muted/50 border-border",
        !accent && tint === "default" && "bg-card border-border",
        span === "wide" && "md:col-span-2",
        span === "tall" && "md:row-span-2",
        span === "hero" && "md:col-span-2",
        className
      )}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={landingSpring}
    >
      {children}
    </motion.div>
  );
}

export function TopicScore({ label, value, tone = "primary" }: { label: string; value: number; tone?: "primary" | "success" | "warning" | "danger" }) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-danger"
          : "text-primary";

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", toneClass)}>{value}%</span>
    </div>
  );
}

export function AgentChip({ name, style, accent = "violet" }: { name: string; style: string; accent?: FeatureAccent }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-3">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          featureAccentSolid[accent]
        )}
      >
        {name
          .split(" ")
          .slice(0, 2)
          .map((part) => part[0])
          .join("")}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{style}</p>
      </div>
    </div>
  );
}

export function TestimonialCard({
  quote,
  name,
  role,
  accent = "violet",
  rating
}: {
  quote: string;
  name: string;
  role: string;
  accent?: FeatureAccent;
  rating?: number;
}) {
  return (
    <blockquote
      className={cn(
        "flex h-full flex-col rounded-2xl border border-border bg-card p-5 sm:p-6",
        "border-l-[3px]",
        accent === "teal" && "border-l-[hsl(var(--chart-2))]",
        accent === "coral" && "border-l-accent-glow-foreground",
        accent === "amber" && "border-l-success",
        accent === "violet" && "border-l-primary"
      )}
    >
      {rating && (
        <div className="mb-3 flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg
              key={i}
              className={cn("h-4 w-4", i < rating ? "fill-amber-500 text-amber-500" : "fill-muted text-muted")}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ))}
        </div>
      )}
      <p className="text-sm leading-relaxed text-foreground">&ldquo;{quote}&rdquo;</p>
      <footer className="mt-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{name}</span>
        {role ? ` · ${role}` : null}
      </footer>
    </blockquote>
  );
}

export const heroProofItems = [
  "Turn lecture PDFs into exam-realistic mocks",
  "Configure marking style once",
  "See weak topics before finals week"
] as const;
