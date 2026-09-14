"use client";

import { Cpu } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { ApiKeyProvider, UserApiKey } from "@/lib/settings";
import { asRoute } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type LlmSource = "platform" | "byok";

type ModelToggleProps = {
  llmSource: LlmSource;
  llmProvider?: ApiKeyProvider | null;
  apiKeys?: UserApiKey[];
  onChange?: (source: LlmSource, provider?: ApiKeyProvider | null) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
};

export function ModelToggle({
  llmSource,
  llmProvider,
  apiKeys = [],
  onChange,
  disabled,
  className,
  compact = false
}: ModelToggleProps) {
  const providerKeys = useMemo(() => apiKeys.filter((key) => key.is_valid), [apiKeys]);
  const validProviders = useMemo(
    () => providerKeys.map((key) => key.provider),
    [providerKeys]
  );

  const selectValue = useMemo(() => {
    if (llmSource !== "byok" || validProviders.length === 0) {
      return "platform";
    }

    const provider =
      llmProvider && validProviders.includes(llmProvider) ? llmProvider : validProviders[0];

    return provider ? `byok:${provider}` : "platform";
  }, [llmProvider, llmSource, validProviders]);

  const selectedProvider =
    selectValue === "platform" ? null : (selectValue.replace("byok:", "") as ApiKeyProvider);
  const selectedKey = selectedProvider
    ? providerKeys.find((key) => key.provider === selectedProvider)
    : null;
  const hasInvalidKey = llmSource === "byok" && (!selectedKey || !selectedKey.is_valid);

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {!compact ? (
        <Label htmlFor="context-model" className="sr-only">
          Model source
        </Label>
      ) : null}
      <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <Select
        value={selectValue}
        onValueChange={(value) => {
          if (value === "platform") {
            onChange?.("platform", null);
            return;
          }
          const provider = value.replace("byok:", "") as ApiKeyProvider;
          onChange?.("byok", provider);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id="context-model"
          className={cn(
            "h-8 rounded-full border-dashed text-xs",
            hasInvalidKey ? "border-destructive text-destructive" : "",
            compact ? "w-[min(190px,48vw)]" : "w-[min(240px,52vw)]"
          )}
        >
          <SelectValue placeholder="Platform model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="platform">Platform model</SelectItem>
          <SelectItem value="byok:openai" disabled={!providerKeys.some((key) => key.provider === "openai")}>
            Your OpenAI key
          </SelectItem>
          <SelectItem value="byok:anthropic" disabled={!providerKeys.some((key) => key.provider === "anthropic")}>
            Your Anthropic key
          </SelectItem>
        </SelectContent>
      </Select>
      {llmSource === "byok" && providerKeys.length === 0 ? (
        <Link href={asRoute("/settings")} className="hidden text-xs text-muted-foreground underline sm:inline">
          Add key
        </Link>
      ) : null}
      {hasInvalidKey ? (
        <Link href={asRoute("/settings")} className="hidden text-xs text-destructive underline sm:inline">
          Key invalid
        </Link>
      ) : null}
    </div>
  );
}
