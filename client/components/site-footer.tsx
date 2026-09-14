"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { asRoute } from "@/lib/utils";

const appPrefixes = [
  "/dashboard",
  "/chat",
  "/agents",
  "/quizzes",
  "/flashcards",
  "/progress",
  "/settings"
];

const footerLinks = {
  Product: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Chat", href: "/chat" },
    { label: "Agents", href: "/agents" }
  ],
  Resources: [
    { label: "Blog", href: "/blog" },
    { label: "Community", href: "/community" },
    { label: "FAQ", href: "/faq" },
    { label: "Contact", href: "/contact" }
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Privacy", href: "/privacy" },
    { label: "Cookies", href: "/cookies" },
    { label: "Terms", href: "/terms" },
    { label: "GDPR & Data Rights", href: "/gdpr" }
  ]
};

export function SiteFooter() {
  const pathname = usePathname();
  const isAppRoute = appPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (isAppRoute) return null;

  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <BrandLogo className="h-7 w-7" />
              {siteConfig.name}
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">{siteConfig.description}</p>
            <Button size="sm" className="mt-6 rounded-full" asChild>
              <Link href="/sign-up">Try it free</Link>
            </Button>
          </div>

          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <p className="text-sm font-semibold text-foreground">{group}</p>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={asRoute(link.href)}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-border py-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Link href={asRoute("/privacy")} className="hover:text-foreground">
              Privacy
            </Link>
            <Link href={asRoute("/cookies")} className="hover:text-foreground">
              Cookies
            </Link>
            <Link href={asRoute("/terms")} className="hover:text-foreground">
              Terms
            </Link>
            <Link href={asRoute("/gdpr")} className="hover:text-foreground">
              GDPR
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
