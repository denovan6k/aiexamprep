import { ThreadDetailView } from "@/components/community/thread-detail-view";

export const dynamic = "force-dynamic";

export default async function CommunityThreadPage({
  params
}: {
  params: Promise<{ slug: string; threadId: string }>;
}) {
  const { slug, threadId } = await params;
  return <ThreadDetailView slug={slug} threadId={threadId} />;
}
