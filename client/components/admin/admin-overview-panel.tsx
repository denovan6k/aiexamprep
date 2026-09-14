"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { AdminGuard } from "@/components/admin/admin-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionGrid, Stat } from "@/components/page-kit";
import { useAdminGrowthQuery, useAdminOverviewQuery, useAdminRevenueQuery } from "@/hooks/use-admin";
import { formatCents } from "@/lib/admin";
import { asRoute } from "@/lib/utils";

const growthChartConfig = {
  signups: {
    label: "Signups",
    color: "hsl(var(--chart-1))"
  }
} satisfies ChartConfig;

const revenueChartConfig = {
  mrr_contribution_cents: {
    label: "MRR",
    color: "hsl(var(--chart-2))"
  }
} satisfies ChartConfig;

export function AdminOverviewPanel() {
  const { data: overview, isLoading: overviewLoading } = useAdminOverviewQuery();
  const { data: growth, isLoading: growthLoading } = useAdminGrowthQuery(7);
  const { data: revenue, isLoading: revenueLoading } = useAdminRevenueQuery();

  if (overviewLoading) {
    return (
      <div className="space-y-4">
        <SectionGrid cols={3}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </SectionGrid>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionGrid cols={3}>
        <Stat label="Total users" value={String(overview?.total_users ?? 0)} />
        <Stat label="Active subscribers" value={String(overview?.active_subscribers ?? 0)} />
        <Stat
          label={overview?.is_revenue_estimated ? "Est. MRR" : "MRR"}
          value={formatCents(overview?.estimated_mrr_cents ?? 0)}
        />
        <Stat label="Open tickets" value={String(overview?.open_support_tickets ?? 0)} />
        <Stat label="Open appeals" value={String(overview?.open_appeals ?? 0)} />
        <Stat label="Open reports" value={String(overview?.open_reports ?? 0)} />
      </SectionGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signups (7 days)</CardTitle>
            <CardDescription>New user registrations per day</CardDescription>
          </CardHeader>
          <CardContent>
            {growthLoading ? (
              <Skeleton className="h-[240px] w-full rounded-lg" />
            ) : (
              <ChartContainer config={growthChartConfig} className="aspect-auto h-[240px] w-full">
                <LineChart data={growth?.points ?? []} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="signups"
                    stroke="var(--color-signups)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by plan</CardTitle>
            <CardDescription>MRR contribution per plan</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-[240px] w-full rounded-lg" />
            ) : (
              <ChartContainer config={revenueChartConfig} className="aspect-auto h-[240px] w-full">
                <BarChart data={revenue?.by_plan ?? []} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="plan_code" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={48}
                    tickFormatter={(v) => `$${Math.round(Number(v) / 100)}`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent formatter={(value) => formatCents(Number(value ?? 0))} />
                    }
                  />
                  <Bar dataKey="mrr_contribution_cents" fill="var(--color-mrr_contribution_cents)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={asRoute("/admin/users")}>
            Manage users <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={asRoute("/admin/support")}>
            Support queue <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={asRoute("/admin/moderation")}>
            Moderation <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={asRoute("/admin/analytics")}>
            Full analytics <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={asRoute("/admin/subscriptions")}>
            Subscriptions <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function AdminOverviewPageContent() {
  return (
    <AdminGuard>
      <PageHeader
        eyebrow="Admin"
        title="Platform overview"
        description="Monitor users, revenue, and queues needing attention."
      />
      <div className="mt-8">
        <AdminOverviewPanel />
      </div>
    </AdminGuard>
  );
}
