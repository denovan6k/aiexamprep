"use client";

import Link from "next/link";
import { motion, useReducedMotion, useTransform } from "motion/react";
import { useRef } from "react";

import { HeroProductPreview } from "@/components/home/hero-product-preview";
import { LandingPrimaryCta } from "@/components/home/landing-auth-cta";
import { SubtleButton, WordReveal, landingEase } from "@/components/home/landing-motion";
import {
  LANDING_STICKY_CLASS,
  landingSpacing,
  useDesktopMedia,
  useLandingScroll
} from "@/components/home/landing-scroll";
import { featureAccentText, LandingContainer } from "@/components/home/landing-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function HomeHeroCopy({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="text-balance text-[1.75rem] font-medium leading-[1.15] tracking-tight min-[375px]:text-[2rem] sm:text-5xl lg:text-6xl">
        <WordReveal text="Stop rereading." className="block" />{" "}
        {reduceMotion ? (
          <span className={featureAccentText.teal}>Start getting tested.</span>
        ) : (
          <motion.span
            className={featureAccentText.teal}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease: landingEase }}
          >
            Start getting tested.
          </motion.span>
        )}
      </h1>

      <motion.p
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: landingEase }}
        className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:mt-5 sm:text-lg"
      >
        Upload your slides and readings. Knorvex builds mocks and flashcards that match how your
        professor tests.
      </motion.p>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15, ease: landingEase }}
        className="mt-7 flex flex-wrap justify-center gap-3 sm:mt-8"
      >
        <SubtleButton>
          <LandingPrimaryCta className="h-12 rounded-full px-7 text-sm shadow-elevated" />
        </SubtleButton>
        <SubtleButton>
          <Button size="lg" variant="outline" asChild className="h-12 rounded-full px-6 text-sm">
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </SubtleButton>
      </motion.div>
    </div>
  );
}

function HomeHeroProduct() {
  return (
    <div className="relative mt-8 sm:mt-10 lg:mt-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-6 bottom-0 rounded-[2rem] bg-gradient-to-b from-accent-glow/20 via-primary/8 to-transparent blur-3xl"
      />
      <div className="landing-hero-product-frame relative">
        <HeroProductPreview />
      </div>
    </div>
  );
}

function HomeHeroStatic({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <section
      className={cn(
        "landing-hero landing-hero-stack relative overflow-hidden pt-24",
        landingSpacing.sectionCompact,
        "pb-10 sm:pb-14"
      )}
    >
      <div aria-hidden className="landing-hero-glow pointer-events-none absolute inset-0" />
      <LandingContainer className="relative">
        <HomeHeroCopy reduceMotion={reduceMotion} />
        <HomeHeroProduct />
      </LandingContainer>
    </section>
  );
}

function HomeHeroCinematic() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useLandingScroll(sectionRef);

  const copyOpacity = useTransform(scrollYProgress, [0, 0.45, 0.92], [1, 1, 0]);
  const copyY = useTransform(scrollYProgress, [0, 0.45, 0.92], [0, 0, -72]);
  const productScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.88, 1, 1.04]);
  const productRotateX = useTransform(scrollYProgress, [0, 0.48], [12, 0]);
  const productY = useTransform(scrollYProgress, [0, 0.48, 1], [32, 0, -48]);

  return (
    <section
      ref={sectionRef}
      className="landing-hero landing-hero-stack relative overflow-hidden pb-10 pt-24 lg:h-[122vh] lg:overflow-visible lg:pb-0 lg:pt-0 xl:h-[126vh]"
    >
      <div aria-hidden className="landing-hero-glow pointer-events-none absolute inset-0" />
      <div
        className={cn(
          "lg:sticky lg:flex lg:min-h-[100dvh] lg:flex-col lg:overflow-hidden lg:pb-8 lg:pt-24",
          LANDING_STICKY_CLASS
        )}
      >
        <LandingContainer className="relative flex min-h-0 flex-1 flex-col justify-center">
          <motion.div style={{ opacity: copyOpacity, y: copyY }} className="will-change-transform">
            <HomeHeroCopy reduceMotion={false} />
          </motion.div>
          <motion.div
            style={{
              scale: productScale,
              rotateX: productRotateX,
              y: productY,
              transformPerspective: 1400,
              transformStyle: "preserve-3d"
            }}
            className="origin-top will-change-transform"
          >
            <HomeHeroProduct />
          </motion.div>
        </LandingContainer>
      </div>
    </section>
  );
}

export function HomeHero() {
  const reduceMotion = useReducedMotion();
  const isCinematic = useDesktopMedia();

  if (reduceMotion || !isCinematic) {
    return <HomeHeroStatic reduceMotion={reduceMotion} />;
  }

  return <HomeHeroCinematic />;
}
