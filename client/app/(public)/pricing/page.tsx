import Link from "next/link";

import { PricingPlansTabs } from "@/components/pricing/pricing-plans-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageFrame, PageHeader, PrimaryLink, SecondaryLink, SectionTitle } from "@/components/page-kit";

const entitlementRows = [
  ["Courses", "3", "Unlimited", "Unlimited"],
  ["Uploads / month", "3", "Unlimited", "Unlimited"],
  ["Quiz generations", "20", "Unlimited", "Unlimited"],
  ["Professor agents", "2", "5", "Unlimited"],
  ["Advanced quiz config", "No", "Yes", "Yes"],
  ["Stripe billing portal", "No", "Yes", "Yes"],
  ["Group admin controls", "No", "No", "Yes"]
] as const;

const planLabels = ["Free", "Pro", "Enterprise"] as const;

export default function PricingPage() {
  return (
    <PageFrame>
      <PageHeader
        title="Plans for every study workflow"
        description="Stripe-backed billing with free and paid tiers. Usage limits keep AI generation sustainable while Pro unlocks advanced customization."
        actions={
          <>
            <PrimaryLink href="/sign-up">Try it free</PrimaryLink>
            <SecondaryLink href="/settings/billing">Billing settings</SecondaryLink>
          </>
        }
      />

      <PricingPlansTabs />

      <SectionTitle title="Entitlement comparison" description="What each plan includes at a glance." />

      <div className="space-y-4 md:hidden">
        {entitlementRows.map(([feature, free, pro, enterprise]) => (
          <Card key={feature} className="rounded-2xl">
            <CardContent className="p-4">
              <p className="text-sm font-medium">{feature}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                {planLabels.map((plan, index) => {
                  const value = [free, pro, enterprise][index];
                  return (
                    <div key={plan} className="rounded-lg border border-border bg-muted/30 px-2 py-2">
                      <dt className="text-muted-foreground">{plan}</dt>
                      <dd className="mt-1 text-sm font-medium">{value}</dd>
                    </div>
                  );
                })}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden rounded-2xl md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-left font-semibold">Feature</th>
                {planLabels.map((plan) => (
                  <th key={plan} className="p-4 text-center font-semibold">
                    {plan}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entitlementRows.map(([feature, free, pro, enterprise]) => (
                <tr key={feature} className="border-b border-border last:border-0">
                  <td className="p-4 text-muted-foreground">{feature}</td>
                  <td className="p-4 text-center">{free}</td>
                  <td className="p-4 text-center font-medium">{pro}</td>
                  <td className="p-4 text-center">{enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-12 rounded-2xl border border-border bg-muted/40 px-4 py-8 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">
          All plans include community access, progress tracking, and core study workflows.
        </p>
        <Button variant="link" className="mt-2" asChild>
          <Link href="/faq">Questions about billing? Read the FAQ</Link>
        </Button>
      </div>
    </PageFrame>
  );
}
