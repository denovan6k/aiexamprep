"use client";

import Link from "next/link";
import { Loader } from "@/components/ui/loader";
import { AlertTriangle, ExternalLink, Loader2, Share2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { shareResource } from "@/lib/community";
import { listAllAgents, listAllFlashcardDecks, listAllQuizzes } from "@/lib/study";
import { showError, showSuccess } from "@/lib/toast";

type ShareResourceDialogProps = {
  groupId: string;
  groupSlug?: string;
  trigger?: ReactNode;
  onShared?: () => void;
};

type ResourceOption = { id: string; title: string; type: string };

const SENSITIVE_RESOURCE_TYPES = new Set(["agent", "material", "material_file", "file", "upload"]);

function resourceTypeLabel(type: string) {
  switch (type) {
    case "flashcard_deck":
      return "flashcard deck";
    case "agent":
      return "professor agent";
    default:
      return type.replaceAll("_", " ");
  }
}

function sharingWarning(option: ResourceOption | undefined) {
  if (!option) return null;
  if (option.type === "material" || option.type === "material_file" || option.type === "file" || option.type === "upload") {
    return "Uploaded materials and raw files cannot be shared directly. Share a generated quiz, deck, or summary instead.";
  }
  if (SENSITIVE_RESOURCE_TYPES.has(option.type)) {
    return `You are sharing a ${resourceTypeLabel(option.type)}. Review the title and description so private prompts, exam details, or personal notes are not exposed to the group.`;
  }
  return `This ${resourceTypeLabel(option.type)} will be visible to members of this group. Do not include private notes or source file links in the display text.`;
}

export function ShareResourceDialog({ groupId, groupSlug, trigger, onShared }: ShareResourceDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ResourceOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [introThreadId, setIntroThreadId] = useState<string | null>(null);
  const selectedOption = options.find((option) => option.id === selectedId);
  const warning = sharingWarning(selectedOption);

  useEffect(() => {
    if (!open || !token) return;
    setIsLoading(true);
    void Promise.all([listAllQuizzes(token), listAllFlashcardDecks(token), listAllAgents(token)])
      .then(([quizzes, decks, agents]) => {
        const merged: ResourceOption[] = [
          ...quizzes.map((quiz) => ({ id: quiz.id, title: quiz.title, type: "quiz" })),
          ...decks.map((deck) => ({ id: deck.id, title: deck.title, type: "flashcard_deck" })),
          ...agents.map((agent) => ({ id: agent.id, title: agent.name, type: "agent" }))
        ];
        setOptions(merged);
        if (merged[0]) {
          setSelectedId(merged[0].id);
          setTitle(merged[0].title);
        }
      })
      .catch(() => setOptions([]))
      .finally(() => setIsLoading(false));
  }, [open, token]);

  function handleSelectChange(resourceId: string) {
    setSelectedId(resourceId);
    const match = options.find((option) => option.id === resourceId);
    if (match) setTitle(match.title);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !selectedId || !title.trim()) return;
    const selected = options.find((option) => option.id === selectedId);
    if (!selected) return;
    setIsSubmitting(true);
    try {
      const shared = await shareResource(token, groupId, {
        resource_type: selected.type,
        resource_id: selectedId,
        title: title.trim(),
        description: description.trim() || undefined
      });
      if (shared.intro_thread_id) {
        showSuccess("Agent shared — introduction posted.");
        setIntroThreadId(shared.intro_thread_id);
        return;
      }
      showSuccess("Resource shared.");
      setOpen(false);
      setDescription("");
      onShared?.();
    } catch (err) {
      showError(err, "Failed to share resource");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share a resource
          </DialogTitle>
          <DialogDescription>Share a quiz, flashcard deck, or professor agent with this group.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader variant="classic" size="md" />
            </div>
          ) : options.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No quizzes, decks, or agents found. Create study content in your dashboard first.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="resource-select">Resource</Label>
                <Select value={selectedId} onValueChange={handleSelectChange} disabled={isSubmitting}>
                  <SelectTrigger id="resource-select">
                    <SelectValue placeholder="Select a resource" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.type}: {option.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {warning ? (
                <Alert variant={selectedOption && SENSITIVE_RESOURCE_TYPES.has(selectedOption.type) ? "warning" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Check sharing details</AlertTitle>
                  <AlertDescription>{warning}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="share-title">Display title</Label>
                <Input id="share-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="share-description">Description (optional)</Label>
                <Textarea
                  id="share-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}
          {introThreadId ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Agent shared — introduction posted.</p>
              <Button asChild variant="link" className="mt-2 h-auto gap-1.5 p-0">
                <Link href={`/community/groups/${groupSlug ?? groupId}/threads/${introThreadId}`}>
                  View introduction
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ) : null}
          <DialogFooter>
            {introThreadId ? (
              <Button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setIntroThreadId(null);
                  setDescription("");
                  onShared?.();
                }}
              >
                Done
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting || options.length === 0 || !title.trim()}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Share
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
