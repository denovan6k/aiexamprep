import type { QuizAnswer, QuizQuestion } from "@/lib/study";

type McqOption = { id?: string; label?: string; text?: string };
type MatchingOptions = {
  left?: Array<{ id: string; text: string }>;
  right?: Array<{ id: string; text: string }>;
};

export type QuizAnswerStatus = "correct" | "incorrect" | "partial" | "reviewed";

function optionLabel(option: McqOption): string {
  return option.label ?? option.text ?? option.id ?? "";
}

function resolveOptionId(id: string | undefined | null, fallback: string): string {
  const trimmed = id?.trim();
  return trimmed ? trimmed : fallback;
}

function choiceLookup(options: McqOption[] | null | undefined): Map<string, string> {
  const lookup = new Map<string, string>();
  if (!options?.length) return lookup;

  for (const [index, option] of options.entries()) {
    const optionId = resolveOptionId(option.id, String.fromCharCode(97 + index));
    const label = optionLabel(option);
    lookup.set(optionId, label);
    if (label) {
      lookup.set(label.toLowerCase(), label);
    }
    lookup.set(String(index), label);
    lookup.set(String(index + 1), label);
    lookup.set(String.fromCharCode(97 + index), label);
  }
  return lookup;
}

function matchingLookup(options: MatchingOptions | null | undefined): Map<string, string> {
  const lookup = new Map<string, string>();
  if (!options) return lookup;

  for (const side of ["left", "right"] as const) {
    const items = options[side] ?? [];
    for (const [index, item] of items.entries()) {
      const optionId = resolveOptionId(item.id, `${side[0]}${index}`);
      lookup.set(optionId, item.text);
      if (item.text) {
        lookup.set(item.text.toLowerCase(), item.text);
      }
      lookup.set(String(index), item.text);
      lookup.set(String(index + 1), item.text);
    }
  }
  return lookup;
}

function resolveChoiceLabel(
  value: unknown,
  options: McqOption[] | null | undefined
): string {
  if (value === null || value === undefined || value === "") return "";
  const key = String(value);
  return choiceLookup(options).get(key) ?? choiceLookup(options).get(key.toLowerCase()) ?? key;
}

function resolveMatchingLabel(
  value: unknown,
  options: MatchingOptions | null | undefined
): string {
  if (value === null || value === undefined || value === "") return "";
  const key = String(value);
  return matchingLookup(options).get(key) ?? matchingLookup(options).get(key.toLowerCase()) ?? key;
}

function isBlankAnswer(answer: unknown): boolean {
  if (answer === null || answer === undefined || answer === "") return true;
  if (Array.isArray(answer)) return answer.length === 0;
  return false;
}

export function getQuizAnswerStatus(answer: QuizAnswer | undefined): QuizAnswerStatus {
  if (!answer) return "reviewed";

  if (answer.is_correct === true) return "correct";
  if (answer.is_correct === false) return "incorrect";

  const score = answer.score != null && answer.score !== "" ? Number(answer.score) : null;
  if (score === null || Number.isNaN(score)) return "reviewed";
  if (score >= 1) return "correct";
  if (score > 0) return "partial";
  return "incorrect";
}

export function formatQuizUserAnswer(question: QuizQuestion, answer: unknown): string {
  if (isBlankAnswer(answer)) return "No answer";

  if (question.type === "matching" && Array.isArray(answer)) {
    const options = !Array.isArray(question.options) ? (question.options as MatchingOptions) : null;
    return answer
      .filter((pair): pair is { left: string; right: string } => Boolean(pair && typeof pair === "object"))
      .map(
        (pair) =>
          `${resolveMatchingLabel(pair.left, options)} → ${resolveMatchingLabel(pair.right, options)}`
      )
      .join("; ");
  }

  if (question.type === "multi_select" && Array.isArray(answer)) {
    const options = Array.isArray(question.options) ? question.options : [];
    return answer.map((value) => resolveChoiceLabel(value, options)).join(", ");
  }

  if (question.type === "mcq" || question.type === "true_false") {
    const options = Array.isArray(question.options) ? question.options : [];
    return resolveChoiceLabel(answer, options);
  }

  if (question.type === "short_answer" || question.type === "theory") {
    return String(answer);
  }

  return String(answer);
}

export function formatQuizCorrectAnswer(question: QuizQuestion): string | null {
  const correctAnswers = question.correct_answers;
  if (!correctAnswers?.length) return null;

  if (question.type === "matching") {
    const options = !Array.isArray(question.options) ? (question.options as MatchingOptions) : null;
    return correctAnswers
      .filter((pair): pair is { left: string; right: string } => Boolean(pair && typeof pair === "object"))
      .map(
        (pair) =>
          `${resolveMatchingLabel(pair.left, options)} → ${resolveMatchingLabel(pair.right, options)}`
      )
      .join("; ");
  }

  if (question.type === "multi_select") {
    const options = Array.isArray(question.options) ? question.options : [];
    return correctAnswers.map((value) => resolveChoiceLabel(value, options)).join(", ");
  }

  if (question.type === "mcq" || question.type === "true_false") {
    const options = Array.isArray(question.options) ? question.options : [];
    return resolveChoiceLabel(correctAnswers[0], options);
  }

  return null;
}

export function getQuizSourceMaterialNames(question: QuizQuestion): string[] {
  const refs = question.source_refs ?? [];
  const names = refs
    .map((ref) => {
      const material = typeof ref.material === "string" ? ref.material.trim() : "";
      if (material) return material;
      const chunkId = typeof ref.chunk_id === "string" ? ref.chunk_id.trim() : "";
      return chunkId || null;
    })
    .filter((name): name is string => Boolean(name));
  return [...new Set(names)];
}

export function isObjectiveQuestionType(type: string): boolean {
  return type === "mcq" || type === "multi_select" || type === "true_false" || type === "matching";
}
