"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { useAuth } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { asRoute, cn } from "@/lib/utils";

const publicLinks = [
  { label: "Product", href: "/#product" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "Blog", href: "/blog" },
  { label: "Community", href: "/community" }
];

const appPrefixes = [
  "/dashboard",
  "/chat",
  "/courses",
  "/agents",
  "/quizzes",
  "/flashcards",
  "/progress",
  "/settings"
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-medium tracking-tight">
      <BrandLogo showGlow className="h-7 w-7" />
      <span className="hidden text-sm sm:inline">{siteConfig.name}</span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { token } = useAuth();
  const isAppRoute = appPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isHome = pathname === "/";
  const isSignedIn = Boolean(token);

  if (isAppRoute) return null;

  const closeMobile = () => setMobileOpen(false);

  return (
    <header
      className={cn(
        "z-50 transition-all duration-300",
        isHome
          ? "pointer-events-none fixed inset-x-0 top-0 border-transparent bg-transparent"
          : "sticky top-0 border-b border-border bg-background/90 backdrop-blur-md"
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8",
          isHome &&
            "pointer-events-auto mt-3 h-12 max-w-[calc(72rem+2rem)] rounded-2xl border border-border/40 bg-background/70 px-4 shadow-sm backdrop-blur-lg dark:border-white/10 dark:bg-background/10 dark:shadow-none sm:px-5"
        )}
      >
        <Logo />

        <nav className="hidden items-center gap-5 lg:flex">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              href={asRoute(link.href)}
              className={cn(
                "link-underline text-sm text-muted-foreground transition-colors hover:text-foreground",
                pathname === link.href.replace(/#.*$/, "") && !link.href.includes("#") && "text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden items-center gap-2 md:flex">
            {isSignedIn ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={asRoute("/chat")}>Chat</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={asRoute("/dashboard")}>Dashboard</Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/sign-up">Try for free</Link>
                </Button>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          className={cn(
            "border-t border-border bg-background px-4 py-4 lg:hidden",
            isHome &&
              "pointer-events-auto mx-4 mt-2 rounded-2xl border border-border/50 bg-background/90 shadow-elevated backdrop-blur-lg dark:border-border/40 dark:bg-background/30"
          )}
        >
          <nav className="flex flex-col gap-1">
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={asRoute(link.href)}
                onClick={closeMobile}
                className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              {isSignedIn ? (
                <>
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link href={asRoute("/chat")} onClick={closeMobile}>
                      Chat
                    </Link>
                  </Button>
                  <Button size="sm" asChild className="w-full">
                    <Link href={asRoute("/dashboard")} onClick={closeMobile}>
                      Dashboard
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link href="/sign-in" onClick={closeMobile}>
                      Sign in
                    </Link>
                  </Button>
                  <Button size="sm" asChild className="w-full">
                    <Link href="/sign-up" onClick={closeMobile}>
                      Try for free
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
