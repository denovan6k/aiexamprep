import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { siteConfig } from "@/lib/site";
import { legalLastUpdated, privacyPolicySections } from "@/lib/content";

export const metadata: Metadata = {
  title: `Privacy Policy — ${siteConfig.name}`,
  description: `How ${siteConfig.name} collects, uses, and protects your personal data.`
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      current="/privacy"
      title="Privacy Policy"
      description={`${siteConfig.name} handles your academic materials with care. This policy explains what we collect, why, and your rights over your data.`}
      lastUpdated={legalLastUpdated}
      sections={privacyPolicySections}
      related={[
        {
          href: "/gdpr",
          label: "GDPR & Data Rights",
          description: "Rights specific to EEA, UK, and equivalent jurisdictions."
        },
        {
          href: "/contact",
          label: "Contact",
          description: "Questions about this policy can be sent through the contact page."
        }
      ]}
    />
  );
}
