"use client";

import Link from "next/link";
import { Eye, Loader2 } from "lucide-react";
import { useState } from "react";

import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminTableActions, AdminTableShell } from "@/components/admin/admin-table-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-kit";
import { useAdminSupportTicketsQuery, useUpdateAdminSupportTicketMutation } from "@/hooks/use-admin";
import { useListPageState } from "@/hooks/use-list-page-state";
import type { SupportTicket } from "@/lib/admin";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";
import { TableCell, TableRow } from "@/components/ui/table";

export function AdminSupportPanel() {
  const listState = useListPageState();
  const [statusFilter, setStatusFilter] = useState("open");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading, refetch } = useAdminSupportTicketsQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: listState.limit,
    offset: listState.offset
  });
  const updateTicket = useUpdateAdminSupportTicketMutation();

  const tickets = data?.items ?? [];
  const total = data?.total ?? 0;

  function openTicket(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    setNotes(ticket.admin_notes ?? "");
  }

  async function updateStatus(status: "open" | "in_progress" | "resolved" | "closed") {
    if (!selectedTicket) return;
    try {
      await updateTicket.mutateAsync({
        ticketId: selectedTicket.id,
        body: { status, admin_notes: notes }
      });
      setSelectedTicket(null);
      showSuccess(
        status === "resolved"
          ? "Ticket resolved."
          : status === "closed"
            ? "Ticket closed."
            : "Ticket updated."
      );
      void refetch();
    } catch (err) {
      showError(err, "Failed to update ticket.");
    }
  }

  const toolbar = (
    <Select
      value={statusFilter}
      onValueChange={(value) => {
        setStatusFilter(value);
        listState.setOffset(0);
      }}
    >
      <SelectTrigger className="w-full sm:w-[180px]">
        <SelectValue placeholder="Filter by status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        <SelectItem value="open">Open</SelectItem>
        <SelectItem value="in_progress">In progress</SelectItem>
        <SelectItem value="resolved">Resolved</SelectItem>
        <SelectItem value="closed">Closed</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <AdminGuard>
      <PageHeader
        eyebrow="Admin"
        title="Support queue"
        description="Review and resolve user support tickets."
      />

      <div className="mt-8">
        <AdminTableShell
          title="Support tickets"
          description="Open a ticket to review the message and take action."
          toolbar={toolbar}
          columns={["Subject", "User", "Category", "Status", "Created", "Actions"]}
          columnClassNames={[undefined, undefined, "w-[120px]", "w-[120px]", "w-[140px]", "w-[160px] text-right"]}
          isLoading={isLoading}
          isEmpty={!isLoading && tickets.length === 0}
          emptyTitle="No tickets"
          emptyDescription="No support tickets match this filter."
          total={total}
          limit={listState.limit}
          offset={listState.offset}
          onPageChange={listState.setOffset}
        >
          {tickets.map((ticket) => (
            <TableRow key={ticket.id}>
              <TableCell>
                <p className="max-w-[280px] truncate font-medium">{ticket.subject}</p>
              </TableCell>
              <TableCell>
                <Link href={asRoute(`/admin/users/${ticket.user_id}`)} className="text-sm hover:underline">
                  {ticket.user_email ?? ticket.user_name ?? ticket.user_id}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{ticket.category}</Badge>
              </TableCell>
              <TableCell>
                <Badge>{ticket.status}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(ticket.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <AdminTableActions>
                  <Button variant="outline" size="sm" onClick={() => openTicket(ticket)}>
                    <Eye className="mr-1 size-3.5" />
                    Review
                  </Button>
                </AdminTableActions>
              </TableCell>
            </TableRow>
          ))}
        </AdminTableShell>
      </div>

      <Sheet open={Boolean(selectedTicket)} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selectedTicket ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTicket.subject}</SheetTitle>
                <SheetDescription>
                  {selectedTicket.user_email ?? selectedTicket.user_name} · {selectedTicket.category} ·{" "}
                  {new Date(selectedTicket.created_at).toLocaleString()}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 px-1">
                <div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                  {selectedTicket.body}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Internal notes</p>
                  <Textarea
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Notes visible to admins only"
                  />
                </div>
              </div>
              <SheetFooter className="mt-6 gap-2 sm:flex-col sm:space-x-0">
                <Button
                  variant="outline"
                  disabled={updateTicket.isPending}
                  onClick={() => void updateStatus("in_progress")}
                >
                  {updateTicket.isPending ? <Loader2 className="size-4 animate-spin" /> : "Mark in progress"}
                </Button>
                <Button disabled={updateTicket.isPending} onClick={() => void updateStatus("resolved")}>
                  Resolve ticket
                </Button>
                <Button
                  variant="secondary"
                  disabled={updateTicket.isPending}
                  onClick={() => void updateStatus("closed")}
                >
                  Close ticket
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </AdminGuard>
  );
}
