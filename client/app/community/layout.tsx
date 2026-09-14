import type { ReactNode } from "react";

import { CommunityShell } from "@/components/community/community-shell";

export default function CommunityLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <CommunityShell>{children}</CommunityShell>
    </div>
  );
}
