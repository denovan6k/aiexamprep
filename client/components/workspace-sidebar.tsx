"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { workspaceNavItems } from "@/lib/sidebar-nav";
import { asRoute, cn } from "@/lib/utils";

export { workspaceNavItems } from "@/lib/sidebar-nav";

const mobilePrimaryHrefs = new Set(["/chat", "/dashboard", "/search", "/courses"]);

/** Compact mobile shortcuts — full nav lives in the sidebar sheet. */
export function WorkspaceMobileNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const primaryItems = workspaceNavItems.filter((item) => mobilePrimaryHrefs.has(item.href));

  return (
    <nav className={cn("flex flex-wrap items-center gap-1.5 px-3 py-2", className)}>
      {primaryItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={asRoute(item.href)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            {item.label}
          </Link>
        );
      })}
      <SidebarTrigger className="ml-auto h-8 w-8 shrink-0 md:hidden" />
    </nav>
  );
}
