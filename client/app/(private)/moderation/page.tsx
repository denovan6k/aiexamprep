"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/ui/loader";
import { SystemMessage } from "@/components/ui/system-message";
import { PageFrame, PageHeader } from "@/components/page-kit";
import { API_BASE_URL } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

type ContentReport = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
  reviewed_at: string | null;
};

function reportTitle(targetType: string) {
  switch (targetType) {
    case "thread":
      return "Thread reported";
    case "reply":
      return "Reply reported";
    case "shared_resource":
      return "Shared resource reported";
    case "group":
      return "Group reported";
    default:
      return "Content reported";
  }
}

async function fetchReports(_token: string, status: string): Promise<ContentReport[]> {
  const response = await fetch(`${API_BASE_URL}/moderation/reports?status=${status}`);
  if (!response.ok) {
    if (response.status === 403) {
      return [];
    }
    throw new Error("Failed to fetch reports");
  }
  return response.json();
}

async function resolveReport(
  _token: string,
  reportId: string,
  status: "resolved" | "dismissed",
  notes: string
): Promise<ContentReport> {
  const response = await fetch(`${API_BASE_URL}/moderation/reports/${reportId}/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status, notes })
  });
  if (!response.ok) {
    throw new Error("Failed to resolve report");
  }
  return response.json();
}

export default function ModerationPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState("open");
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadReports() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const loaded = await fetchReports(token!, activeTab);
        if (!cancelled) {
          setReports(loaded);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load reports");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, [token, activeTab]);

  const handleResolve = async (reportId: string, status: "resolved" | "dismissed") => {
    if (!token) return;

    setIsResolving(true);
    try {
      await resolveReport(token, reportId, status, notes);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setSelectedReport(null);
      setNotes("");
      showSuccess(status === "resolved" ? "Report resolved." : "Report dismissed.");
    } catch (err) {
      showError(err, "Failed to resolve report.");
    } finally {
      setIsResolving(false);
    }
  };

  if (!user) {
    return (
      <PageFrame narrow>
        <SystemMessage variant="error">You must be logged in to access moderation.</SystemMessage>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <PageHeader
        title="Moderation queue"
        description="Review and manage reported content from your community groups."
      />

      {loadError ? (
        <SystemMessage variant="error" className="mb-6">
          {loadError}
        </SystemMessage>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="open" className="flex-1 sm:flex-none">
            Open
          </TabsTrigger>
          <TabsTrigger value="resolved" className="flex-1 sm:flex-none">
            Resolved
          </TabsTrigger>
          <TabsTrigger value="dismissed" className="flex-1 sm:flex-none">
            Dismissed
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader variant="typing" size="md" />
            </div>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-sm text-muted-foreground">
                  {activeTab === "open"
                    ? "No open reports. Your community is looking good!"
                    : `No ${activeTab} reports.`}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="text-base sm:text-lg">{reportTitle(report.target_type)}</CardTitle>
                        <CardDescription className="mt-1">
                          Reported {new Date(report.created_at).toLocaleDateString()} at{" "}
                          {new Date(report.created_at).toLocaleTimeString()}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          report.status === "open"
                            ? "default"
                            : report.status === "resolved"
                              ? "success"
                              : "secondary"
                        }
                        className="w-fit"
                      >
                        {report.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Reason</div>
                        <div className="mt-1 break-words">{report.reason}</div>
                      </div>
                      {report.details ? (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Details</div>
                          <div className="mt-1 break-words text-sm">{report.details}</div>
                        </div>
                      ) : null}
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Target ID</div>
                        <div className="mt-1 break-all font-mono text-xs">{report.target_id}</div>
                      </div>
                      {report.status === "open" ? (
                        <div className="space-y-3 border-t pt-4">
                          {selectedReport === report.id ? (
                            <div className="space-y-3">
                              <Textarea
                                placeholder="Add moderator notes (optional)"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                              />
                              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                <Button
                                  onClick={() => void handleResolve(report.id, "resolved")}
                                  disabled={isResolving}
                                  size="sm"
                                  className="w-full sm:w-auto"
                                >
                                  {isResolving ? "Resolving..." : "Mark resolved"}
                                </Button>
                                <Button
                                  onClick={() => void handleResolve(report.id, "dismissed")}
                                  disabled={isResolving}
                                  variant="secondary"
                                  size="sm"
                                  className="w-full sm:w-auto"
                                >
                                  {isResolving ? "Dismissing..." : "Dismiss"}
                                </Button>
                                <Button
                                  onClick={() => {
                                    setSelectedReport(null);
                                    setNotes("");
                                  }}
                                  disabled={isResolving}
                                  variant="ghost"
                                  size="sm"
                                  className="w-full sm:w-auto"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button onClick={() => setSelectedReport(report.id)} variant="outline" size="sm">
                              Review & resolve
                            </Button>
                          )}
                        </div>
                      ) : null}
                      {report.reviewed_at ? (
                        <div className="text-xs text-muted-foreground">
                          Reviewed {new Date(report.reviewed_at).toLocaleDateString()} at{" "}
                          {new Date(report.reviewed_at).toLocaleTimeString()}
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageFrame>
  );
}
