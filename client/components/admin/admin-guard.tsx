"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSuperAdmin } from "@/lib/api";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!isSuperAdmin(user)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>This area is restricted to super admin users.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <>{children}</>;
}
