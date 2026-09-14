"use client";

import Link from "next/link";
import { Activity, CreditCard, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import { formatPlanName } from "@/components/billing/usage-charts-panel";
import { PageHeader, SectionGrid, Stat } from "@/components/page-kit";
import { PlanCard } from "@/components/pricing/plan-card";
import { useAuth } from "@/components/providers/auth-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useBillingPlansQuery,
  useBillingUsageQuery,
  useCreateBillingCheckoutMutation,
  useCreateBillingPortalMutation
} from "@/hooks/use-billing";
import { plansForBillingCycle, type BillingPlan, type BillingCycle } from "@/lib/study";
import { showError, showWarning } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

function usagePct(used: number, limit: number | null) {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function usageLabel(used: number, limit: number | null) {
  return limit === null ? `${used} / unlimited` : `${used} / ${limit}`;
}

function formatPrice(plan: BillingPlan) {
  if (plan.price_cents === 0) return "Free";
  if (plan.price_cents === null) return plan.interval === "year" ? "Yearly" : "Monthly";
  return `$${(plan.price_cents / 100).toFixed(0)}`;
}

function formatPeriod(plan: BillingPlan) {
  if (plan.interval === "year") return "/year";
  if (plan.interval === "month") return "/month";
  return "forever";
}

export default function BillingSettingsPage() {
  const { user } = useAuth();
  const usageQuery = useBillingUsageQuery();
  const plansQuery = useBillingPlansQuery();
  const usage = usageQuery.data;
  const plans = plansQuery.data ?? [];
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const checkoutMutation = useCreateBillingCheckoutMutation();
  const portalMutation = useCreateBillingPortalMutation();

  const loadingAction = checkoutMutation.isPending
    ? checkoutMutation.variables?.planCode ?? null
    : portalMutation.isPending
      ? "portal"
      : null;

  const quizLimit = usage?.entitlements.quiz_generation_limit ?? null;
  const quizUsagePct = usagePct(usage?.quiz_generations_used ?? 0, quizLimit);
  const shouldShowGenerationUpgrade =
    usage?.plan_code === "free" && quizLimit !== null && quizUsagePct >= 80;
  const proMonthly = plans.find((plan) => plan.code === "pro_monthly");
  const monthlyPlans = useMemo(() => plansForBillingCycle(plans, "monthly"), [plans]);
  const yearlyPlans = useMemo(() => plansForBillingCycle(plans, "yearly"), [plans]);
  const visiblePlans = cycle === "monthly" ? monthlyPlans : yearlyPlans;

  function handleCheckout(plan: BillingPlan) {
    if (plan.code === "free") return;
    checkoutMutation.mutate(
      { planCode: plan.code, customerEmail: user?.email },
      {
        onSuccess: (response) => {
          if (response.is_placeholder) {
            showWarning("Stripe checkout is not configured yet. The generated placeholder URL is available for wiring tests.");
          }
          window.location.href = response.checkout_url;
        },
        onError: (err) => showError(err, "Could not open checkout.")
      }
    );
  }

  function handlePortal() {
    portalMutation.mutate(user?.email, {
      onSuccess: (response) => {
        if (response.is_placeholder) {
          showWarning("Stripe portal is not configured yet. This opens the placeholder portal URL.");
        }
        window.location.href = response.portal_url;
      },
      onError: (err) => showError(err, "Could not open billing portal.")
    });
  }

  return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader
          eyebrow="Billing"
          title="Plan and subscription"
          description="Manage your subscription, open checkout or the billing portal, and jump to detailed usage charts."
          actions={
            <Button type="button" variant="outline" onClick={handlePortal} disabled={portalMutation.isPending}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {portalMutation.isPending ? "Opening..." : "Billing portal"}
            </Button>
          }
        />

        {usageQuery.isError || plansQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load complete billing data</AlertTitle>
            <AlertDescription>
              Some billing information is temporarily unavailable. You can still open the billing portal.
            </AlertDescription>
          </Alert>
        ) : null}

        {shouldShowGenerationUpgrade && proMonthly ? (
          <Alert variant={quizUsagePct >= 100 ? "destructive" : "warning"}>
            <CreditCard className="h-4 w-4" />
            <AlertTitle>
              {quizUsagePct >= 100 ? "Quiz generation limit reached" : "Quiz generation limit almost reached"}
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                You have used {usageLabel(usage?.quiz_generations_used ?? 0, quizLimit)} quiz generations this month.
                Upgrade to Pro for unlimited generation.
              </span>
              <Button
                type="button"
                size="sm"
                className="w-fit"
                onClick={() => handleCheckout(proMonthly)}
                disabled={checkoutMutation.isPending && checkoutMutation.variables?.planCode === proMonthly.code}
              >
                {loadingAction === proMonthly.code ? "Opening..." : "Upgrade"}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <SectionGrid>
          <Stat label="Current plan" value={formatPlanName(usage?.plan_code ?? "free")} />
          <Stat label="Quiz credits used" value={String(usage?.quiz_generations_used ?? 0)} tone="warning" />
          <Stat
            label="Uploads used"
            value={usageLabel(usage?.material_uploads_used ?? 0, usage?.entitlements.material_upload_limit ?? null)}
            tone="success"
          />
        </SectionGrid>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Usage charts</CardTitle>
            <CardDescription>
              Daily trends, event breakdown, and full quota meters live on the Usage page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href={asRoute("/usage")}>
                <Activity className="mr-2 h-4 w-4" />
                Open Usage
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div>
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Plans</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Choose the cycle and plan that fits your study cadence.
            </p>
          </div>
          <Tabs value={cycle} onValueChange={(value) => setCycle(value as BillingCycle)}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
            <TabsContent value="monthly" className="mt-4">
              <div className="grid gap-4 lg:grid-cols-3">
                {plansQuery.isLoading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <Card key={`monthly-skeleton-${index}`} className="h-[320px] animate-pulse bg-muted/40" />
                    ))
                  : null}
                {monthlyPlans.map((plan) => (
                  <PlanCard
                    key={plan.code}
                    name={plan.name}
                    price={formatPrice(plan)}
                    period={formatPeriod(plan)}
                    detail={plan.code.startsWith("pro_") ? "Most popular for focused exam prep." : undefined}
                    features={plan.features}
                    highlighted={plan.code === "pro_monthly"}
                    current={plan.is_current}
                    badgeText={plan.code === "pro_monthly" ? "Most popular" : undefined}
                    footer={
                      <Button
                        type="button"
                        className="w-full rounded-full"
                        variant={plan.is_current ? "outline" : "default"}
                        disabled={plan.is_current || plan.code === "free" || loadingAction === plan.code}
                        onClick={() => handleCheckout(plan)}
                      >
                        {plan.is_current ? "Current plan" : loadingAction === plan.code ? "Opening..." : "Upgrade"}
                      </Button>
                    }
                  />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="yearly" className="mt-4">
              <div className="grid gap-4 lg:grid-cols-3">
                {plansQuery.isLoading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <Card key={`yearly-skeleton-${index}`} className="h-[320px] animate-pulse bg-muted/40" />
                    ))
                  : null}
                {yearlyPlans.map((plan) => (
                  <PlanCard
                    key={plan.code}
                    name={plan.name}
                    price={formatPrice(plan)}
                    period={formatPeriod(plan)}
                    detail={plan.code.startsWith("pro_") ? "Save more with annual billing." : undefined}
                    features={plan.features}
                    current={plan.is_current}
                    badgeText={plan.code.startsWith("pro_") ? "Best value" : undefined}
                    footer={
                      <Button
                        type="button"
                        className="w-full rounded-full"
                        variant={plan.is_current ? "outline" : "default"}
                        disabled={plan.is_current || plan.code === "free" || loadingAction === plan.code}
                        onClick={() => handleCheckout(plan)}
                      >
                        {plan.is_current ? "Current plan" : loadingAction === plan.code ? "Opening..." : "Upgrade"}
                      </Button>
                    }
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
          {!visiblePlans.length ? (
            <Card className="mt-4">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Plans are temporarily unavailable. Please refresh or try again shortly.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
  );
}
