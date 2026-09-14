"use client";

import { use } from "react";

import { AdminUserDetailPanel } from "@/components/admin/admin-user-detail-panel";

export default function AdminUserDetailPage({
  params
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  return (
    <div className="mx-auto max-w-6xl">
      <AdminUserDetailPanel userId={userId} />
    </div>
  );
}
