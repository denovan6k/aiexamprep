import Link from "next/link";
import type { ReactNode } from "react";

import { LegalToc } from "@/components/legal/legal-toc";
import { asRoute, cn } from "@/lib/utils";

export type LegalSection = {
  id: string;
  title: string;
  body: string;
};

type LegalNavItem = {
  href: string;
  label: string;
};

type LegalRelatedItem = {
  href: string;
  label: string;
  description: string;
};

const legalNav: LegalNavItem[] = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/gdpr", label: "GDPR" }
];

function LegalBody({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/).filter(Boolean);

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const items = lines
          .filter((line) => line.trim().startsWith("•"))
          .map((line) => line.replace(/^\s*•\s*/, "").trim());
        const intro = lines
          .filter((line) => line.trim() && !line.trim().startsWith("•"))
          .join(" ");

        if (items.length > 0) {
          return (
            <div key={index} className="space-y-3">
              {intro ? <p className="break-words">{intro}</p> : null}
              <ul className="space-y-2 pl-1">
                {items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-foreground/50" aria-hidden />
                    <span className="min-w-0 break-words">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        return <p key={index} className="break-words">{block}</p>;
      })}
    </div>
  );
}

export function LegalCallout({
  title,
  children,
  tone = "muted"
}: {
  title: string;
  children: ReactNode;
  tone?: "muted" | "warning" | "info";
}) {
  return (
    <aside
      className={cn(
        "rounded-2xl border p-4 sm:p-6",
        tone === "warning" && "border-warning/30 bg-warning/5",
        tone === "info" && "border-primary/20 bg-primary/5",
        tone === "muted" && "border-border bg-muted/40"
      )}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </aside>
  );
}

export function LegalDocument({
  current,
  title,
  description,
  lastUpdated,
  sections,
  emphasis,
  related,
  children
}: {
  current: string;
  title: string;
  description: string;
  lastUpdated: string;
  sections: readonly LegalSection[];
  emphasis?: Record<string, "warning" | "info">;
  related?: readonly LegalRelatedItem[];
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl overflow-x-clip px-4 py-8 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg">
          {description}
        </p>
        <p className="mt-4 text-sm text-muted-foreground sm:mt-5">Last updated {lastUpdated}</p>
      </header>

      <div className="-mx-1 mt-6 flex flex-wrap gap-2 border-b border-border px-1 pb-5 sm:mt-8 sm:pb-6">
        {legalNav.map((item) => {
          const isCurrent = item.href === current;
          return (
            <Link
              key={item.href}
              href={asRoute(item.href)}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs transition-colors sm:px-3.5 sm:text-sm",
                isCurrent
                  ? "bg-foreground text-background"
                  : "border border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-8 grid min-w-0 items-start gap-8 lg:mt-14 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <LegalToc sections={sections} />
        </div>

        <div className="min-w-0">
          <article className="max-w-3xl">
            <div className="divide-y divide-border">
              {sections.map((section) => {
                const tone = emphasis?.[section.id];
                return (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-24 py-7 first:pt-0 last:pb-0 sm:py-10"
                  >
                    <h2 className="text-lg font-semibold tracking-tight sm:text-2xl">{section.title}</h2>
                    <div
                      className={cn(
                        "mt-4 break-words text-[15px] leading-[1.7] text-foreground/85 sm:text-base",
                        tone && "mt-5 rounded-2xl border p-5 sm:p-6",
                        tone === "warning" && "border-warning/30 bg-warning/5",
                        tone === "info" && "border-primary/20 bg-primary/5"
                      )}
                    >
                      <LegalBody text={section.body} />
                    </div>
                  </section>
                );
              })}
            </div>
          </article>

          {children ? <div className="mt-10 max-w-3xl space-y-4">{children}</div> : null}

          {related?.length ? (
            <div className="mt-12 max-w-3xl border-t border-border pt-8">
              <h2 className="text-sm font-medium text-foreground">Related policies</h2>
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
          ) : null}
        </div>
      </div>
    </main>
  );
}
