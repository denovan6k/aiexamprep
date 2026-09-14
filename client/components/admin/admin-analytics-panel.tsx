"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { AdminGuard } from "@/components/admin/admin-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionGrid, Stat } from "@/components/page-kit";
import {
  useAdminGrowthQuery,
  useAdminRevenueQuery,
  useAdminUsageAggregateQuery
} from "@/hooks/use-admin";
import { formatCents } from "@/lib/admin";

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

const usageChartConfig = {
  total_quantity: {
    label: "Events",
    color: "hsl(var(--chart-3))"
  }
} satisfies ChartConfig;

export function AdminAnalyticsPanel() {
  const [growthDays, setGrowthDays] = useState("30");
  const { data: revenue, isLoading: revenueLoading } = useAdminRevenueQuery();
  const { data: growth, isLoading: growthLoading } = useAdminGrowthQuery(Number(growthDays));
  const { data: usage, isLoading: usageLoading } = useAdminUsageAggregateQuery();

  return (
    <AdminGuard>
      <PageHeader
        eyebrow="Admin"
        title="Analytics"
        description="Revenue, growth, and platform usage metrics."
      />

      <div className="mt-8 space-y-8">
        <SectionGrid cols={3}>
          <Stat
            label={revenue?.is_estimated ? "Est. MRR" : "MRR"}
            value={formatCents(revenue?.estimated_mrr_cents ?? 0)}
          />
          <Stat label="Est. ARR" value={formatCents(revenue?.estimated_arr_cents ?? 0)} />
          <Stat label="Active subscribers" value={String(revenue?.active_subscribers ?? 0)} />
        </SectionGrid>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">User growth</CardTitle>
              <CardDescription>Daily signups over time</CardDescription>
            </div>
            <Select value={growthDays} onValueChange={setGrowthDays}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {growthLoading ? (
              <Skeleton className="h-[280px] w-full rounded-lg" />
            ) : (
              <ChartContainer config={growthChartConfig} className="aspect-auto h-[280px] w-full">
                <LineChart data={growth?.points ?? []} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="signups" stroke="var(--color-signups)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue by plan</CardTitle>
              <CardDescription>Monthly recurring revenue contribution</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueLoading ? (
                <Skeleton className="h-[260px] w-full rounded-lg" />
              ) : (
                <ChartContainer config={revenueChartConfig} className="aspect-auto h-[260px] w-full">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage this month</CardTitle>
              <CardDescription>Top platform events by volume</CardDescription>
            </CardHeader>
            <CardContent>
              {usageLoading ? (
                <Skeleton className="h-[260px] w-full rounded-lg" />
              ) : (
                <ChartContainer config={usageChartConfig} className="aspect-auto h-[260px] w-full">
                  <BarChart data={(usage?.items ?? []).slice(0, 8)} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="event_type"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval={0}
                      angle={-24}
                      textAnchor="end"
                      height={64}
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} width={40} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total_quantity" fill="var(--color-total_quantity)" radius={4} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGuard>
  );
}
