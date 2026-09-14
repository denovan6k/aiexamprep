import type { Metadata } from "next";

import { LegalCallout, LegalDocument } from "@/components/legal/legal-document";
import { siteConfig } from "@/lib/site";
import { legalLastUpdated, termsOfServiceSections } from "@/lib/content";

export const metadata: Metadata = {
  title: `Terms of Service — ${siteConfig.name}`,
  description: `The terms that govern your use of ${siteConfig.name}.`
};

export default function TermsPage() {
  return (
    <LegalDocument
      current="/terms"
      title="Terms of Service"
      description={`These terms govern your use of ${siteConfig.name}. By using the platform you agree to them.`}
      lastUpdated={legalLastUpdated}
      sections={termsOfServiceSections}
      related={[
        {
          href: "/privacy",
          label: "Privacy Policy",
          description: "How we collect, use, and protect your personal data."
        },
        {
          href: "/gdpr",
          label: "GDPR & Data Rights",
          description: "Your rights over personal data and how to exercise them."
        }
      ]}
    >
      <LegalCallout title="Your responsibility for uploaded content" tone="warning">
        You are solely responsible for ensuring you have the legal right to upload, share, and process any
        materials you provide to {siteConfig.name}. Uploading copyrighted textbooks, course packs, or
        third-party documents without permission may infringe intellectual property rights.{" "}
        {siteConfig.name} is not liable for your use of materials you do not own or have rights to. Accounts
        that repeatedly infringe copyright may be suspended.
      </LegalCallout>
      <LegalCallout title="How your materials power AI responses" tone="info">
        Materials you upload are processed to extract text, which is stored securely in your account and used
        as context when generating quizzes, explanations, and flashcards. Without your material, the AI
        generates generic questions. With your material, every question and explanation is grounded in your
        specific course content. We do not use your uploads to train public AI models.
      </LegalCallout>
      <LegalCallout title="Study aid disclaimer">
        {siteConfig.name} is a study aid. AI-generated content may contain errors. Always verify critical
        information against your course syllabus and trusted sources.
      </LegalCallout>
    </LegalDocument>
  );
}
