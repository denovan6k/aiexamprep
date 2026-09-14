"use client";

import Link from "next/link";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { useCreateBillingCheckoutMutation } from "@/hooks/use-billing";
import { showError } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

type PricingPlanCtaProps = {
  cta: string;
  highlighted?: boolean;
  planCode?: "pro_monthly" | "pro_yearly" | "enterprise_monthly" | "enterprise_yearly";
  href: string;
};

export function PricingPlanCta({ cta, highlighted, planCode, href }: PricingPlanCtaProps) {
  const { token, user } = useAuth();
  const checkoutMutation = useCreateBillingCheckoutMutation();

  function handleUpgrade() {
    if (!planCode) return;
    checkoutMutation.mutate(
      { planCode, customerEmail: user?.email },
      {
        onSuccess: (response) => {
          window.location.href = response.checkout_url;
        },
        onError: (err) => {
          showError(err, "Could not open checkout.");
          window.location.href = "/settings/billing";
        }
      }
    );
  }

  if (planCode && token) {
    return (
      <Button
        type="button"
        className="w-full rounded-full"
        variant={highlighted ? "default" : "secondary"}
        disabled={checkoutMutation.isPending}
        onClick={handleUpgrade}
      >
        {checkoutMutation.isPending ? "Opening checkout..." : cta}
      </Button>
    );
  }

  return (
    <Button className="w-full rounded-full" variant={highlighted ? "default" : "secondary"} asChild>
      <Link href={asRoute(href)}>{cta}</Link>
    </Button>
  );
}
