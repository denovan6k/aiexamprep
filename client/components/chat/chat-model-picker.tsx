"use client";

import { Check, ChevronDown, ExternalLink, ImageIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AiModel, AiProviderModels } from "@/lib/ai";
import {
  BYOK_MODELS,
  encodeModelSelection,
  modelSupportsVision,
  type LlmProvider,
  type LlmSource,
  type PlatformLlmProvider
} from "@/lib/llm";
import type { UserApiKey } from "@/lib/settings";
import { asRoute, cn } from "@/lib/utils";

type ChatModelPickerProps = {
  platformProviders?: AiProviderModels[];
  platformModels?: AiModel[];
  selectedModel: string;
  llmSource: LlmSource;
  llmProvider?: LlmProvider | null;
  apiKeys?: UserApiKey[];
  modelsLoading?: boolean;
  llmConfigured?: boolean;
  disabled?: boolean;
  visionOnly?: boolean;
  /** Prefer "bottom" in page forms (e.g. CV tailor); chat composer keeps "top". */
  menuSide?: "top" | "bottom";
  onModelChange: (modelId: string) => void;
  onLlmSourceChange?: (source: LlmSource, provider?: LlmProvider | null) => void;
  className?: string;
  fullWidth?: boolean;
};

function modelLabel(
  modelId: string,
  source: LlmSource,
  provider: LlmProvider | null,
  platformModels: AiModel[]
): string {
  if (source === "byok" && provider && (provider === "openai" || provider === "anthropic")) {
    const match = BYOK_MODELS[provider].find((item) => item.id === modelId);
    if (match) return match.name;
  }
  const platform = platformModels.find(
    (item) =>
      item.id === modelId && (!provider || !item.provider || item.provider === provider)
  );
  return platform?.name ?? modelId.split("/").pop()?.split(":")[0] ?? "Model";
}

function ModelMenuItem({
  label,
  selected,
  free,
  onClick
}: {
  label: string;
  selected: boolean;
  free?: boolean | null;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      className="relative cursor-default select-none rounded-sm py-1.5 pl-2 pr-8 text-xs focus:bg-accent focus:text-accent-foreground"
    >
      <span className="truncate">
        {label}
        {free === true ? <span className="ml-1 text-muted-foreground">· free</span> : null}
      </span>
      {selected ? (
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </DropdownMenuItem>
  );
}

export function ChatModelPicker({
  platformProviders = [],
  platformModels = [],
  selectedModel,
  llmSource,
  llmProvider,
  apiKeys = [],
  modelsLoading,
  llmConfigured,
  disabled,
  visionOnly = false,
  menuSide = "top",
  onModelChange,
  onLlmSourceChange,
  className,
  fullWidth = false
}: ChatModelPickerProps) {
  const isMobile = useIsMobile();
  const validKeys = useMemo(() => apiKeys.filter((key) => key.is_valid), [apiKeys]);
  const flatPlatformModels = useMemo(() => {
    if (platformProviders.length > 0) {
      return platformProviders.flatMap((provider) =>
        provider.models.map((model) => ({ ...model, provider: provider.id }))
      );
    }
    return platformModels;
  }, [platformProviders, platformModels]);
  const filteredPlatformProviders = useMemo(() => {
    if (!visionOnly) return platformProviders;
    return platformProviders
      .map((provider) => ({
        ...provider,
        models: provider.models.filter((model) =>
          modelSupportsVision(model.id, "platform", provider.id as PlatformLlmProvider, flatPlatformModels)
        )
      }))
      .filter((provider) => provider.models.length > 0);
  }, [flatPlatformModels, platformProviders, visionOnly]);
  const filteredFlatPlatformModels = useMemo(() => {
    if (!visionOnly) return flatPlatformModels;
    return flatPlatformModels.filter((model) =>
      modelSupportsVision(
        model.id,
        "platform",
        (model.provider as PlatformLlmProvider | undefined) ?? null,
        flatPlatformModels
      )
    );
  }, [flatPlatformModels, visionOnly]);
  const filteredByokModels = useMemo(() => {
    if (!visionOnly) return BYOK_MODELS;
    return {
      openai: BYOK_MODELS.openai.filter((model) =>
        modelSupportsVision(model.id, "byok", "openai", flatPlatformModels)
      ),
      anthropic: BYOK_MODELS.anthropic.filter((model) =>
        modelSupportsVision(model.id, "byok", "anthropic", flatPlatformModels)
      )
    };
  }, [flatPlatformModels, visionOnly]);
  const filteredValidKeys = useMemo(() => {
    if (!visionOnly) return validKeys;
    return validKeys.filter((key) => filteredByokModels[key.provider].length > 0);
  }, [filteredByokModels, validKeys, visionOnly]);
  const selectedValue = encodeModelSelection(llmSource, selectedModel, llmProvider);
  const triggerLabel = modelsLoading
    ? "Loading..."
    : selectedModel
      ? modelLabel(selectedModel, llmSource, llmProvider ?? null, flatPlatformModels)
      : llmConfigured
        ? visionOnly
          ? "Vision model"
          : "Model"
        : "No API key";

  function selectModel(source: LlmSource, modelId: string, provider?: LlmProvider | null) {
    onModelChange(modelId);
    onLlmSourceChange?.(source, provider ?? null);
  }

  const hasPlatform =
    filteredPlatformProviders.length > 0 || filteredFlatPlatformModels.length > 0;
  const hasVisionModels = hasPlatform || filteredValidKeys.length > 0;

  return (
    <div className={cn("min-w-0", fullWidth && "w-full", className)}>
      <Label htmlFor="composer-model" className="sr-only">
        Model
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            id="composer-model"
            type="button"
            disabled={disabled || modelsLoading || (!hasVisionModels && !visionOnly)}
            className={cn(
              "flex h-9 min-h-9 cursor-pointer items-center justify-between gap-1.5 px-2.5 text-xs font-medium text-foreground shadow-none outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3",
              visionOnly && "bg-primary/5 ring-1 ring-primary/30 hover:bg-primary/10",
              fullWidth
                ? "w-full rounded-md border border-input bg-background hover:bg-accent/40"
                : "min-w-0 w-full max-w-full rounded-full border-0 bg-muted hover:bg-muted/80 sm:max-w-[11rem]"
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              {visionOnly ? (
                <ImageIcon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              ) : null}
              <span className="truncate">{triggerLabel}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={isMobile ? "start" : "end"}
          side={menuSide}
          sideOffset={6}
          collisionPadding={16}
          className="max-h-[min(70dvh,20rem)] min-w-[min(18rem,calc(100vw-2rem))] max-w-[min(20rem,calc(100vw-2rem))] overflow-hidden p-0"
        >
          {visionOnly ? (
            <div className="border-b border-border/60 bg-muted/30 px-3 py-2.5">
              <p className="text-xs font-medium text-foreground">Vision-capable models</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Only models that can read your image are shown, grouped by provider.
              </p>
            </div>
          ) : null}
          <div className="max-h-[min(60dvh,16rem)] overflow-y-auto overscroll-contain p-1">
            {!hasVisionModels ? (
              <DropdownMenuItem disabled className="text-xs">
                {visionOnly
                  ? "No vision models available — check Settings → Models"
                  : "No platform models available"}
              </DropdownMenuItem>
            ) : filteredPlatformProviders.length > 0 ? (
              filteredPlatformProviders.map((provider) => (
                <Fragment key={provider.id}>
                  {/* Provider heading hidden — selection still passes provider.id in selectModel() */}
                  {/* <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {provider.name}
                    <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/80">
                      ({provider.models.length})
                    </span>
                  </DropdownMenuLabel> */}
                  {provider.models.map((model) => {
                    const value = encodeModelSelection(
                      "platform",
                      model.id,
                      provider.id as PlatformLlmProvider
                    );
                    return (
                      <ModelMenuItem
                        key={value}
                        label={model.name}
                        free={model.is_free}
                        selected={selectedValue === value}
                        onClick={() =>
                          selectModel("platform", model.id, provider.id as PlatformLlmProvider)
                        }
                      />
                    );
                  })}
                </Fragment>
              ))
            ) : (
              filteredFlatPlatformModels.map((model) => {
                const value = encodeModelSelection(
                  "platform",
                  model.id,
                  (model.provider as PlatformLlmProvider | undefined) ?? null
                );
                return (
                  <ModelMenuItem
                    key={value}
                    label={model.name}
                    free={model.is_free}
                    selected={selectedValue === value}
                    onClick={() =>
                      selectModel(
                        "platform",
                        model.id,
                        (model.provider as PlatformLlmProvider | undefined) ?? null
                      )
                    }
                  />
                );
              })
            )}
          </div>

          {filteredValidKeys.length > 0 ? (
            <div className="border-t border-border p-1">
              <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Your API keys
              </DropdownMenuLabel>
              {filteredValidKeys.map((key) => (
                <Fragment key={key.id}>
                  {/* <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium normal-case tracking-normal text-foreground">
                    {key.provider}
                    {key.label ? ` · ${key.label}` : ""}
                    <span className="ml-1 font-normal text-muted-foreground">· your key</span>
                  </DropdownMenuLabel> */}
                  {filteredByokModels[key.provider].map((model) => {
                    const value = encodeModelSelection("byok", model.id, key.provider);
                    return (
                      <ModelMenuItem
                        key={value}
                        label={model.name}
                        selected={selectedValue === value}
                        onClick={() => selectModel("byok", model.id, key.provider)}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          ) : null}

          <DropdownMenuSeparator className="m-0" />
          <div className="p-1">
            <DropdownMenuItem asChild className="rounded-sm py-1.5 pl-2 text-xs">
              <Link href={asRoute("/settings/models")} className="flex items-center gap-2">
                <ExternalLink className="h-3.5 w-3.5" />
                Manage models &amp; keys
              </Link>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
