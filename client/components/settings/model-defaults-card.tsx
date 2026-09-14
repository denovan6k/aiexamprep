"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";

import { SettingsCardFieldsSkeleton } from "@/components/settings/settings-card-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useAiModelsQuery } from "@/hooks/use-ai-models";
import { useModelDefaultsQuery, useUpdateModelDefaultsMutation } from "@/hooks/use-settings";
import type { AiProviderModels } from "@/lib/ai";
import { getClientErrorMessage } from "@/lib/api";
import type { ModelDefaults } from "@/lib/settings";
import { showError, showSuccess } from "@/lib/toast";

const emptyDefaults: ModelDefaults = {
  default_chat_model: "",
  default_generation_model: "",
  default_embedding_model: ""
};

const SELECT_LIST_LIMIT = 80;

export function ModelDefaultsCard() {
  const { data, isLoading, error: loadError } = useModelDefaultsQuery();
  const { data: modelsData } = useAiModelsQuery();
  const updateMutation = useUpdateModelDefaultsMutation();
  const [defaults, setDefaults] = useState<ModelDefaults>(emptyDefaults);

  useEffect(() => {
    if (!data) return;
    setDefaults({
      default_chat_model: data.default_chat_model ?? "",
      default_generation_model: data.default_generation_model ?? "",
      default_embedding_model: data.default_embedding_model ?? ""
    });
  }, [data]);

  const error = loadError ? getClientErrorMessage(loadError, "Failed to load model defaults.") : null;
  const providers = modelsData?.providers ?? [];

  function handleSave() {
    updateMutation.mutate(
      {
        default_chat_model: defaults.default_chat_model?.trim() || null,
        default_generation_model: defaults.default_generation_model?.trim() || null,
        default_embedding_model: defaults.default_embedding_model?.trim() || null
      },
      {
        onSuccess: (saved) => {
          setDefaults({
            default_chat_model: saved.default_chat_model ?? "",
            default_generation_model: saved.default_generation_model ?? "",
            default_embedding_model: saved.default_embedding_model ?? ""
          });
          showSuccess("Model defaults saved.");
        },
        onError: (err) => showError(err, "Failed to save model defaults.")
      }
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Task model defaults</CardTitle>
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardDescription>
          Choose preferred models for chat, generation, and embeddings. Search the catalog when many
          models are available, or enter a custom model ID.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <SettingsCardFieldsSkeleton />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <ModelInput
              id="default-chat-model"
              label="Chat"
              value={defaults.default_chat_model ?? ""}
              placeholder="gpt-4o-mini"
              providers={providers}
              onChange={(value) => setDefaults((prev) => ({ ...prev, default_chat_model: value }))}
            />
            <ModelInput
              id="default-generation-model"
              label="Generation"
              value={defaults.default_generation_model ?? ""}
              placeholder="gpt-4o"
              providers={providers}
              onChange={(value) =>
                setDefaults((prev) => ({ ...prev, default_generation_model: value }))
              }
            />
            <ModelInput
              id="default-embedding-model"
              label="Embedding"
              value={defaults.default_embedding_model ?? ""}
              placeholder="text-embedding-3-small"
              providers={providers}
              onChange={(value) =>
                setDefaults((prev) => ({ ...prev, default_embedding_model: value }))
              }
            />
          </div>
        )}

        <Button type="button" onClick={handleSave} disabled={isLoading || updateMutation.isPending}>
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save defaults"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ModelInput({
  id,
  label,
  value,
  placeholder,
  onChange,
  providers = []
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  providers?: AiProviderModels[];
}) {
  const [customMode, setCustomMode] = useState(false);
  const [listQuery, setListQuery] = useState("");

  const isValueInCatalog = providers.some((provider) =>
    provider.models.some((model) => model.id === value)
  );

  useEffect(() => {
    if (value && !isValueInCatalog && providers.length > 0) {
      setCustomMode(true);
    }
  }, [value, isValueInCatalog, providers.length]);

  const filteredProviders = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return providers
      .map((provider) => {
        const matched = provider.models.filter((model) => {
          if (model.id === value) return true;
          if (!q) return true;
          return `${model.id} ${model.name}`.toLowerCase().includes(q);
        });
        // Prefer keeping the current selection, then fill remaining slots.
        const selected = matched.filter((model) => model.id === value);
        const rest = matched.filter((model) => model.id !== value);
        return {
          ...provider,
          models: [...selected, ...rest].slice(0, SELECT_LIST_LIMIT)
        };
      })
      .filter((provider) => provider.models.length > 0);
  }, [providers, listQuery, value]);

  const totalMatched = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) {
      return providers.reduce((sum, provider) => sum + provider.models.length, 0);
    }
    return providers.reduce(
      (sum, provider) =>
        sum +
        provider.models.filter((model) =>
          `${model.id} ${model.name}`.toLowerCase().includes(q)
        ).length,
      0
    );
  }, [providers, listQuery]);

  const shownCount = filteredProviders.reduce((sum, provider) => sum + provider.models.length, 0);
  const truncated = totalMatched > shownCount;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {providers.length > 0 ? (
          <button
            type="button"
            onClick={() => setCustomMode((prev) => !prev)}
            className="text-[10px] font-medium text-primary hover:underline"
          >
            {customMode ? "Select from list" : "Enter custom ID"}
          </button>
        ) : null}
      </div>

      {customMode || providers.length === 0 ? (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <div className="space-y-2">
          <Input
            value={listQuery}
            onChange={(event) => setListQuery(event.target.value)}
            placeholder="Search models…"
            aria-label={`Search ${label} models`}
          />
          <Select
            value={value || "__empty__"}
            onValueChange={(val) => onChange(val === "__empty__" ? "" : val)}
          >
            <SelectTrigger id={id}>
              <SelectValue placeholder={placeholder || "Select a model"} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__empty__">Clear default (no preference)</SelectItem>
              {value && !isValueInCatalog ? (
                <SelectItem value={value}>{value} (current)</SelectItem>
              ) : null}
              {filteredProviders.map((provider) => (
                <SelectGroup key={provider.id}>
                  <SelectLabel className="px-2 py-1.5 text-xs font-semibold capitalize text-muted-foreground">
                    {provider.name}
                  </SelectLabel>
                  {provider.models.map((model) => (
                    <SelectItem key={model.id} value={model.id} className="text-xs">
                      {model.name}{" "}
                      <span className="font-mono text-[10px] text-muted-foreground">({model.id})</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            {listQuery.trim()
              ? `${shownCount} match${shownCount === 1 ? "" : "es"}`
              : `Showing ${shownCount} of ${totalMatched}`}
            {truncated ? " — refine search to see more" : null}
          </p>
        </div>
      )}
    </div>
  );
}
