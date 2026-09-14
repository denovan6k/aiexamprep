"use client";

import { useMemo, useState } from "react";

import { PlanCard } from "@/components/pricing/plan-card";
import { PricingPlanCta } from "@/components/pricing/pricing-plan-cta";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { pricingPlans } from "@/lib/content";

type Cycle = "monthly" | "yearly";

type DisplayPlan = {
  name: string;
  price: string;
  period?: string;
  detail: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  href: string;
  planCode?: "pro_monthly" | "pro_yearly" | "enterprise_monthly" | "enterprise_yearly";
};

function yearlyPlanCode(
  planCode?: "pro_monthly" | "pro_yearly" | "enterprise_monthly" | "enterprise_yearly"
) {
  if (planCode === "pro_monthly") return "pro_yearly";
  if (planCode === "enterprise_monthly") return "enterprise_yearly";
  return planCode;
}

function toDisplayPlans(cycle: Cycle): DisplayPlan[] {
  return pricingPlans.map((plan) => {
    if (cycle === "yearly" && "yearlyPrice" in plan && plan.yearlyPrice) {
      return {
        ...plan,
        price: plan.yearlyPrice,
        period: plan.yearlyPeriod || "/year",
        planCode: yearlyPlanCode("planCode" in plan ? plan.planCode : undefined)
      };
    }

    return {
      ...plan,
      period: plan.period,
      planCode: "planCode" in plan ? plan.planCode : undefined
    };
  });
}

export function PricingPlansTabs() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const monthlyPlans = useMemo(() => toDisplayPlans("monthly"), []);
  const yearlyPlans = useMemo(() => toDisplayPlans("yearly"), []);

  return (
    <Tabs value={cycle} onValueChange={(value) => setCycle(value as Cycle)} className="mt-8">
      <TabsList className="grid w-full max-w-xs grid-cols-2">
        <TabsTrigger value="monthly">Monthly</TabsTrigger>
        <TabsTrigger value="yearly">Yearly</TabsTrigger>
      </TabsList>

      <TabsContent value="monthly" className="mt-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {monthlyPlans.map((plan) => (
            <PlanCard
              key={`${plan.name}-monthly`}
              name={plan.name}
              price={plan.price}
              period={plan.period}
              detail={plan.detail}
              features={plan.features}
              highlighted={plan.highlighted}
              badgeText={plan.highlighted ? "Most popular" : undefined}
              footer={
                <PricingPlanCta
                  cta={plan.cta}
                  highlighted={plan.highlighted}
                  href={plan.href}
                  planCode={plan.planCode}
                />
              }
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="yearly" className="mt-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {yearlyPlans.map((plan) => (
            <PlanCard
              key={`${plan.name}-yearly`}
              name={plan.name}
              price={plan.price}
              period={plan.period}
              detail={plan.detail}
              features={plan.features}
              highlighted={plan.highlighted}
              badgeText={plan.highlighted ? "Best value" : undefined}
              footer={
                <PricingPlanCta
                  cta={plan.cta}
                  highlighted={plan.highlighted}
                  href={plan.href}
                  planCode={plan.planCode}
                />
              }
            />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
