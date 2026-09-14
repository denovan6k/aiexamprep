import { CommunityGroupsClient } from "@/components/community/community-groups-client";
import { listCommunityGroups } from "@/lib/community";

export const dynamic = "force-dynamic";

export default async function CommunityGroupsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const groups = await listCommunityGroups().catch(() => []);
  return <CommunityGroupsClient initialGroups={groups} initialQuery={q ?? ""} />;
}
