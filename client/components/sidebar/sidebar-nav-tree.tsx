"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import { type NavItem, type NavSection, isActiveRoute, sectionHasActiveRoute, workspaceNavSections } from "@/lib/sidebar-nav";
import { asRoute, cn } from "@/lib/utils";

type SidebarNavTreeProps = {
  sections?: NavSection[];
  onNavigate?: () => void;
};

function NavMenuItem({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const Icon = item.icon;
  const active = isActiveRoute(pathname, item.href, item.exact);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="h-9">
        <Link href={asRoute(item.href)} onClick={onNavigate}>
          <Icon className={cn(active ? "text-primary" : "text-muted-foreground")} />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function SidebarNavTree({ sections = workspaceNavSections, onNavigate }: SidebarNavTreeProps) {
  const pathname = usePathname();

  return (
    <>
      {sections.map((section) => {
        const defaultOpen = section.defaultOpen ?? sectionHasActiveRoute(pathname, section);

        return (
          <Collapsible key={section.id} defaultOpen={defaultOpen} className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="group/label flex w-full items-center">
                  {section.title}
                  <ChevronRight className="ml-auto size-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <NavMenuItem key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        );
      })}
    </>
  );
}

export function SidebarNavFlat({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <SidebarGroupContent>
      <SidebarMenu>
        {items.map((item) => (
          <NavMenuItem key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  );
}
