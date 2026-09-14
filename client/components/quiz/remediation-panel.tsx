"use client";

import { BookOpen, Layers, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RemediationPanelSkeleton } from "@/components/quiz/remediation-panel-skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useCreateRemediationMutation,
  useRemediationOptionsQuery
} from "@/hooks/use-core-study";
import { trackProductEvent } from "@/lib/analytics";
import type { RemediationAction, RemediationResult } from "@/lib/core-study";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";

const actionDetails: Record<
  RemediationAction,
  { label: string; description: string; icon: typeof Layers }
> = {
  deck: {
    label: "Build review deck",
    description: "Turn missed concepts into focused flashcards.",
    icon: Layers
  },
  retry: {
    label: "Create retry quiz",
    description: "Practice the missed questions again.",
    icon: BookOpen
  },
  explain: {
    label: "Explain with AI",
    description: "Open chat with this attempt and its weak topics.",
    icon: MessageSquare
  }
};

function remediationHref(result: RemediationResult) {
  if (result.action === "deck" && result.resource_id) {
    return `/flashcards/${result.resource_id}/study`;
  }
  if (result.action === "retry" && result.resource_id) {
    return `/quizzes/${result.resource_id}/play`;
  }
  return result.url;
}

export function RemediationPanel({ attemptId }: { attemptId: string }) {
  const { token } = useAuth();
  const options = useRemediationOptionsQuery(attemptId);
  const create = useCreateRemediationMutation();
  const [result, setResult] = useState<RemediationResult | null>(null);
  const data = options.data;

  async function run(action: RemediationAction) {
    try {
      const created = await create.mutateAsync({
        attemptId,
        action,
        topics: data?.weak_topics ?? []
      });
      setResult(created);
      showSuccess(`Your ${action} follow-up is ready.`);
      void trackProductEvent(token, "remediation_created", {
        action,
        topic_count: created.topics.length,
        reused: Boolean(data?.existing.some((item) => item.action === action))
      });
    } catch (err) {
      showError(err, "Failed to create follow-up.");
    }
  }

  if (options.isLoading) {
    return <RemediationPanelSkeleton />;
  }
  if (options.error) {
    return <p className="text-sm text-danger">{options.error.message}</p>;
  }
  if (!data?.weak_topics.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Strengthen weak areas</CardTitle>
        <CardDescription>
          Create a focused follow-up from this attempt. Repeating an action safely reuses the same resource.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {data.weak_topics.map((topic) => (
            <Badge key={topic} variant="danger">{topic}</Badge>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {data.available_actions.map((action) => {
            const details = actionDetails[action];
            const Icon = details.icon;
            const existing = data.existing.find((item) => item.action === action);
            return (
              <div key={action} className="rounded-lg border p-3">
                <Icon className="h-4 w-4" />
                <p className="mt-2 text-sm font-medium">{details.label}</p>
                <p className="mt-1 min-h-10 text-xs text-muted-foreground">{details.description}</p>
                {existing ? (
                  <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                    <Link href={asRoute(remediationHref(existing))}>Open existing</Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    disabled={create.isPending}
                    onClick={() => void run(action)}
                  >
                    {create.isPending && create.variables?.action === action ? "Creating..." : "Create"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {result ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
            <p className="text-sm font-medium">Your {result.action} follow-up is ready.</p>
            <Button asChild size="sm">
              <Link href={asRoute(remediationHref(result))}>Open now</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
