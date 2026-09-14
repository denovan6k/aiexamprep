import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { siteConfig } from "@/lib/site";
import { cookiePolicySections, legalLastUpdated } from "@/lib/content";

export const metadata: Metadata = {
  title: `Cookie Policy — ${siteConfig.name}`,
  description: `How ${siteConfig.name} uses cookies and similar technologies.`
};

export default function CookiesPage() {
  return (
    <LegalDocument
      current="/cookies"
      title="Cookie Policy"
      description={`${siteConfig.name} uses a small set of cookies to keep you signed in and remember your preferences. Here is exactly what we use and why.`}
      lastUpdated={legalLastUpdated}
      sections={cookiePolicySections}
      related={[
        {
          href: "/privacy",
          label: "Privacy Policy",
          description: "How we handle your personal data beyond cookies."
        },
        {
          href: "/gdpr",
          label: "GDPR & Data Rights",
          description: "Exercise access, deletion, and other data rights."
        }
      ]}
    />
  );
}
