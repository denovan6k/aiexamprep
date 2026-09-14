"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { PageLoader } from "@/components/page-loader";
import { useAuth } from "@/components/providers/auth-provider";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user && !token) {
      router.replace("/sign-in");
    }
  }, [isLoading, user, token, router]);

  if (isLoading) {
    return <PageLoader fullScreen />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
