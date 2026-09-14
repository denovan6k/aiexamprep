"use client";

import { FileText } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { type CvTailoring, type TailoredSections } from "@/lib/cv";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function PreviewContent({ sections }: { sections: TailoredSections }) {
  const contact = sections.contact;
  return (
    <div className="space-y-5 rounded-lg border bg-background p-5">
      {contact?.name || contact?.email || contact?.phone || contact?.location || contact?.linkedin ? (
        <section className="space-y-1">
          {contact.name ? <h2 className="text-xl font-semibold tracking-tight">{contact.name}</h2> : null}
          <p className="text-sm text-muted-foreground">
            {[contact.email, contact.phone, contact.location, contact.linkedin].filter(Boolean).join(" | ")}
          </p>
        </section>
      ) : null}

      {sections.summary ? (
        <Section title="Professional Summary">
          <p className="text-sm leading-relaxed">{sections.summary}</p>
        </Section>
      ) : null}

      {sections.skills?.length ? (
        <Section title="Skills">
          <div className="flex flex-wrap gap-2">
            {sections.skills.map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        </Section>
      ) : null}

      {sections.experience?.length ? (
        <Section title="Experience">
          <div className="space-y-4">
            {sections.experience.map((role, index) => (
              <div key={`${role.company}-${role.title}-${index}`} className="space-y-2">
                <div>
                  <p className="text-sm font-medium">{[role.title, role.company].filter(Boolean).join(" | ")}</p>
                  {role.dates ? <p className="text-xs text-muted-foreground">{role.dates}</p> : null}
                </div>
                {role.bullets?.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                    {role.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {sections.education?.length ? (
        <Section title="Education">
          <div className="space-y-2">
            {sections.education.map((item, index) => (
              <p key={`${item.institution}-${item.degree}-${index}`} className="text-sm leading-relaxed">
                {[item.degree, item.institution, item.dates, item.details].filter(Boolean).join(" | ")}
              </p>
            ))}
          </div>
        </Section>
      ) : null}

      {sections.certifications?.length ? (
        <Section title="Certifications">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {sections.certifications.map((certification) => (
              <li key={certification}>{certification}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {sections.ats_keywords_matched?.length ? (
        <Section title="Matched Keywords">
          <div className="flex flex-wrap gap-2">
            {sections.ats_keywords_matched.map((keyword) => (
              <Badge key={keyword} variant="outline">
                {keyword}
              </Badge>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

export function CvTailoredPreview({ tailoring }: { tailoring: CvTailoring | null }) {
  if (!tailoring) {
    return (
      <EmptyState
        icon={FileText}
        title="No tailored CV selected"
        description="Generate a version for a role or open one from your tailoring history."
      />
    );
  }

  if (tailoring.status !== "completed") {
    return (
      <EmptyState
        icon={FileText}
        title={tailoring.status === "failed" ? "Tailoring failed" : "Tailoring in progress"}
        description={tailoring.error_message ?? "Knorvex is preparing the structured CV preview."}
      />
    );
  }

  if (!tailoring.tailored_sections) {
    return (
      <EmptyState
        icon={FileText}
        title="No preview available"
        description="The tailored CV completed, but no structured sections were returned."
      />
    );
  }

  return <PreviewContent sections={tailoring.tailored_sections} />;
}
