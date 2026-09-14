"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminTableActions, AdminTableShell } from "@/components/admin/admin-table-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-kit";
import { useAdminSubscriptionsQuery } from "@/hooks/use-admin";
import { useListPageState } from "@/hooks/use-list-page-state";
import { asRoute } from "@/lib/utils";
import { TableCell, TableRow } from "@/components/ui/table";

export function AdminSubscriptionsPanel() {
  const listState = useListPageState();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useAdminSubscriptionsQuery({
    limit: listState.limit,
    offset: listState.offset,
    status: statusFilter === "all" ? undefined : statusFilter
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const toolbar = (
    <Select
      value={statusFilter}
      onValueChange={(value) => {
        setStatusFilter(value);
        listState.setOffset(0);
      }}
    >
      <SelectTrigger className="w-full sm:w-[180px]">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="trialing">Trialing</SelectItem>
        <SelectItem value="canceled">Canceled</SelectItem>
        <SelectItem value="incomplete">Incomplete</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <AdminGuard>
      <PageHeader
        eyebrow="Admin"
        title="Subscriptions"
        description="All platform subscriptions and billing status."
      />

      <div className="mt-8">
        <AdminTableShell
          title="Subscription ledger"
          description="Track plan assignments and billing lifecycle."
          toolbar={toolbar}
          columns={["Customer", "Plan", "Status", "Period end", "Actions"]}
          columnClassNames={[undefined, "w-[140px]", "w-[120px]", "w-[140px]", "w-[100px] text-right"]}
          isLoading={isLoading}
          isEmpty={!isLoading && items.length === 0}
          emptyTitle="No subscriptions"
          emptyDescription="No subscriptions match the selected filter."
          total={total}
          limit={listState.limit}
          offset={listState.offset}
          onPageChange={listState.setOffset}
        >
          {items.map((subscription) => (
            <TableRow key={subscription.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{subscription.user_name}</p>
                  <p className="text-sm text-muted-foreground">{subscription.user_email}</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{subscription.plan_code ?? "free"}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge>{subscription.status}</Badge>
                  {subscription.cancel_at_period_end ? (
                    <Badge variant="secondary">Canceling</Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString()
                  : "—"}
              </TableCell>
              <TableCell>
                <AdminTableActions>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={asRoute(`/admin/users/${subscription.user_id}`)}>
                      <ExternalLink className="mr-1 size-3.5" />
                      View user
                    </Link>
                  </Button>
                </AdminTableActions>
              </TableCell>
            </TableRow>
          ))}
        </AdminTableShell>
      </div>
    </AdminGuard>
  );
}
