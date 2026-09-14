import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bot,
  Brain,
  FileText,
  HelpCircle,
  Layers,
  ListChecks,
  Timer
} from "lucide-react";

export type SlashCommand = {
  id: string;
  label: string;
  description: string;
  usage?: string;
  icon?: LucideIcon;
  /** Text inserted when selected. Omit for parent-only entries. */
  template?: string;
  /** Place cursor this many chars before the end of the inserted template. */
  cursorOffset?: number;
  keywords?: string[];
  children?: SlashCommand[];
};

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "quiz",
    label: "Quiz",
    description: "Generate a quiz from your materials or a topic",
    usage: "/quiz [count] [type] on [topic] [timer N]",
    icon: ListChecks,
    children: [
      {
        id: "quiz-mcq",
        label: "MCQ quiz",
        description: "Multiple-choice questions on a topic",
        usage: "/quiz 10 mcq on [topic]",
        icon: ListChecks,
        template: "/quiz 10 mcq on ",
        keywords: ["mcq", "multiple", "choice"]
      },
      {
        id: "quiz-mixed",
        label: "Mixed quiz",
        description: "MCQ, true/false, matching, and short answer",
        usage: "/quiz mixed on [topic]",
        icon: Layers,
        template: "/quiz mixed on ",
        keywords: ["mixed", "variety"]
      },
      {
        id: "quiz-timed",
        label: "Timed MCQ quiz",
        description: "MCQ quiz with a countdown timer",
        usage: "/quiz 10 mcq on [topic] timer 15",
        icon: Timer,
        template: "/quiz 10 mcq on topic timer 15",
        cursorOffset: 15,
        keywords: ["timed", "timer", "minutes"]
      },
      {
        id: "quiz-true-false",
        label: "True / false",
        description: "Quick true or false questions",
        usage: "/quiz 10 true/false on [topic]",
        icon: ListChecks,
        template: "/quiz 10 true/false on ",
        keywords: ["true", "false", "tf"]
      },
      {
        id: "quiz-matching",
        label: "Matching",
        description: "Match terms to definitions",
        usage: "/quiz 10 matching on [topic]",
        icon: Layers,
        template: "/quiz 10 matching on ",
        keywords: ["matching", "pairs"]
      },
      {
        id: "quiz-short",
        label: "Short answer",
        description: "Open-ended short response questions",
        usage: "/quiz 5 short answer on [topic]",
        icon: FileText,
        template: "/quiz 5 short answer on ",
        keywords: ["short", "answer", "open"]
      }
    ]
  },
  {
    id: "agent",
    label: "Agent",
    description: "Switch professor style for this chat",
    usage: "/agent [name|list|clear]",
    icon: Bot,
    template: "/agent ",
    keywords: ["agent", "professor", "style", "examiner"]
  },
  {
    id: "explain",
    label: "Explain",
    description: "Explain a topic using your uploaded materials",
    usage: "/explain [topic]",
    icon: Brain,
    template: "/explain ",
    keywords: ["explain", "define", "what", "how"]
  },
  {
    id: "flashcards",
    label: "Flashcards",
    description: "Build a spaced-repetition deck from a topic",
    usage: "/flashcards on [topic]",
    icon: Layers,
    template: "/flashcards on ",
    keywords: ["flashcards", "cards", "deck", "spaced"]
  },
  {
    id: "summary",
    label: "Summary",
    description: "Generate a structured summary from materials or a topic",
    usage: "/summary on [topic]",
    icon: FileText,
    template: "/summary on ",
    keywords: ["summary", "summarize", "summarise", "overview"]
  },
  {
    id: "review",
    label: "Review weak topics",
    description: "Get a study plan based on your progress",
    usage: "/review",
    icon: BookOpen,
    template: "/review",
    keywords: ["review", "weak", "progress", "study"]
  },
  {
    id: "materials",
    label: "Materials",
    description: "See what file types you can upload",
    usage: "/materials",
    icon: FileText,
    template: "/materials",
    keywords: ["materials", "upload", "files", "pdf"]
  },
  {
    id: "help",
    label: "Help",
    description: "Show all available commands",
    usage: "/help",
    icon: HelpCircle,
    template: "/help",
    keywords: ["help", "commands"]
  }
];

function matchesQuery(command: SlashCommand, query: string): boolean {
  if (!query) return true;
  const haystack = [
    command.id,
    command.label,
    command.description,
    ...(command.keywords ?? [])
  ]
    .join(" ")
    .toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((term) => haystack.includes(term));
}

export type SlashMenuState = {
  parent: SlashCommand | null;
  items: SlashCommand[];
  usage: string | null;
};

export function resolveSlashMenu(rawQuery: string): SlashMenuState {
  const trimmed = rawQuery.trim();
  const spaceIndex = trimmed.indexOf(" ");
  const commandPart = (spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex)).toLowerCase();
  const restQuery = spaceIndex === -1 ? "" : trimmed.slice(spaceIndex + 1).trim();

  const parent = SLASH_COMMANDS.find(
    (command) => command.children && command.id === commandPart
  );

  if (parent?.children) {
    const items = parent.children.filter((child) => matchesQuery(child, restQuery));
    return { parent, items, usage: parent.usage ?? null };
  }

  const partialParent = SLASH_COMMANDS.find(
    (command) =>
      command.children &&
      commandPart.length > 0 &&
      command.id.startsWith(commandPart) &&
      command.id !== commandPart
  );

  if (partialParent && !restQuery) {
    const siblings = SLASH_COMMANDS.filter(
      (command) => !command.children && matchesQuery(command, trimmed)
    );
    return { parent: null, items: [partialParent, ...siblings], usage: null };
  }

  const items = SLASH_COMMANDS.filter((command) => matchesQuery(command, trimmed));
  return { parent: null, items, usage: null };
}
