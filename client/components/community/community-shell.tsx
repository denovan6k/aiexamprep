"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { CommunityNotifications } from "@/components/community/community-notifications";
import { CommunitySidebar } from "@/components/community/community-sidebar";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { listCommunityGroups, type CommunityGroup } from "@/lib/community";

export function CommunityShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token } = useAuth();
  const [joinedGroups, setJoinedGroups] = useState<CommunityGroup[]>([]);

  const loadJoinedGroups = useCallback(async () => {
    if (!token) {
      setJoinedGroups([]);
      return;
    }
    const groups = await listCommunityGroups(token).catch(() => []);
    setJoinedGroups(groups.filter((group) => group.is_member));
  }, [token]);

  useEffect(() => {
    void loadJoinedGroups();
  }, [loadJoinedGroups]);

  return (
    <SidebarProvider className="flex min-h-0 flex-1 bg-background">
      <CommunitySidebar joinedGroups={joinedGroups} />
      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1 lg:hidden" />
            <Separator orientation="vertical" className="hidden h-4 lg:block" />
            <p className="text-sm text-muted-foreground">Study community</p>
          </div>
          <div className="flex items-center gap-2">
            {token ? (
              <CommunityNotifications token={token} onNavigate={() => router.refresh()} />
            ) : (
              <Button variant="ghost" size="icon" disabled aria-label="Notifications">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4 lg:px-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
