"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { LogOut, MessageSquarePlus, X } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { ChatInboxScrollSections } from "@/components/chat/chat-sidebar-inbox";
import { useAuth } from "@/components/providers/auth-provider";
import { SidebarNavFlat, SidebarNavTree } from "@/components/sidebar/sidebar-nav-tree";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar
} from "@/components/ui/sidebar";
import { isSuperAdmin } from "@/lib/api";
import {
  accountNavItems,
  adminNavSection,
  workspaceNavItems
} from "@/lib/sidebar-nav";
import { siteConfig } from "@/lib/site";
import { showSuccess } from "@/lib/toast";
import { asRoute, cn } from "@/lib/utils";

type AppSidebarProps = React.ComponentProps<typeof Sidebar>;

function SidebarCloseButton() {
  const { isMobile, setOpenMobile } = useSidebar();

  if (!isMobile) return null;

  return (
    <Button variant="ghost" size="icon" onClick={() => setOpenMobile(false)} aria-label="Close sidebar">
      <X className="h-4 w-4" />
    </Button>
  );
}

export function AppSidebar({ className, ...props }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut, user } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const onNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  // ChatGPT-style: "New chat" is just the bare `/chat` view. No thread is
  // created until the first message is sent.
  const isNewChatActive = pathname === "/chat";

  async function handleSignOut() {
    onNavigate();
    await signOut();
    showSuccess("Signed out.");
    router.push("/sign-in");
  }

  const navWorkspaceItems = useMemo(
    () => workspaceNavItems.filter((item) => item.href !== "/chat"),
    []
  );

  return (
    <Sidebar
      collapsible="icon"
      className={cn("rounded-xl border border-border/70 bg-background shadow-sm", className)}
      {...props}
    >
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip={siteConfig.name}>
                <Link href={asRoute("/chat")} onClick={onNavigate}>
                  <BrandLogo className="h-7 w-7 shrink-0 rounded-lg" />
                  <span className="truncate font-semibold">{siteConfig.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarCloseButton />
        </div>
      </SidebarHeader>

      <div className="shrink-0 p-2 pb-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New chat"
              isActive={isNewChatActive}
              className={
                isNewChatActive
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  : undefined
              }
              onClick={() => {
                onNavigate();
                router.push(asRoute("/chat"));
              }}
            >
              <MessageSquarePlus />
              <span>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      <SidebarContent className="min-h-0 overflow-hidden">
        <div className="scrollbar-hover min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-1">
          {/* Flat Workspace Nav Items — placed directly under New Chat, with no Workspace section header */}
          <SidebarGroup className="p-2 py-0">
            <SidebarNavFlat items={navWorkspaceItems} onNavigate={onNavigate} />
          </SidebarGroup>

          {/* Chat Inbox History / Pinned Projects */}
          <ChatInboxScrollSections onNavigate={onNavigate} />

          {/* Admin Navigation (if super admin) */}
          {isSuperAdmin(user) ? (
            <SidebarNavTree sections={[adminNavSection]} onNavigate={onNavigate} />
          ) : null}
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/70">
        {user ? (
          <div className="mb-2 flex min-w-0 items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
              {user.email?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">Account</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        ) : null}
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarNavFlat items={accountNavItems} onNavigate={onNavigate} />
        </SidebarGroup>
        <Separator className="my-2" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign out" onClick={() => void handleSignOut()}>
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
