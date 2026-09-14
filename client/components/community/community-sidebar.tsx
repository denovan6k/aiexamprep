"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, ChevronRight, LogIn, LogOut, MessageSquare, UserCircle } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { SidebarNavFlat } from "@/components/sidebar/sidebar-nav-tree";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar
} from "@/components/ui/sidebar";
import type { CommunityGroup } from "@/lib/community";
import { communityBrowseItems, isActiveRoute } from "@/lib/sidebar-nav";
import { showSuccess } from "@/lib/toast";
import { asRoute, cn } from "@/lib/utils";

type CommunitySidebarProps = React.ComponentProps<typeof Sidebar> & {
  joinedGroups?: CommunityGroup[];
  onNavigate?: () => void;
};

export function CommunitySidebar({ joinedGroups = [], className, onNavigate, ...props }: CommunitySidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, signOut } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavigate = () => {
    onNavigate?.();
    if (isMobile) setOpenMobile(false);
  };

  const browseActive = communityBrowseItems.some((item) =>
    isActiveRoute(pathname, item.href, item.href === "/community" ? false : undefined)
  );
  const groupsActive = joinedGroups.some((group) => pathname.includes(`/community/groups/${group.slug}`));

  return (
    <Sidebar collapsible="icon" className={cn("border-r border-border bg-background", className)} {...props}>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">Community</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <Collapsible defaultOpen={browseActive || pathname.startsWith("/community/members")} className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="group/label w-full [&>svg]:hidden">
                Browse
                <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
              <SidebarGroupContent>
                <SidebarNavFlat items={communityBrowseItems} onNavigate={handleNavigate} />
                {user ? (
                  <SidebarMenu className="mt-1">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(`/community/members/${user.id}`)}
                        tooltip="My profile"
                      >
                        <Link href={asRoute(`/community/members/${user.id}`)} onClick={handleNavigate}>
                          <UserCircle />
                          <span>My profile</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                ) : null}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {token && joinedGroups.length > 0 ? (
          <Collapsible defaultOpen={groupsActive} className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="group/label w-full [&>svg]:hidden">
                  Your groups
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <SidebarGroupContent>
                  <ScrollArea className="max-h-64">
                    <SidebarMenu>
                      {joinedGroups.slice(0, 12).map((group) => (
                        <SidebarMenuItem key={group.id}>
                          <SidebarMenuButton
                            asChild
                            isActive={pathname.includes(`/community/groups/${group.slug}`)}
                            tooltip={group.name}
                          >
                            <Link href={asRoute(`/community/groups/${group.slug}`)} onClick={handleNavigate}>
                              <span className="truncate">{group.name}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </ScrollArea>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {token ? (
          <div className="space-y-2 p-2">
            <Button variant="outline" size="sm" className="w-full justify-start" asChild>
              <Link href={asRoute("/chat")} onClick={handleNavigate}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Chat
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={async () => {
                handleNavigate();
                await signOut();
                showSuccess("Signed out.");
                router.push("/sign-in");
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        ) : (
          <div className="p-2">
            <Button size="sm" className="w-full" asChild>
              <Link href={asRoute("/sign-in")} onClick={handleNavigate}>
                <LogIn className="mr-2 h-4 w-4" />
                Sign in to join
              </Link>
            </Button>
          </div>
        )}
        <Separator className="mx-2" />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
