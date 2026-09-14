import type { ReactNode } from "react";

import { PublicShell } from "@/components/home/public-shell";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
