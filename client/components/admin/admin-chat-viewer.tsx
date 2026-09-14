"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminUserChatMessagesQuery, useAdminUserChatThreadsQuery } from "@/hooks/use-admin";

export function AdminChatViewer({ userId }: { userId: string }) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const { data: threads, isLoading } = useAdminUserChatThreadsQuery(userId);
  const { data: messages, isLoading: messagesLoading } = useAdminUserChatMessagesQuery(
    userId,
    selectedThreadId
  );

  if (isLoading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const threadItems = threads?.items ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Threads</CardTitle>
          <CardDescription>Read-only chat oversight</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {threadItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chat threads.</p>
          ) : (
            threadItems.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setSelectedThreadId(thread.id)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50 ${
                  selectedThreadId === thread.id ? "border-primary bg-muted/40" : ""
                }`}
              >
                <p className="font-medium">{thread.title}</p>
                <p className="text-muted-foreground">{thread.message_count} messages</p>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Messages</CardTitle>
          <CardDescription>
            {selectedThreadId ? "Conversation history" : "Select a thread to view messages"}
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[480px] space-y-3 overflow-y-auto">
          {!selectedThreadId ? (
            <p className="text-sm text-muted-foreground">No thread selected.</p>
          ) : messagesLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : (messages?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages in this thread.</p>
          ) : (
            messages?.items.map((message) => (
              <div key={message.id} className="rounded-lg border p-3 text-sm">
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">{message.role}</p>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
