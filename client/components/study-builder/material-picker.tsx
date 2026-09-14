"use client";

import { useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";

import { MaterialUploadPanel } from "@/components/materials/material-upload-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { useMaterialsQuery, useUploadMaterialMutation } from "@/hooks/use-materials";

type MaterialPickerProps = {
  selectedMaterialIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  showUpload?: boolean;
};

export function MaterialPicker({
  selectedMaterialIds,
  onChange,
  disabled = false,
  showUpload = true
}: MaterialPickerProps) {
  const materials = useMaterialsQuery({ status: "processed", limit: 50, offset: 0, source: "material" });
  const upload = useUploadMaterialMutation();

  const selectedSet = useMemo(() => new Set(selectedMaterialIds), [selectedMaterialIds]);

  function toggleMaterial(id: string) {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  }

  async function handleUpload(file: File) {
    await upload.mutateAsync({ file });
  }

  return (
    <div className="space-y-3">
      {showUpload ? (
        <MaterialUploadPanel
          onUpload={handleUpload}
          isUploading={upload.isPending}
          description="Upload a PDF/DOCX/TXT/MD file. We’ll use processed materials for AI fill."
        />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Materials to use</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || selectedMaterialIds.length === 0}
          onClick={() => onChange([])}
        >
          Clear
        </Button>
      </div>

      {materials.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading materials…</div>
      ) : materials.data?.items?.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {materials.data.items.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-md border p-2">
              <Checkbox
                id={`material-${m.id}`}
                checked={selectedSet.has(m.id)}
                disabled={disabled}
                onCheckedChange={() => toggleMaterial(m.id)}
              />
              <div className="min-w-0">
                <Label htmlFor={`material-${m.id}`} className="truncate text-sm">
                  {m.title}
                </Label>
                <div className="text-xs text-muted-foreground">{m.chunk_count} chunks</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No processed materials yet"
          description="Upload a file and wait for processing to finish."
        />
      )}
    </div>
  );
}

