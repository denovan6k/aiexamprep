import type { ReactNode } from "react";

import { PrivateLayoutShell } from "@/components/private-layout-shell";
import { verifySession } from "@/lib/auth/session";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  await verifySession();

  return <PrivateLayoutShell>{children}</PrivateLayoutShell>;
}
