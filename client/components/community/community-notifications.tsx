"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
  type CommunityNotification
} from "@/lib/community";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

function notificationHref(notification: CommunityNotification): string | null {
  if (notification.group_slug && notification.thread_id) {
    return `/community/groups/${notification.group_slug}/threads/${notification.thread_id}`;
  }
  if (notification.group_slug) {
    return `/community/groups/${notification.group_slug}`;
  }
  return null;
}

export function CommunityNotifications({
  token,
  onNavigate
}: {
  token: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, unread] = await Promise.all([
        listNotifications(token),
        unreadNotificationCount(token)
      ]);
      setNotifications(items);
      setUnreadCount(unread.unread_count);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  async function handleSelect(notification: CommunityNotification) {
    if (!notification.read_at) {
      await markNotificationRead(token, notification.id);
      setUnreadCount((count) => Math.max(0, count - 1));
      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
        )
      );
    }
    const href = notificationHref(notification);
    if (href) {
      setOpen(false);
      router.push(asRoute(href));
      onNavigate?.();
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead(token);
      setUnreadCount(0);
      setNotifications((items) =>
        items.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() }))
      );
      showSuccess("All notifications marked as read.");
    } catch (err) {
      showError(err, "Failed to mark notifications as read.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>Replies, upvotes, and group activity.</SheetDescription>
        </SheetHeader>
        {unreadCount > 0 ? (
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void handleMarkAllRead()}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        ) : null}
        <ScrollArea className="mt-4 h-[calc(100vh-10rem)] pr-3">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader variant="classic" size="md" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleSelect(notification)}
                  className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{notification.title}</span>
                    {!notification.read_at ? <Badge variant="secondary">New</Badge> : null}
                  </div>
                  {notification.body ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
