"use client";

import Link from "next/link";
import { BookOpen, Bot, Layers, Users } from "lucide-react";

import { AuthorLink } from "@/components/community/reputation-badge";
import { ShareResourceDialog } from "@/components/community/share-resource-dialog";
import { SidebarSection } from "@/components/sidebar/sidebar-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  resourceHref,
  type CommunityGroup,
  type CommunityMember,
  type SharedResource
} from "@/lib/community";
import { asRoute, cn } from "@/lib/utils";

type GroupSidebarProps = {
  group: CommunityGroup;
  members: CommunityMember[];
  resources: SharedResource[];
  token?: string | null;
  onResourcesChange?: () => void;
  className?: string;
};

export function GroupSidebar({
  group,
  members,
  resources,
  token,
  onResourcesChange,
  className
}: GroupSidebarProps) {
  return (
    <aside className={cn("space-y-4 lg:sticky lg:top-4 lg:self-start", className)}>
      <SidebarSection title="About" defaultOpen>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{group.description ?? "A study group for sharing notes, quizzes, and exam prep."}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{group.visibility}</Badge>
            {group.school_name ? <Badge variant="secondary">{group.school_name}</Badge> : null}
          </div>
          <p>
            {group.member_count} members
            {group.owner_name ? (
              <>
                {" "}
                · Owner: <span className="text-foreground">{group.owner_name}</span>
              </>
            ) : null}
          </p>
        </div>
      </SidebarSection>

      <SidebarSection
        title="Members"
        icon={<Users className="h-4 w-4" />}
        defaultOpen
        badge={<Badge variant="outline">{members.length}</Badge>}
      >
        <div className="space-y-2">
          {members.slice(0, 6).map((member) => (
            <div key={member.user_id} className="flex items-center justify-between gap-2 text-sm">
              <AuthorLink authorId={member.user_id} authorName={member.name} />
              <Badge variant="outline" className="text-[10px]">
                {member.role}
              </Badge>
            </div>
          ))}
          {members.length > 6 ? (
            <p className="text-xs text-muted-foreground">+{members.length - 6} more</p>
          ) : null}
        </div>
      </SidebarSection>

      <SidebarSection
        title="Shared resources"
        defaultOpen={resources.length > 0}
        badge={resources.length > 0 ? <Badge variant="secondary">{resources.length}</Badge> : undefined}
      >
        <div className="space-y-3">
          {group.is_member && token ? (
            <ShareResourceDialog
              groupId={group.id}
              groupSlug={group.slug}
              onShared={() => onResourcesChange?.()}
              trigger={
                <Button variant="outline" size="sm">
                  Share
                </Button>
              }
            />
          ) : null}
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shared quizzes or decks yet.</p>
          ) : (
            resources.slice(0, 4).map((resource) => {
              const href = resourceHref(resource);
              const Icon =
                resource.resource_type === "quiz"
                  ? BookOpen
                  : resource.resource_type === "flashcard_deck"
                    ? Layers
                    : Bot;
              return (
                <div key={resource.id} className="flex items-start gap-2 text-sm">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    {href && token ? (
                      <Link href={asRoute(href)} className="font-medium hover:text-primary">
                        {resource.title}
                      </Link>
                    ) : (
                      <p className="font-medium">{resource.title}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{resource.resource_type.replace("_", " ")}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SidebarSection>
    </aside>
  );
}
