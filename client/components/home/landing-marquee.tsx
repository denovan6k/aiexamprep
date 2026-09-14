"use client";

import { useEffect, useMemo, useState } from "react";
import Marquee from "react-fast-marquee";
import { Star } from "lucide-react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { featureAccentStyles, featureAccents, type FeatureAccent } from "@/components/home/landing-ui";

export function FormatPill({ label, accent }: { label: string; accent?: FeatureAccent }) {
  const resolved = accent ?? "violet";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full border px-5 py-2 text-sm",
        featureAccentStyles[resolved]
      )}
    >
      {label}
    </span>
  );
}

export function FormatsMarquee({ formats }: { formats: string[] }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div className="flex flex-wrap justify-center gap-3">
        {formats.map((format, index) => (
          <FormatPill key={format} label={format} accent={featureAccents[index % featureAccents.length]} />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden">
      <Marquee pauseOnHover speed={28} gradient={false}>
        {formats.map((format, index) => (
          <div key={format} className="px-3">
            <FormatPill label={format} accent={featureAccents[index % featureAccents.length]} />
          </div>
        ))}
      </Marquee>
    </div>
  );
}

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  rating: number;
};

function useColumnCount(compact: boolean) {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const update = () => {
      if (compact) {
        if (window.matchMedia("(min-width: 1024px)").matches) setCount(2);
        else setCount(1);
        return;
      }
      if (window.matchMedia("(min-width: 1280px)").matches) setCount(4);
      else if (window.matchMedia("(min-width: 1024px)").matches) setCount(3);
      else if (window.matchMedia("(min-width: 640px)").matches) setCount(2);
      else setCount(1);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [compact]);

  return count;
}

function splitIntoColumns<T>(items: T[], columnCount: number): T[][] {
  const columns = Array.from({ length: columnCount }, () => [] as T[]);
  items.forEach((item, index) => {
    columns[index % columnCount].push(item);
  });
  return columns;
}

function TestimonialCard({ testimonial, compact = false }: { testimonial: Testimonial; compact?: boolean }) {
  const initials = testimonial.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <figure
      className={cn(
        "flex w-full shrink-0 flex-col rounded-xl border border-border bg-card",
        compact ? "p-4" : "p-4 sm:p-5"
      )}
    >
      <div className="flex gap-0.5" aria-label={`${testimonial.rating} out of 5 stars`}>
        {Array.from({ length: testimonial.rating }).map((_, index) => (
          <Star key={index} className="h-3.5 w-3.5 fill-warning text-warning" />
        ))}
      </div>
      <blockquote
        className={cn(
          "mt-3 text-sm leading-relaxed text-foreground",
          compact ? "line-clamp-3" : "line-clamp-4"
        )}
      >
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-4 flex items-center gap-3 border-t border-border/60 pt-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{testimonial.name}</p>
          <p className="truncate text-xs text-muted-foreground">{testimonial.role}</p>
        </div>
      </figcaption>
    </figure>
  );
}

function VerticalTestimonialColumn({
  items,
  reverse = false,
  className,
  compact = false,
  animate = true
}: {
  items: Testimonial[];
  reverse?: boolean;
  className?: string;
  compact?: boolean;
  animate?: boolean;
}) {
  const loop = [...items, ...items];

  return (
    <div
      className={cn(
        "group relative overflow-hidden",
        compact ? "h-[16rem] sm:h-[18rem]" : "h-[22rem] sm:h-[24rem] lg:h-[26rem]",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-muted/15 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-muted/15 to-transparent"
      />
      <div
        className={cn(
          "flex flex-col gap-3 py-1",
          animate && "will-change-transform motion-reduce:transform-none",
          animate &&
            (reverse
              ? "animate-scroll-down group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]"
              : "animate-scroll-up group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]")
        )}
      >
        {(animate ? loop : items).map((testimonial, index) => (
          <TestimonialCard key={`${testimonial.name}-${index}`} testimonial={testimonial} compact={compact} />
        ))}
      </div>
    </div>
  );
}

export function TestimonialsMarquee({
  testimonials,
  compact = false
}: {
  testimonials: Testimonial[];
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const columnCount = useColumnCount(compact);
  const columns = useMemo(() => splitIntoColumns(testimonials, columnCount), [testimonials, columnCount]);

  if (reduceMotion) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {testimonials.slice(0, compact ? 4 : 6).map((testimonial) => (
          <TestimonialCard key={testimonial.name} testimonial={testimonial} compact={compact} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4",
        columnCount === 1 && "grid-cols-1",
        columnCount === 2 && "grid-cols-2",
        columnCount === 3 && "grid-cols-3",
        columnCount === 4 && "grid-cols-4"
      )}
    >
      {columns.map((column, index) => (
        <VerticalTestimonialColumn
          key={`col-${columnCount}-${index}`}
          items={column}
          reverse={index % 2 === 1}
          compact={compact}
          animate
        />
      ))}
    </div>
  );
}
