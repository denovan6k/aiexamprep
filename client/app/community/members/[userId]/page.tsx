import { MemberProfileView } from "@/components/community/member-profile-view";

export const dynamic = "force-dynamic";

export default async function CommunityMemberPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <MemberProfileView userId={userId} />;
}
