"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ReputationBadge } from "@/components/community/reputation-badge";
import { MemberProfileSkeleton } from "@/components/community/member-profile-skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getCommunityProfile,
  updateCommunityProfile,
  type CommunityProfile
} from "@/lib/community";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

export function MemberProfileView({ userId }: { userId: string }) {
  const router = useRouter();
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = user?.id === userId;

  const loadProfile = useCallback(async (cancelledRef: { current: boolean }) => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getCommunityProfile(userId, token);
      if (cancelledRef.current) return;
      setProfile(loaded);
      setBio(loaded.bio ?? "");
      setInterests((loaded.study_interests ?? []).join(", "));
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
        setProfile(null);
      }
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    const cancelledRef = { current: false };
    void loadProfile(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadProfile]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !isOwnProfile) return;
    setIsSaving(true);
    try {
      const updated = await updateCommunityProfile(token, {
        bio: bio.trim() || undefined,
        study_interests: interests
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      });
      setProfile(updated);
      setIsEditing(false);
      showSuccess("Profile updated.");
    } catch (err) {
      showError(err, "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <MemberProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile unavailable</CardTitle>
          <CardDescription>{error ?? "This member could not be found."}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ReputationBadge score={profile.reputation_score} tier={profile.reputation_tier} />
            <Badge variant="outline">{profile.thread_count} threads</Badge>
            <Badge variant="outline">{profile.reply_count} replies</Badge>
          </div>
          {profile.bio ? <p className="mt-3 max-w-2xl text-muted-foreground">{profile.bio}</p> : null}
          {profile.study_interests.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.study_interests.map((interest) => (
                <Badge key={interest} variant="secondary">
                  {interest}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        {isOwnProfile ? (
          <Button variant="outline" onClick={() => setIsEditing((prev) => !prev)}>
            {isEditing ? "Cancel" : "Edit profile"}
          </Button>
        ) : null}
      </div>

      {isEditing && isOwnProfile ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit community profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="profile-bio" className="text-sm font-medium">
                  Bio
                </label>
                <Textarea
                  id="profile-bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={4}
                  placeholder="Tell others what you study and how you like to collaborate."
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="profile-interests" className="text-sm font-medium">
                  Study interests
                </label>
                <Input
                  id="profile-interests"
                  value={interests}
                  onChange={(event) => setInterests(event.target.value)}
                  placeholder="Biology, MCAT, organic chemistry"
                />
              </div>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save profile
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Joined groups
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.joined_groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visible groups yet.</p>
            ) : (
              profile.joined_groups.map((group) => (
                <Link
                  key={group.id}
                  href={asRoute(`/community/groups/${group.slug}`)}
                  className="block rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-accent/50"
                >
                  {group.name}
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Recent threads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.recent_threads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No discussions yet.</p>
            ) : (
              profile.recent_threads.map((thread) => (
                <div key={thread.id} className="rounded-md border border-border px-3 py-2">
                  <p className="text-sm font-medium">{thread.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {thread.reply_count ?? 0} replies · {thread.score ?? 0} votes
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {profile.recent_replies.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent replies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.recent_replies.map((reply) => (
              <div key={reply.id} className="rounded-md bg-muted/30 p-3">
                <p className="line-clamp-3 text-sm">{reply.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {reply.score ?? 0} votes · {new Date(reply.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-sm text-muted-foreground">
        <button type="button" className="underline-offset-4 hover:underline" onClick={() => router.back()}>
          ← Back
        </button>
      </p>
    </div>
  );
}
