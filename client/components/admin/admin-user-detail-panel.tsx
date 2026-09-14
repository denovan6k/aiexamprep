"use client";

import Link from "next/link";
import { AdminUserDetailSkeleton } from "@/components/admin/admin-user-detail-skeleton";

import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminChatViewer } from "@/components/admin/admin-chat-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, SectionGrid, Stat } from "@/components/page-kit";
import {
  useAdminAppealsQuery,
  useAdminSupportTicketsQuery,
  useAdminUserQuery,
  useAdminUserUsageQuery,
  useGrantAdminSubscriptionMutation,
  useRevokeAdminUserSessionsMutation,
  useUpdateAdminUserMutation
} from "@/hooks/use-admin";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

export function AdminUserDetailPanel({ userId }: { userId: string }) {
  const { data: user, isLoading, error } = useAdminUserQuery(userId);
  const { data: usage } = useAdminUserUsageQuery(userId);
  const { data: tickets } = useAdminSupportTicketsQuery({ user_id: userId, limit: 10 });
  const { data: appeals } = useAdminAppealsQuery({ user_id: userId, limit: 10, status: undefined });
  const updateUser = useUpdateAdminUserMutation();
  const revokeSessions = useRevokeAdminUserSessionsMutation();
  const grantSubscription = useGrantAdminSubscriptionMutation();

  async function handleToggleActive() {
    if (!user) return;
    try {
      await updateUser.mutateAsync({ userId, body: { is_active: !user.is_active } });
      showSuccess(user.is_active ? "User suspended." : "User reactivated.");
    } catch (err) {
      showError(err, "Failed to update user.");
    }
  }

  async function handleToggleRole() {
    if (!user) return;
    const nextRole = user.role === "super_admin" ? "user" : "super_admin";
    try {
      await updateUser.mutateAsync({ userId, body: { role: nextRole } });
      showSuccess(nextRole === "super_admin" ? "Super admin granted." : "Super admin removed.");
    } catch (err) {
      showError(err, "Failed to update role.");
    }
  }

  async function handleRevokeSessions() {
    try {
      await revokeSessions.mutateAsync(userId);
      showSuccess("Sessions revoked.");
    } catch (err) {
      showError(err, "Failed to revoke sessions.");
    }
  }

  async function handleGrantPro() {
    try {
      await grantSubscription.mutateAsync({ userId, planCode: "pro_monthly" });
      showSuccess("Pro monthly granted.");
    } catch (err) {
      showError(err, "Failed to grant subscription.");
    }
  }

  if (isLoading) {
    return (
      <AdminGuard>
        <AdminUserDetailSkeleton />
      </AdminGuard>
    );
  }

  if (error || !user) {
    return (
      <AdminGuard>
        <Card>
          <CardHeader>
            <CardTitle>User not found</CardTitle>
            <CardDescription>{error?.message ?? "This user could not be loaded."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={asRoute("/admin/users")}>Back to users</Link>
            </Button>
          </CardContent>
        </Card>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href={asRoute("/admin/users")}>← Back to users</Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="User detail"
        title={user.full_name}
        description={user.email}
      />

      <div className="mt-8 space-y-6">
        <SectionGrid cols={4}>
          <Stat label="Plan" value={user.subscription.plan_code} />
          <Stat label="Sessions" value={String(user.active_sessions)} />
          <Stat label="Courses" value={String(user.activity.courses)} />
          <Stat label="Chat threads" value={String(user.activity.chat_threads)} />
        </SectionGrid>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="activity">Tickets & appeals</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={user.is_active ? "outline" : "destructive"}>
                    {user.is_active ? "Active" : "Suspended"}
                  </Badge>
                  <Badge>{user.role}</Badge>
                  {user.is_email_verified ? <Badge variant="secondary">Email verified</Badge> : null}
                </div>
                {user.institution_name ? (
                  <p className="text-muted-foreground">Institution: {user.institution_name}</p>
                ) : null}
                <p className="text-muted-foreground">
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => void handleToggleActive()} disabled={updateUser.isPending}>
                    {user.is_active ? "Suspend user" : "Reactivate user"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleToggleRole()} disabled={updateUser.isPending}>
                    {user.role === "super_admin" ? "Remove super admin" : "Make super admin"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleRevokeSessions()} disabled={revokeSessions.isPending}>
                    Revoke sessions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription</CardTitle>
                <CardDescription>Current billing state and Stripe identifiers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Plan: {user.subscription.plan_name ?? user.subscription.plan_code}</p>
                <p>Status: {user.subscription.status ?? "none"}</p>
                {user.subscription.stripe_customer_id ? (
                  <p className="text-muted-foreground">Customer: {user.subscription.stripe_customer_id}</p>
                ) : null}
                {user.subscription.current_period_end ? (
                  <p className="text-muted-foreground">
                    Period ends: {new Date(user.subscription.current_period_end).toLocaleDateString()}
                  </p>
                ) : null}
                <Button size="sm" className="mt-3" onClick={() => void handleGrantPro()} disabled={grantSubscription.isPending}>
                  Grant Pro monthly
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="mt-4">
            <SectionGrid cols={3}>
              <Stat label="Courses" value={String(usage?.courses_used ?? 0)} />
              <Stat label="Uploads" value={String(usage?.material_uploads_used ?? 0)} />
              <Stat label="Quiz gens" value={String(usage?.quiz_generations_used ?? 0)} />
              <Stat label="Flashcards" value={String(usage?.flashcard_generations_used ?? 0)} />
              <Stat label="Agents" value={String(usage?.agent_creates_used ?? 0)} />
              <Stat label="Chat msgs" value={String(usage?.chat_messages_used ?? 0)} />
            </SectionGrid>
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <AdminChatViewer userId={userId} />
          </TabsContent>

          <TabsContent value="activity" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Support tickets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(tickets?.items ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No support tickets.</p>
                ) : (
                  tickets?.items.map((ticket) => (
                    <div key={ticket.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{ticket.subject}</p>
                      <p className="text-muted-foreground">{ticket.status} · {ticket.category}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Moderation appeals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(appeals?.items ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No appeals.</p>
                ) : (
                  appeals?.items.map((appeal) => (
                    <div key={appeal.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{appeal.appeal_type}</p>
                      <p className="text-muted-foreground">{appeal.status}</p>
                      <p className="mt-1">{appeal.reason}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminGuard>
  );
}
