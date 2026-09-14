import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

type AuthLayoutProps = {
  children: ReactNode;
  title: string;
  description: string;
  quote?: string;
  quoteBy?: string;
  className?: string;
};

export function AuthLayout({
  children,
  title,
  description,
  quote = "Every study session should leave you knowing exactly what to practice next.",
  quoteBy = siteConfig.name,
  className
}: AuthLayoutProps) {
  return (
    <main className="grid min-h-dvh overflow-y-auto bg-background lg:grid-cols-2">
      <section className="hidden border-r border-border bg-muted/30 lg:flex lg:flex-col">
        <div className="flex h-full flex-col justify-between p-10">
          <Link href="/" className="inline-flex w-fit items-center gap-2 font-medium tracking-tight">
            <BrandLogo className="h-8 w-8" />
            {siteConfig.name}
          </Link>

          <div className="max-w-md space-y-4">
            <p className="text-2xl font-medium leading-snug tracking-tight">{quote}</p>
            <p className="text-sm font-medium text-muted-foreground">{quoteBy}</p>
          </div>
        </div>
      </section>

      <section className="flex min-h-dvh flex-col px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center lg:justify-end">
          <Link href="/" className="inline-flex items-center gap-2 font-medium tracking-tight lg:hidden">
            <BrandLogo className="h-8 w-8" />
            {siteConfig.name}
          </Link>
        </div>

        <div className={cn("mx-auto flex w-full min-w-0 max-w-sm flex-1 flex-col justify-center py-10", className)}>
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
