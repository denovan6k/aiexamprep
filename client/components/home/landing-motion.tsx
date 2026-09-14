"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants
} from "motion/react";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export const landingSpring = {
  type: "spring" as const,
  stiffness: 260,
  damping: 28
};

export const landingEase = [0.22, 1, 0.36, 1] as const;

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: landingEase, delay }
  })
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 }
  }
};

export const wordRevealVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.025, delayChildren: 0 }
  }
};

export const wordChildVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: landingEase }
  }
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const handler = () => setReduced(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  return reduced;
}

export function MotionReveal({
  children,
  className,
  delay = 0,
  direction = "up"
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
}) {
  const reduced = usePrefersReducedMotion();

  const offset =
    direction === "up"
      ? { y: 24 }
      : direction === "down"
        ? { y: -24 }
        : direction === "left"
          ? { x: 24 }
          : direction === "right"
            ? { x: -24 }
            : {};

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={{ duration: 0.6, ease: landingEase, delay }}
    >
      {children}
    </motion.div>
  );
}

export function MotionStagger({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={staggerContainerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={fadeUpVariants}>
      {children}
    </motion.div>
  );
}

export function MotionProgressBar({
  value,
  className,
  tone = "primary"
}: {
  value: number;
  className?: string;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const reduced = usePrefersReducedMotion();
  const barTone =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : tone === "danger"
          ? "bg-danger"
          : "bg-primary";

  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        className={cn("h-full origin-left rounded-full", barTone)}
        initial={{ scaleX: reduced ? value / 100 : 0 }}
        whileInView={{ scaleX: value / 100 }}
        viewport={{ once: true, margin: "-20px" }}
        transition={{ duration: reduced ? 0 : 0.9, ease: landingEase, delay: 0.15 }}
      />
    </div>
  );
}

export function WordReveal({
  text,
  className,
  as: Tag = "span"
}: {
  text: string;
  className?: string;
  as?: "span" | "h1" | "h2" | "p";
}) {
  const reduced = useReducedMotion();
  const words = text.split(" ");

  if (reduced) {
    const Component = Tag;
    return <Component className={className}>{text}</Component>;
  }

  return (
    <motion.span
      className={className}
      variants={wordRevealVariants}
      initial="hidden"
      animate="visible"
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          variants={wordChildVariants}
          className="inline-block pr-[0.28em] last:pr-0"
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

export function SubtleButton({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cn("inline-flex", className)}
      whileHover={reduced ? undefined : { y: -1 }}
      whileTap={reduced ? undefined : { scale: 0.99 }}
      transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.6 }}
    >
      {children}
    </motion.div>
  );
}

export function TiltHover({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 160, damping: 18 });
  const springY = useSpring(y, { stiffness: 160, damping: 18 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-7, 7]);

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left) / rect.width - 0.5);
    y.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  return (
    <motion.div
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 1100 }}
      onMouseMove={onMove}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

export function HoverLift({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      whileHover={reduced ? undefined : { y: -4 }}
      transition={landingSpring}
    >
      {children}
    </motion.div>
  );
}
