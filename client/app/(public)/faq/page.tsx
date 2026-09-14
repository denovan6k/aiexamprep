import type { Metadata } from "next";
import Link from "next/link";

import { LegalToc } from "@/components/legal/legal-toc";
import { PrimaryLink } from "@/components/page-kit";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqCategories, faqs } from "@/lib/content";
import { siteConfig } from "@/lib/site";
import { asRoute } from "@/lib/utils";

export const metadata: Metadata = {
  title: `FAQ — ${siteConfig.name}`,
  description: `Answers about uploads, quizzes, billing, and community privacy on ${siteConfig.name}.`
};

const related = [
  {
    href: "/contact",
    label: "Contact support",
    description: "Reach the team if your question is not covered here."
  },
  {
    href: "/privacy",
    label: "Privacy principles",
    description: `How ${siteConfig.name} handles your study materials.`
  }
] as const;

export default function FaqPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">Common questions</h1>
        <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
          Everything you need to know before your first study session, from uploads to billing to community privacy.
        </p>
        <div className="mt-6">
          <PrimaryLink href="/sign-up">Try it free</PrimaryLink>
        </div>
      </header>

      <div className="mt-10 grid items-start gap-10 lg:mt-14 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
        <LegalToc sections={faqCategories} />

        <div className="min-w-0 max-w-3xl">
          <div className="space-y-12 sm:space-y-14">
            {faqCategories.map((category) => {
              const categoryFaqs = faqs.filter((faq) => faq.category === category.id);
              if (categoryFaqs.length === 0) return null;

              return (
                <section key={category.id} id={category.id} className="scroll-mt-24">
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{category.title}</h2>
                  <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {category.description}
                  </p>
                  <Accordion
                    type="single"
                    collapsible
                    className="mt-5 rounded-2xl border border-border bg-card px-2 sm:px-3"
                  >
                    {categoryFaqs.map((faq, index) => (
                      <AccordionItem
                        key={faq.question}
                        value={`${category.id}-${index}`}
                        className="border-border/60 px-3 last:border-b-0 sm:px-4"
                      >
                        <AccordionTrigger className="py-5 text-[15px] font-medium hover:no-underline">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="pb-5 text-[15px] leading-relaxed text-muted-foreground">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              );
            })}
          </div>

          <div className="mt-12 border-t border-border pt-8 sm:mt-16">
            <h2 className="text-sm font-medium text-foreground">Still need help?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((item) => (
                <Link
                  key={item.href}
                  href={asRoute(item.href)}
                  className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
                >
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
