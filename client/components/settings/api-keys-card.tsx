"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useDeleteApiKeyMutation
} from "@/hooks/use-settings";
import { getClientErrorMessage } from "@/lib/api";
import type { ApiKeyProvider } from "@/lib/settings";
import { showError, showSuccess } from "@/lib/toast";
import { apiKeySchema } from "@/lib/validation";

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

export function ApiKeysCard() {
  const { data: apiKeys = [], isLoading: isLoadingKeys, error: keysLoadError } = useApiKeysQuery();
  const createKeyMutation = useCreateApiKeyMutation();
  const deleteKeyMutation = useDeleteApiKeyMutation();
  
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isValid }
  } = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    mode: "onChange",
    defaultValues: { provider: "openai", label: "", apiKey: "" }
  });
  
  const selectedProvider = watch("provider");
  const error = keysLoadError ? getClientErrorMessage(keysLoadError, "Failed to load API keys.") : null;

  function handleSaveKey(values: ApiKeyFormValues) {
    createKeyMutation.mutate(
      {
        provider: values.provider as ApiKeyProvider,
        api_key: values.apiKey,
        label: values.label || undefined
      },
      {
        onSuccess: (saved) => {
          reset({ provider: saved.provider as ApiKeyProvider, label: "", apiKey: "" });
          showSuccess(`${saved.provider === "openai" ? "OpenAI" : "Anthropic"} key saved and validated.`);
        },
        onError: (err) => showError(err, "Failed to save API key.")
      }
    );
  }

  function handleDeleteKey(keyId: string) {
    deleteKeyMutation.mutate(keyId, {
      onSuccess: () => showSuccess("API key removed."),
      onError: (err) => showError(err, "Failed to delete API key.")
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">API key management</CardTitle>
        <CardDescription>
          Keys are encrypted at rest and validated with a test completion before saving. Only the last four
          characters are shown after save.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(handleSaveKey)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Controller
              control={control}
              name="provider"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="provider" aria-invalid={Boolean(errors.provider)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.provider ? <p className="text-sm text-danger">{errors.provider.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="label">Label (optional)</Label>
            <Input
              id="label"
              placeholder="Personal laptop"
              {...register("label")}
              aria-invalid={Boolean(errors.label)}
            />
            {errors.label ? <p className="text-sm text-danger">{errors.label.message}</p> : null}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="api-key">API key</Label>
            <Input
              id="api-key"
              type="password"
              autoComplete="off"
              placeholder={selectedProvider === "openai" ? "sk-..." : "sk-ant-..."}
              {...register("apiKey")}
              aria-invalid={Boolean(errors.apiKey)}
            />
            {errors.apiKey ? <p className="text-sm text-danger">{errors.apiKey.message}</p> : null}
          </div>
          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={isSubmitting || !isValid || createKeyMutation.isPending}
            >
              {createKeyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating…
                </>
              ) : (
                "Save and validate key"
              )}
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Saved keys</h3>
          {isLoadingKeys ? (
            <p className="text-sm text-muted-foreground">Loading keys…</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys saved yet.</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize">
                      {key.provider}
                      {key.label ? ` · ${key.label}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">•••• {key.key_last4}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {key.is_valid ? (
                      <Badge variant="success">Valid</Badge>
                    ) : (
                      <Badge variant="destructive">Invalid</Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${key.provider} key`}
                      disabled={deleteKeyMutation.isPending && deleteKeyMutation.variables === key.id}
                      onClick={() => handleDeleteKey(key.id)}
                    >
                      {deleteKeyMutation.isPending && deleteKeyMutation.variables === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
