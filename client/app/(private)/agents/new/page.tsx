"use client";

import { useRouter } from "next/navigation";

import { CreateAgentDialog } from "@/components/agents/create-agent-dialog";
import { PageHeader } from "@/components/page-kit";

export default function NewAgentPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Agents"
        title="Create a new agent"
        description="Describe your examiner in plain English. We'll build a structured profile you can refine later."
      />
      <CreateAgentDialog
        open
        onOpenChange={(open) => {
          if (!open) router.push("/agents");
        }}
        onCreated={(agent) => router.push(`/agents/${agent.id}`)}
      />
    </div>
  );
}
