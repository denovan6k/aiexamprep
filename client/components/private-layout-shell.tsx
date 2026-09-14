"use client";

import { usePathname } from "next/navigation";
import {
  useMemo,
  type ReactNode
} from "react";

import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useBillingUsageQuery } from "@/hooks/use-billing";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Route titles
// ---------------------------------------------------------------------------

const routeTitles = [
  { href: "/admin/users", title: "User management" },
  { href: "/admin/analytics", title: "Analytics" },
  { href: "/admin/moderation", title: "Moderation" },
  { href: "/admin/support", title: "Support queue" },
  { href: "/admin/subscriptions", title: "Subscriptions" },
  { href: "/admin", title: "Admin overview" },
  { href: "/dashboard/blog", title: "Blog admin" },
  { href: "/settings/models", title: "Models" },
  { href: "/settings/billing", title: "Billing" },
  { href: "/settings", title: "Settings" },
  { href: "/community", title: "Community" },
  { href: "/progress", title: "Progress" },
  { href: "/usage", title: "Usage" },
  { href: "/flashcards", title: "Flashcards" },
  { href: "/quizzes", title: "Quizzes" },
  // { href: "/search", title: "Search" },
  { href: "/agents", title: "Agents" },
  { href: "/courses", title: "Courses" },
  { href: "/cv", title: "CV Tailor" },
  { href: "/projects", title: "Projects" },
  { href: "/dashboard", title: "Dashboard" },
  { href: "/chat", title: "Chat" },
];

function getRouteTitle(pathname: string) {
  return (
    routeTitles.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )?.title ?? "Workspace"
  );
}

function formatPlanLabel(planCode: string | null | undefined) {
  if (!planCode) return "Free";
  const normalized = planCode.toLowerCase();
  if (normalized.startsWith("enterprise") || normalized.startsWith("team")) return "Enterprise";
  if (normalized.startsWith("pro")) return "Pro";
  if (normalized === "free") return "Free";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LayoutHeader({ routeTitle }: { routeTitle: string }) {
  const { data: usage } = useBillingUsageQuery();
  const planLabel = formatPlanLabel(usage?.plan_code);
  const planVariant = useMemo(
    () => (planLabel === "Enterprise" ? "success" : planLabel === "Pro" ? "secondary" : "outline"),
    [planLabel]
  );

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/70 bg-background/95 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-2 lg:gap-3">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="hidden h-4 lg:block" />
        <p className="truncate text-sm font-medium">{routeTitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={planVariant} className="hidden sm:inline-flex">
          {planLabel} plan
        </Badge>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function PrivateLayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isChatRoute = pathname === "/chat" || pathname.startsWith("/chat/") || pathname.startsWith("/projects/");
  const routeTitle = getRouteTitle(pathname);

  return (
    <SidebarProvider className="h-dvh min-h-0 overflow-hidden bg-muted/45 p-0 text-foreground md:p-2">
      <AppSidebar />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-background lg:rounded-xl lg:border lg:border-border/70 lg:shadow-sm">
        {isChatRoute ? (
          <>
            <LayoutHeader routeTitle={routeTitle} />
            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 px-3 pt-3 sm:px-6 sm:pt-4">
                <EmailVerificationBanner />
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {children}
              </div>
            </main>
          </>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <LayoutHeader routeTitle={routeTitle} />
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
              <main className={cn("px-3 py-4 sm:px-6 md:py-6 lg:px-6")}>
                <EmailVerificationBanner />
                {children}
              </main>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
