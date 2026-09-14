"use client";

import { Loader2, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { ChatModelPicker } from "@/components/chat/chat-model-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthToken } from "@/hooks/use-auth-token";
import { useCreateCvTailoringMutation } from "@/hooks/use-cv";
import { useApiKeysQuery } from "@/hooks/use-settings";
import { flattenProviderModels, listAiModels, pickDefaultModel, type AiModel, type AiProviderModels } from "@/lib/ai";
import type { CvDocument, CvTailoring } from "@/lib/cv";
import type { LlmProvider, LlmSource } from "@/lib/llm";
import { showError, showSuccess } from "@/lib/toast";

export function CvTailorForm({
  selectedDocument,
  onTailoringCreated
}: {
  selectedDocument: CvDocument | null;
  onTailoringCreated: (tailoring: CvTailoring) => void;
}) {
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [models, setModels] = useState<AiModel[]>([]);
  const [platformProviders, setPlatformProviders] = useState<AiProviderModels[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [llmConfigured, setLlmConfigured] = useState(false);
  const [llmSource, setLlmSource] = useState<LlmSource>("platform");
  const [llmProvider, setLlmProvider] = useState<LlmProvider | null>(null);
  const token = useAuthToken();
  const { data: apiKeys = [] } = useApiKeysQuery();
  const mutation = useCreateCvTailoringMutation();
  const canGenerate = selectedDocument?.status === "processed" && jobDescription.trim().length >= 40 && !mutation.isPending;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function loadModels(sessionToken: string) {
      setModelsLoading(true);
      try {
        const response = await listAiModels(sessionToken);
        if (cancelled) return;
        setLlmConfigured(response.configured);
        setPlatformProviders(response.providers ?? []);
        setModels(flattenProviderModels(response));
        const selected = pickDefaultModel(response);
        setSelectedModel(selected.modelId);
        if (selected.provider) {
          setLlmSource("platform");
          setLlmProvider(selected.provider as LlmProvider);
        }
      } catch {
        if (!cancelled) {
          setLlmConfigured(false);
          setModels([]);
          setPlatformProviders([]);
          setSelectedModel("");
        }
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    }

    void loadModels(token);
    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleLlmSourceChange(source: LlmSource, provider?: LlmProvider | null) {
    setLlmSource(source);
    setLlmProvider(provider ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDocument) return;
    try {
      const tailoring = await mutation.mutateAsync({
        cv_document_id: selectedDocument.id,
        job_title: jobTitle.trim() || undefined,
        company: company.trim() || undefined,
        job_description: jobDescription.trim(),
        model: selectedModel || undefined,
        llm_source: llmSource,
        llm_provider: llmProvider
      });
      onTailoringCreated(tailoring);
      if (tailoring.status === "failed") {
        showError(tailoring.error_message || "Could not generate a tailored CV.");
        return;
      }
      if (tailoring.status === "completed") {
        showSuccess("Tailored CV ready.");
        return;
      }
      showSuccess("Tailoring started.");
    } catch (submitError) {
      showError(submitError, "Could not generate a tailored CV.");
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="font-medium">Selected CV: </span>
            <span className="text-muted-foreground">
              {selectedDocument ? selectedDocument.title || selectedDocument.file_name : "Choose or upload a CV"}
            </span>
          </div>
          <ChatModelPicker
            platformProviders={platformProviders}
            platformModels={models}
            selectedModel={selectedModel}
            llmSource={llmSource}
            llmProvider={llmProvider}
            apiKeys={apiKeys}
            modelsLoading={modelsLoading}
            llmConfigured={llmConfigured}
            disabled={mutation.isPending}
            menuSide="bottom"
            onModelChange={setSelectedModel}
            onLlmSourceChange={handleLlmSourceChange}
            className="shrink-0"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cv-job-title">Job title</Label>
          <Input
            id="cv-job-title"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            placeholder="Product analyst"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cv-company">Company</Label>
          <Input
            id="cv-company"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Acme"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cv-job-description">Job description</Label>
        <Textarea
          id="cv-job-description"
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          placeholder="Paste the role requirements, responsibilities, and qualifications..."
          className="min-h-56 resize-y"
        />
      </div>

      {selectedDocument && selectedDocument.status !== "processed" ? (
        <p className="text-sm text-warning">This CV must finish processing before it can be tailored.</p>
      ) : null}

      <Button type="submit" className="gap-2" disabled={!canGenerate}>
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {mutation.isPending ? "Generating..." : "Generate tailored CV"}
      </Button>
    </form>
  );
}
