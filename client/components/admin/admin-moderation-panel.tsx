"use client";

import Link from "next/link";
import { Check, Eye, Loader2, X } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-kit";
import {
  useAdminAppealsQuery,
  useAdminReportsQuery,
  useResolveAdminAppealMutation,
  useResolveAdminReportMutation
} from "@/hooks/use-admin";
import { useListPageState } from "@/hooks/use-list-page-state";
import type { AdminContentReport, ModerationAppeal } from "@/lib/admin";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";
import { TableCell, TableRow } from "@/components/ui/table";

type ReviewTarget =
  | { type: "report"; item: AdminContentReport }
  | { type: "appeal"; item: ModerationAppeal };

export function AdminModerationPanel() {
  const listState = useListPageState();
  const [reportStatus, setReportStatus] = useState("open");
  const [appealStatus, setAppealStatus] = useState("pending");
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [notes, setNotes] = useState("");

  const { data: reports, isLoading: reportsLoading, refetch: refetchReports } = useAdminReportsQuery({
    status: reportStatus === "all" ? undefined : reportStatus,
    limit: listState.limit,
    offset: listState.offset
  });
  const { data: appeals, isLoading: appealsLoading, refetch: refetchAppeals } = useAdminAppealsQuery({
    status: appealStatus === "all" ? undefined : appealStatus,
    limit: listState.limit,
    offset: listState.offset
  });

  const resolveReport = useResolveAdminReportMutation();
  const resolveAppeal = useResolveAdminAppealMutation();

  function openReview(target: ReviewTarget) {
    setReviewTarget(target);
    setNotes("");
  }

  async function handleResolveReport(status: "resolved" | "dismissed") {
    if (!reviewTarget || reviewTarget.type !== "report") return;
    try {
      await resolveReport.mutateAsync({
        reportId: reviewTarget.item.id,
        status,
        notes
      });
      setReviewTarget(null);
      showSuccess(status === "resolved" ? "Report resolved." : "Report dismissed.");
      void refetchReports();
    } catch (err) {
      showError(err, "Failed to resolve report.");
    }
  }

  async function handleResolveAppeal(status: "approved" | "rejected") {
    if (!reviewTarget || reviewTarget.type !== "appeal") return;
    try {
      await resolveAppeal.mutateAsync({
        appealId: reviewTarget.item.id,
        status,
        adminResponse: notes
      });
      setReviewTarget(null);
      showSuccess(status === "approved" ? "Appeal approved." : "Appeal rejected.");
      void refetchAppeals();
    } catch (err) {
      showError(err, "Failed to resolve appeal.");
    }
  }

  const reportItems = reports?.items ?? [];
  const appealItems = appeals?.items ?? [];

  return (
    <AdminGuard>
      <PageHeader
        eyebrow="Admin"
        title="Moderation"
        description="Platform-wide content reports and user appeals."
      />

      <div className="mt-8">
        <Tabs defaultValue="reports">
          <TabsList>
            <TabsTrigger value="reports">Content reports</TabsTrigger>
            <TabsTrigger value="appeals">Appeals</TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="mt-4">
            <AdminTableShell
              title="Content reports"
              toolbar={
                <Select
                  value={reportStatus}
                  onValueChange={(value) => {
                    setReportStatus(value);
                    listState.setOffset(0);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              }
              columns={["Reason", "Target", "Reporter", "Status", "Created", "Actions"]}
              columnClassNames={[undefined, "w-[120px]", undefined, "w-[110px]", "w-[120px]", "w-[120px] text-right"]}
              isLoading={reportsLoading}
              isEmpty={!reportsLoading && reportItems.length === 0}
              emptyTitle="No reports"
              emptyDescription="No content reports match this filter."
              total={reports?.total ?? 0}
              limit={listState.limit}
              offset={listState.offset}
              onPageChange={listState.setOffset}
            >
              {reportItems.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">{report.reason}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{report.target_type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {report.reporter_email ?? report.reporter_id}
                  </TableCell>
                  <TableCell>
                    <Badge>{report.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(report.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <AdminTableActions>
                      <Button variant="outline" size="sm" onClick={() => openReview({ type: "report", item: report })}>
                        <Eye className="mr-1 size-3.5" />
                        Review
                      </Button>
                    </AdminTableActions>
                  </TableCell>
                </TableRow>
              ))}
            </AdminTableShell>
          </TabsContent>

          <TabsContent value="appeals" className="mt-4">
            <AdminTableShell
              title="Moderation appeals"
              toolbar={
                <Select
                  value={appealStatus}
                  onValueChange={(value) => {
                    setAppealStatus(value);
                    listState.setOffset(0);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              }
              columns={["Type", "User", "Status", "Created", "Actions"]}
              columnClassNames={["w-[180px]", undefined, "w-[110px]", "w-[120px]", "w-[120px] text-right"]}
              isLoading={appealsLoading}
              isEmpty={!appealsLoading && appealItems.length === 0}
              emptyTitle="No appeals"
              emptyDescription="No appeals match this filter."
              total={appeals?.total ?? 0}
              limit={listState.limit}
              offset={listState.offset}
              onPageChange={listState.setOffset}
            >
              {appealItems.map((appeal) => (
                <TableRow key={appeal.id}>
                  <TableCell className="font-medium">{appeal.appeal_type}</TableCell>
                  <TableCell>
                    <Link href={asRoute(`/admin/users/${appeal.user_id}`)} className="text-sm hover:underline">
                      {appeal.user_email ?? appeal.user_id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge>{appeal.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(appeal.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <AdminTableActions>
                      <Button variant="outline" size="sm" onClick={() => openReview({ type: "appeal", item: appeal })}>
                        <Eye className="mr-1 size-3.5" />
                        Review
                      </Button>
                    </AdminTableActions>
                  </TableCell>
                </TableRow>
              ))}
            </AdminTableShell>
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={Boolean(reviewTarget)} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {reviewTarget?.type === "report" ? (
            <>
              <SheetHeader>
                <SheetTitle>{reviewTarget.item.reason}</SheetTitle>
                <SheetDescription>
                  {reviewTarget.item.target_type} · reported by{" "}
                  {reviewTarget.item.reporter_email ?? reviewTarget.item.reporter_id}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 px-1">
                {reviewTarget.item.details ? (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                    {reviewTarget.item.details}
                  </div>
                ) : null}
                <Textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Admin notes (optional)"
                />
              </div>
              <SheetFooter className="mt-6 gap-2 sm:flex-col sm:space-x-0">
                <Button
                  disabled={resolveReport.isPending}
                  onClick={() => void handleResolveReport("resolved")}
                >
                  {resolveReport.isPending ? <Loader2 className="size-4 animate-spin" /> : "Resolve report"}
                </Button>
                <Button
                  variant="outline"
                  disabled={resolveReport.isPending}
                  onClick={() => void handleResolveReport("dismissed")}
                >
                  Dismiss
                </Button>
              </SheetFooter>
            </>
          ) : null}

          {reviewTarget?.type === "appeal" ? (
            <>
              <SheetHeader>
                <SheetTitle>{reviewTarget.item.appeal_type}</SheetTitle>
                <SheetDescription>
                  <Link href={asRoute(`/admin/users/${reviewTarget.item.user_id}`)} className="underline">
                    {reviewTarget.item.user_email ?? reviewTarget.item.user_id}
                  </Link>
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 px-1">
                <div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                  {reviewTarget.item.reason}
                </div>
                <Textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Response to user (optional)"
                />
              </div>
              <SheetFooter className="mt-6 gap-2 sm:flex-col sm:space-x-0">
                <Button
                  disabled={resolveAppeal.isPending}
                  onClick={() => void handleResolveAppeal("approved")}
                >
                  <Check className="mr-1 size-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  disabled={resolveAppeal.isPending}
                  onClick={() => void handleResolveAppeal("rejected")}
                >
                  <X className="mr-1 size-4" />
                  Reject
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </AdminGuard>
  );
}
