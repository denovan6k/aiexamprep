"use client";

import { BookOpen, Bot, Layers, MessageSquare } from "lucide-react";

const starterPrompts = [
  {
    icon: MessageSquare,
    title: "Ask about your notes",
    description: "Explain a concept from material you upload.",
    prompt: "Explain the main ideas from my notes in plain language."
  },
  {
    icon: BookOpen,
    title: "Generate a practice quiz",
    description: "Timed practice on any topic or from your notes.",
    prompt: "Generate a 10-question practice quiz on my uploaded material."
  },
  {
    icon: Layers,
    title: "Build flashcards",
    description: "Spaced-repetition deck on any topic.",
    prompt: "Create 15 flashcards covering the key terms from my notes."
  },
  {
    icon: Bot,
    title: "Create a professor agent",
    description: "MCQs with tricky distractors tailored to your exam style.",
    prompt:
      "Help me create a professor agent that asks application-heavy MCQs with tricky distractors for my upcoming exam."
  }
];

type ChatEmptyStateProps = {
  onSelectPrompt: (prompt: string) => void;
};

export function ChatEmptyState({ onSelectPrompt }: ChatEmptyStateProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-lg text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          What would you like to study?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Upload notes, pick a model and agent, then ask for quizzes, flashcards, or explanations.
        </p>
      </div>

      <div className="mx-auto mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {starterPrompts.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => onSelectPrompt(item.prompt)}
              className="group rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-left transition-all hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">{item.title}</span>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
