"use client";

import Link from "next/link";
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";

import { PageHeader, SectionGrid, SectionTitle } from "@/components/page-kit";
import { useAuth } from "@/components/providers/auth-provider";
import { GenerationProfilesCard } from "@/components/settings/generation-profiles-card";
import { StudyPreferencesCard } from "@/components/settings/study-preferences-card";
import { SupportHelpCard } from "@/components/settings/support-help-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { asRoute } from "@/lib/utils";

export default function SettingsPage() {
  const { user, refreshSession } = useAuth();

  return (
    <div className="mx-auto max-w-5xl pb-2">
      <PageHeader
        eyebrow="Settings"
        title="Account settings"
        description="Manage your profile, verification status, billing, and workspace preferences."
      />

      <SectionGrid cols={2}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Profile</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>Your signed-in account details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="font-medium">{user?.full_name || "Not set"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void refreshSession()}>
              Refresh session
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Email verification</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>Confirm account ownership for recovery and notices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.is_email_verified ? (
              <Badge variant="success" className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Verified
              </Badge>
            ) : (
              <Badge variant="warning">Not verified</Badge>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link href={asRoute("/email-verification")}>Manage verification</Link>
            </Button>
          </CardContent>
        </Card>
      </SectionGrid>

      <SectionTitle title="Workspace preferences" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Switch between light, dark, and system themes.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing</CardTitle>
            <CardDescription>View usage limits, plans, checkout, and portal access.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={asRoute("/settings/billing")}>Open billing</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Models &amp; keys</CardTitle>
              <KeyRound className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>Configure defaults, system catalogs, and BYOK credentials.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href={asRoute("/settings/models")}>Open models &amp; keys</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <StudyPreferencesCard />
      </div>

      <SectionTitle title="Generation automation" />
      <GenerationProfilesCard />

      <SectionTitle title="Help & support" />
      <SupportHelpCard />
    </div>
  );
}
