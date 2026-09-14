import type { Metadata } from "next";

import {
  LandingAudienceProofSection,
  LandingCtaSection,
  LandingFaqSection,
  LandingPricingSection,
  LandingProofStrip,
  LandingWorkflowSection
} from "@/components/home/landing-sections";
import {
  LandingFormatsPanSection,
  LandingProductStackSection
} from "@/components/home/landing-cinematic";
import { LandingScrollWordsSection } from "@/components/home/landing-scroll";
import { HomeHero } from "@/components/home/home-hero";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: `${siteConfig.name} | Practice from the notes you already have`,
  description:
    "Turn course materials into quizzes, mock exams, and flashcards that show you what to study next."
};

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <LandingProofStrip />
      <LandingScrollWordsSection text="Your notes already know this course. Now they can test you like the exam will." />
      <LandingWorkflowSection />
      <LandingFormatsPanSection />
      <LandingProductStackSection />
      <LandingAudienceProofSection />
      <LandingPricingSection />
      <LandingFaqSection />
      <LandingCtaSection />
    </>
  );
}
