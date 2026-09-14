import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { siteConfig } from "@/lib/site";
import { gdprSections, legalLastUpdated } from "@/lib/content";

export const metadata: Metadata = {
  title: `GDPR & Data Rights — ${siteConfig.name}`,
  description: `Your data protection rights and how ${siteConfig.name} handles GDPR compliance.`
};

export default function GdprPage() {
  return (
    <LegalDocument
      current="/gdpr"
      title="GDPR & Data Rights"
      description="Your rights over personal data, how we handle cross-border transfers, your responsibility for uploaded materials, and how those materials are used to power AI responses."
      lastUpdated={legalLastUpdated}
      sections={gdprSections}
      emphasis={{
        "copyright-materials": "warning",
        "ai-use-of-materials": "info"
      }}
      related={[
        {
          href: "/privacy",
          label: "Privacy Policy",
          description: "Full details on data collection, retention, and sharing."
        },
        {
          href: "/terms",
          label: "Terms of Service",
          description: "Acceptable use and content responsibility."
        },
        {
          href: "/cookies",
          label: "Cookie Policy",
          description: "What cookies we set and how to manage them."
        }
      ]}
    />
  );
}
