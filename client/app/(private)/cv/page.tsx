"use client";

import { FileText, Plus, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CvExportActions } from "@/components/cv/cv-export-actions";
import { CvLibraryPanel } from "@/components/cv/cv-library-panel";
import { CvTailorForm } from "@/components/cv/cv-tailor-form";
import { CvTailoredPreview } from "@/components/cv/cv-tailored-preview";
import { CvTailoringHistory } from "@/components/cv/cv-tailoring-history";
import { CvUploadDialog } from "@/components/cv/cv-upload-dialog";
import { PageHeader } from "@/components/page-kit";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCvDocumentsQuery, useCvTailoringsQuery } from "@/hooks/use-cv";
import type { CvDocument, CvTailoring } from "@/lib/cv";

export default function CvPage() {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedTailoring, setSelectedTailoring] = useState<CvTailoring | null>(null);
  const {
    data: documentsData,
    isLoading: isLoadingDocuments,
    error: documentsError
  } = useCvDocumentsQuery({ limit: 50, offset: 0 });
  const documents = useMemo(() => documentsData?.items ?? [], [documentsData?.items]);
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;
  const {
    data: tailoringsData,
    isLoading: isLoadingTailorings,
    error: tailoringsError
  } = useCvTailoringsQuery({ limit: 50, offset: 0, cvDocumentId: selectedDocumentId ?? undefined });
  const tailorings = useMemo(() => tailoringsData?.items ?? [], [tailoringsData?.items]);

  useEffect(() => {
    if (documents.length === 0) {
      setSelectedDocumentId(null);
      setSelectedTailoring(null);
      return;
    }

    if (!selectedDocumentId || !documents.some((document) => document.id === selectedDocumentId)) {
      setSelectedDocumentId(documents[0].id);
      setSelectedTailoring(null);
    }
  }, [documents, selectedDocumentId]);

  useEffect(() => {
    if (!selectedTailoring && tailorings.length > 0) {
      setSelectedTailoring(tailorings[0]);
      return;
    }

    if (selectedTailoring && !tailorings.some((tailoring) => tailoring.id === selectedTailoring.id)) {
      setSelectedTailoring(tailorings[0] ?? null);
    }
  }, [selectedTailoring, tailorings]);

  function handleDocumentSelect(document: CvDocument) {
    setSelectedDocumentId(document.id);
    setSelectedTailoring(null);
  }

  function handleDocumentUploaded(document: CvDocument) {
    setSelectedDocumentId(document.id);
    setSelectedTailoring(null);
  }

  function handleTailoringCreated(tailoring: CvTailoring) {
    setSelectedTailoring(tailoring);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="CV Tailor"
        title="Tailor a CV for each role"
        description="Upload a source CV, paste a job description, and generate an ATS-friendly version you can copy or download."
        actions={
          <CvUploadDialog
            onUploaded={handleDocumentUploaded}
            trigger={
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Upload CV
              </Button>
            }
          />
        }
      />

      {documentsError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Could not load CVs</AlertTitle>
          <AlertDescription>{documentsError.message}</AlertDescription>
        </Alert>
      ) : null}
      {tailoringsError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Could not load tailorings</AlertTitle>
          <AlertDescription>{tailoringsError.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Card>
            <CardHeader className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <CardTitle className="text-base">My CVs</CardTitle>
              <CvUploadDialog
                onUploaded={handleDocumentUploaded}
                trigger={
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Upload
                  </Button>
                }
              />
            </CardHeader>
            <CardContent>
              <CvLibraryPanel
                documents={documents}
                selectedDocumentId={selectedDocumentId}
                isLoading={isLoadingDocuments}
                onSelect={handleDocumentSelect}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Past tailorings</CardTitle>
            </CardHeader>
            <CardContent>
              <CvTailoringHistory
                tailorings={tailorings}
                selectedTailoringId={selectedTailoring?.id ?? null}
                isLoading={isLoadingTailorings}
                onSelect={setSelectedTailoring}
              />
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Tailor for a role</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CvTailorForm selectedDocument={selectedDocument} onTailoringCreated={handleTailoringCreated} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Result</CardTitle>
              </div>
              <CvExportActions tailoring={selectedTailoring} />
            </CardHeader>
            <CardContent>
              <div className="max-h-[min(70vh,720px)] overflow-y-auto overscroll-y-contain pr-1">
                <CvTailoredPreview tailoring={selectedTailoring} />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
