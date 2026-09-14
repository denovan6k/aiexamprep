"use client";

import { Search, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StudySearchMode } from "@/hooks/use-study-search";
import { cn } from "@/lib/utils";

const SEARCH_PROMPTS = [
  "What are the key definitions?",
  "Summarize the main topics",
  "Find formulas and equations",
  "Explain this concept simply"
];

const ASK_PROMPTS = [
  "How does this concept relate to the exam?",
  "Walk me through the main argument step by step.",
  "What are common mistakes students make here?",
  "Give me a concise summary with citations."
];

type SearchQueryPanelProps = {
  mode: StudySearchMode;
  query: string;
  isLoading: boolean;
  onQueryChange: (value: string) => void;
  onModeChange: (mode: StudySearchMode) => void;
  onApplyPrompt: (prompt: string) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
};

export function SearchQueryPanel({
  mode,
  query,
  isLoading,
  onQueryChange,
  onModeChange,
  onApplyPrompt,
  onSubmit
}: SearchQueryPanelProps) {
  const examplePrompts = mode === "search" ? SEARCH_PROMPTS : ASK_PROMPTS;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => onModeChange("search")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            mode === "search"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Search className="h-4 w-4" />
          Search passages
        </button>
        <button
          type="button"
          onClick={() => onModeChange("ask")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            mode === "ask"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="h-4 w-4" />
          Ask with citations
        </button>
      </div>

      <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
            {mode === "search" ? (
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search keywords, topics, or phrases from your notes"
                className="flex-1"
              />
            ) : (
              <Textarea
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Ask about a topic, formula, case, or concept from your notes"
                className="min-h-24 flex-1"
              />
            )}
            <Button type="submit" disabled={isLoading || !query.trim()} className="gap-2 sm:self-start">
              {mode === "ask" ? <Send className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              {isLoading ? "Working" : mode === "ask" ? "Ask" : "Search"}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Try an example
            </p>
            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onApplyPrompt(prompt)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent/40 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {mode === "search" ? (
            <p className="text-xs text-muted-foreground">
              Results update automatically about half a second after you stop typing. Press Enter to
              search immediately.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ask mode retrieves sources first, then drafts an answer with inline citations.
            </p>
          )}
      </div>
    </form>
  );
}
