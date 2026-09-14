"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

type KnorvexSplashMarkProps = {
  className?: string;
  size?: number;
};

const splashEase = [0.16, 1, 0.3, 1] as const;

export function KnorvexSplashMark({ className, size = 24 }: KnorvexSplashMarkProps) {
  const reduce = useReducedMotion();

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {reduce ? null : (
        <>
          <motion.span
            className="absolute inset-0 rounded-[22%] bg-primary/30"
            initial={{ scale: 0.75, opacity: 0.5 }}
            animate={{ scale: 2.05, opacity: 0 }}
            transition={{ duration: 1.9, repeat: Infinity, ease: splashEase }}
          />
          <motion.span
            className="absolute inset-0 rounded-[22%] bg-accent-glow/35"
            initial={{ scale: 0.75, opacity: 0.4 }}
            animate={{ scale: 2.05, opacity: 0 }}
            transition={{ duration: 1.9, delay: 0.55, repeat: Infinity, ease: splashEase }}
          />
          <motion.span
            className="absolute -inset-[18%] rounded-[30%] bg-primary/40 blur-md"
            animate={{ opacity: [0.22, 0.5, 0.22], scale: [0.94, 1.1, 0.94] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      <motion.span
        className="relative z-[1] block h-full w-full"
        initial={reduce ? false : { scale: 0.46, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", stiffness: 280, damping: 16, mass: 0.7 }
        }
      >
        <motion.span
          className="relative block h-full w-full overflow-hidden rounded-[22%]"
          animate={reduce ? undefined : { scale: [1, 1.045, 1] }}
          transition={
            reduce
              ? undefined
              : { duration: 2.6, delay: 0.4, repeat: Infinity, ease: "easeInOut" }
          }
        >
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="block h-full w-full"
          >
            <rect width="32" height="32" rx="7" className="fill-primary" />
            <motion.path
              d="M10.5 9v5.2"
              className="stroke-primary-foreground"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, delay: 0.12, ease: splashEase }}
            />
            <motion.path
              d="M10.5 15.8v7.2"
              className="stroke-primary-foreground"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, delay: 0.22, ease: splashEase }}
            />
            <motion.path
              d="M10.5 16L16.5 9"
              className="stroke-primary-foreground"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.18, ease: splashEase }}
            />
            <motion.path
              d="M10.5 16l9 8"
              className="stroke-primary-foreground"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.55, delay: 0.28, ease: splashEase }}
            />
            <circle cx="10.5" cy="15" r="1.1" className="fill-primary" />
            {reduce ? null : (
              <motion.circle
                cx="23"
                cy="9"
                r="5"
                className="fill-[hsl(var(--accent-glow))]"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.12, 0.38, 0.12] }}
                transition={{ duration: 1.8, delay: 0.45, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <motion.circle
              cx="23"
              cy="9"
              r="2"
              className="fill-[hsl(var(--accent-glow))]"
              initial={reduce ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 320, damping: 14, delay: 0.42 }
              }
            />
          </svg>
          {reduce ? null : (
            <motion.span
              className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-primary-foreground/55 to-transparent"
              initial={{ x: "-130%", skewX: -18 }}
              animate={{ x: "230%" }}
              transition={{
                duration: 1.35,
                delay: 0.55,
                repeat: Infinity,
                repeatDelay: 1.7,
                ease: "easeInOut"
              }}
            />
          )}
        </motion.span>
      </motion.span>
    </span>
  );
}
