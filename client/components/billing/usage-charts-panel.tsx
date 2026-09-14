"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBillingUsageHistoryQuery, useBillingUsageQuery } from "@/hooks/use-billing";
import { getClientErrorMessage } from "@/lib/api";
import { asRoute } from "@/lib/utils";

const RANGE_OPTIONS = [7, 30, 90] as const;

const trendChartConfig = {
  chat_prompts: { label: "Chat", color: "hsl(217 91% 55%)" },
  material_uploads: { label: "Uploads", color: "hsl(160 60% 40%)" },
  course_creates: { label: "Courses", color: "hsl(280 65% 55%)" },
  agent_creates: { label: "Agents", color: "hsl(200 70% 45%)" },
  cv_tailorings: { label: "CV tailor", color: "hsl(32 95% 48%)" },
  other: { label: "Other", color: "hsl(var(--muted-foreground))" }
} satisfies ChartConfig;

const breakdownChartConfig = {
  total: { label: "Usage", color: "hsl(var(--primary))" }
} satisfies ChartConfig;

const PIE_COLORS = [
  "hsl(217 91% 55%)",
  "hsl(160 60% 40%)",
  "hsl(32 95% 48%)",
  "hsl(280 65% 55%)",
  "hsl(0 72% 55%)",
  "hsl(200 70% 45%)",
  "hsl(45 90% 45%)",
  "hsl(var(--muted-foreground))"
];

function usagePct(used: number, limit: number | null) {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function usageLabel(used: number, limit: number | null) {
  return limit === null ? `${used} / unlimited` : `${used} / ${limit}`;
}

export function formatPlanName(code: string) {
  if (code.startsWith("pro_")) return "Pro";
  if (code.startsWith("enterprise_")) return "Enterprise";
  if (code === "free") return "Free";
  return code;
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartEmpty({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{message}</p>;
}

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

type UsageChartsPanelProps = {
  variant?: "full" | "compact";
};

export function UsageChartsPanel({ variant = "full" }: UsageChartsPanelProps) {
  const [days, setDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);
  const usageQuery = useBillingUsageQuery();
  const historyQuery = useBillingUsageHistoryQuery(days);
  const usage = usageQuery.data;
  const history = historyQuery.data;
  const loading = usageQuery.isLoading || historyQuery.isLoading;
  const error = usageQuery.error ?? historyQuery.error;

  const meters = useMemo(
    () => [
      {
        label: "Chat generations",
        used: usage?.generations_used ?? usage?.chat_prompts_used ?? 0,
        total: usage?.generation_limit ?? null
      },
      {
        label: "Uploads",
        used: usage?.material_uploads_used ?? 0,
        total: usage?.upload_limit ?? usage?.entitlements.material_upload_limit ?? null
      },
      {
        label: "Courses",
        used: usage?.courses_used ?? 0,
        total: usage?.entitlements.course_limit ?? null
      },
      {
        label: "Professor agents",
        used: usage?.professor_agents_used ?? 0,
        total: usage?.entitlements.professor_agent_limit ?? null
      }
    ],
    [usage]
  );

  const trendData = useMemo(
    () =>
      (history?.series ?? []).map((point) => ({
        ...point,
        label: formatShortDate(point.date)
      })),
    [history?.series]
  );

  const breakdownData = history?.by_type ?? [];
  const hasTrend = (history?.total_events ?? 0) > 0;
  const compact = variant === "compact";
  const chartHeightClass = compact ? "h-[200px]" : "h-[280px]";
  const breakdownHeightClass = compact ? "h-[200px]" : "h-[260px]";

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-sm text-danger">
          {getClientErrorMessage(error, "Could not load usage data.")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          {usage?.reset_at ? (
            <span>Period resets {new Date(usage.reset_at).toLocaleString()}</span>
          ) : (
            <span>Current billing period</span>
          )}
          <Badge variant="outline">{formatPlanName(usage?.plan_code ?? "free")}</Badge>
          {!loading ? (
            <span className="tabular-nums">
              {history?.total_events ?? 0} events · {days}d
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={String(days)}
            onValueChange={(value) => setDays(Number(value) as (typeof RANGE_OPTIONS)[number])}
          >
            <TabsList>
              {RANGE_OPTIONS.map((option) => (
                <TabsTrigger key={option} value={String(option)}>
                  {option}d
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {compact ? (
            <Button asChild variant="outline" size="sm">
              <Link href={asRoute("/usage")}>Full usage</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className={compact ? "grid gap-4 lg:grid-cols-2" : "space-y-6"}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily usage</CardTitle>
            <CardDescription>
              Live activity from your account events over the last {days} days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton height={compact ? 200 : 280} />
            ) : !hasTrend ? (
              <ChartEmpty message="No usage events in this range yet. Chat, upload materials, or tailor a CV to populate the chart." />
            ) : (
              <ChartContainer config={trendChartConfig} className={`aspect-auto w-full ${chartHeightClass}`}>
                <AreaChart data={trendData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="chat_prompts"
                    stackId="usage"
                    stroke="var(--color-chat_prompts)"
                    fill="var(--color-chat_prompts)"
                    fillOpacity={0.35}
                  />
                  <Area
                    type="monotone"
                    dataKey="material_uploads"
                    stackId="usage"
                    stroke="var(--color-material_uploads)"
                    fill="var(--color-material_uploads)"
                    fillOpacity={0.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="course_creates"
                    stackId="usage"
                    stroke="var(--color-course_creates)"
                    fill="var(--color-course_creates)"
                    fillOpacity={0.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="agent_creates"
                    stackId="usage"
                    stroke="var(--color-agent_creates)"
                    fill="var(--color-agent_creates)"
                    fillOpacity={0.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="cv_tailorings"
                    stackId="usage"
                    stroke="var(--color-cv_tailorings)"
                    fill="var(--color-cv_tailorings)"
                    fillOpacity={0.45}
                  />
                  <Area
                    type="monotone"
                    dataKey="other"
                    stackId="usage"
                    stroke="var(--color-other)"
                    fill="var(--color-other)"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {compact ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">By event type</CardTitle>
              <CardDescription>Totals for the selected range.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ChartSkeleton height={200} />
              ) : breakdownData.length === 0 ? (
                <ChartEmpty message="No breakdown yet." />
              ) : (
                <ChartContainer
                  config={breakdownChartConfig}
                  className={`aspect-auto w-full ${breakdownHeightClass}`}
                >
                  <BarChart data={breakdownData} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={110}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {!compact ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">By event type</CardTitle>
              <CardDescription>Totals for the selected range.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ChartSkeleton height={260} />
              ) : breakdownData.length === 0 ? (
                <ChartEmpty message="No breakdown yet." />
              ) : (
                <ChartContainer
                  config={breakdownChartConfig}
                  className={`aspect-auto w-full ${breakdownHeightClass}`}
                >
                  <BarChart data={breakdownData} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={110}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Share of activity</CardTitle>
              <CardDescription>How usage splits across event types.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ChartSkeleton height={260} />
              ) : breakdownData.length === 0 ? (
                <ChartEmpty message="No share data yet." />
              ) : (
                <ChartContainer
                  config={breakdownChartConfig}
                  className={`aspect-auto mx-auto w-full max-w-sm ${breakdownHeightClass}`}
                >
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                    <Pie
                      data={breakdownData}
                      dataKey="total"
                      nameKey="label"
                      innerRadius={58}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {breakdownData.map((entry, index) => (
                        <Cell key={entry.event_type} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Current period quotas</CardTitle>
          <CardDescription>
            Live counters against your plan limits.
            {meters.some((meter) => meter.total === null)
              ? " Unlimited meters stay empty by design — there is no cap to fill."
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: compact ? 3 : 4 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            meters.map((meter) => {
              const unlimited = meter.total === null;
              return (
                <div key={meter.label} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{meter.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {usageLabel(meter.used, meter.total)}
                    </span>
                  </div>
                  {unlimited ? (
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-full bg-muted-foreground/25" />
                    </div>
                  ) : (
                    <Progress value={usagePct(meter.used, meter.total)} className="h-2.5" />
                  )}
                </div>
              );
            })
          )}
          {compact ? null : (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline" size="sm">
                <Link href={asRoute("/settings/billing")}>Open billing</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
