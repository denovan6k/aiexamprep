"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { asRoute } from "@/lib/utils";

type LandingPrimaryCtaProps = {
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
};

export function LandingPrimaryCta({ className, size = "lg" }: LandingPrimaryCtaProps) {
  const { token } = useAuth();

  if (token) {
    return (
      <Button size={size} asChild className={className}>
        <Link href={asRoute("/chat")} className="group gap-2">
          Start practicing
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </Button>
    );
  }

  return (
    <Button size={size} asChild className={className}>
      <Link href="/sign-up" className="group gap-2">
        Try for free
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Button>
  );
}
