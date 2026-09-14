"use client";

import Link from "next/link";
import { MailWarning } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { asRoute } from "@/lib/utils";

export function EmailVerificationBanner() {
  const { user } = useAuth();

  if (!user || user.is_email_verified) {
    return null;
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Verify your email to continue</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Email verification is required before you can use Knorvex.
          </p>
        </div>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href={asRoute(`/email-verification?email=${encodeURIComponent(user.email)}`)}>
          Verify now
        </Link>
      </Button>
    </div>
  );
}
