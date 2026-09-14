"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CreateGroupDialog } from "@/components/community/create-group-dialog";
import { Button } from "@/components/ui/button";
import { asRoute } from "@/lib/utils";

export function CommunityHeaderActions() {
  const router = useRouter();

  return (
    <>
      <Button asChild>
        <Link href={asRoute("/community/groups")}>Browse all groups</Link>
      </Button>
      <CreateGroupDialog
        trigger={<Button variant="outline">Create a group</Button>}
        onCreated={(group) => router.push(asRoute(`/community/groups/${group.slug}`))}
      />
    </>
  );
}
