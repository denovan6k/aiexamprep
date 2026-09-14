"use client";

import { PageHeader, SectionTitle } from "@/components/page-kit";
import { ApiKeysCard } from "@/components/settings/api-keys-card";
import { ModelCatalogCard } from "@/components/settings/model-catalog-card";
import { ModelDefaultsCard } from "@/components/settings/model-defaults-card";

export default function ModelsPage() {
  return (
    <div className="mx-auto max-w-5xl pb-2">
      <PageHeader
        eyebrow="Settings"
        title="Models & API keys"
        description="Configure default AI models for your workspace, browse the system catalog, or manage bring-your-own credentials."
      />

      <SectionTitle title="Live model catalog" />
      <div className="mb-8">
        <ModelCatalogCard />
      </div>

      <SectionTitle title="AI defaults" />
      <div className="mb-8">
        <ModelDefaultsCard />
      </div>

      <SectionTitle title="Bring your own key" />
      <ApiKeysCard />
    </div>
  );
}
