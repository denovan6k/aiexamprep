"use client";

import { CreditCard } from "lucide-react";

import { formatPlanName, UsageChartsPanel } from "@/components/billing/usage-charts-panel";
import { PageHeader, PrimaryLink, SectionGrid, Stat } from "@/components/page-kit";
import { useBillingUsageQuery } from "@/hooks/use-billing";

export default function UsagePage() {
  const usageQuery = useBillingUsageQuery();
  const usage = usageQuery.data;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Usage"
        title="Plan usage and activity"
        description="See how you are spending chat generations, uploads, and other quota this period — with daily trends from your account events."
        actions={
          <PrimaryLink href="/settings/billing">
            <CreditCard className="h-4 w-4" />
            Manage billing
          </PrimaryLink>
        }
      />

      <SectionGrid cols={4}>
        <Stat label="Plan" value={formatPlanName(usage?.plan_code ?? "free")} />
        <Stat
          label="Generations used"
          value={String(usage?.generations_used ?? usage?.chat_prompts_used ?? 0)}
          tone="success"
        />
        <Stat label="Credits" value={String(usage?.credits_balance ?? 0)} tone="warning" />
        <Stat
          label="Uploads used"
          value={String(usage?.material_uploads_used ?? 0)}
        />
      </SectionGrid>

      <UsageChartsPanel variant="full" />
    </div>
  );
}
