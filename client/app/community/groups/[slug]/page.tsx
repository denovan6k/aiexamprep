import { GroupDetailView } from "@/components/community/group-detail-view";

export const dynamic = "force-dynamic";

export default async function CommunityGroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GroupDetailView slug={slug} />;
}
