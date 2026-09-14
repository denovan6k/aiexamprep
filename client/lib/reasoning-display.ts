/**
 * Display helpers for model reasoning — Cursor-style progressive disclosure:
 * redact sensitive bits; keep a streaming window; let the UI collapse middle steps.
 */

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9_-]{10,}\b/g,
  /\bsk-or-v1-[a-zA-Z0-9_-]{10,}\b/g,
  /\bBearer\s+[a-zA-Z0-9._\-+=/]{12,}\b/gi,
  /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^\s"']{8,}["']?/gi,
  /\b[A-Za-z0-9+/]{48,}={0,2}\b/g
];

const INTERNAL_LINE_PATTERNS: RegExp[] = [
  /^\s*(system|developer|tool|function)\s*[:=]/i,
  /^\s*<\/?(?:system|tool|function|thinking)>/i,
  /^\s*\[(?:REDACTED|INTERNAL|HIDDEN)\]/i
];

const STREAM_WINDOW_CHARS = 900;

export function redactReasoningSecrets(text: string): string {
  let next = text;
  for (const pattern of SECRET_PATTERNS) {
    next = next.replace(pattern, "••••");
  }
  return next
    .split("\n")
    .filter((line) => !INTERNAL_LINE_PATTERNS.some((pattern) => pattern.test(line)))
    .join("\n");
}

/**
 * Prepare reasoning for the UI.
 * - Always redact secrets / internal markers
 * - While streaming: keep a recent window so the panel stays readable
 * - When complete: keep full (redacted) text; the panel collapses middle steps in the UI
 */
export function formatReasoningForDisplay(
  raw: string,
  options: { streaming?: boolean } = {}
): { text: string; wasObfuscated: boolean } {
  const cleaned = redactReasoningSecrets(raw).replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) {
    return { text: "", wasObfuscated: false };
  }

  const redacted = cleaned !== raw.trim();

  if (options.streaming) {
    if (cleaned.length <= STREAM_WINDOW_CHARS) {
      return { text: cleaned, wasObfuscated: redacted };
    }
    return {
      text: `…\n\n${cleaned.slice(-STREAM_WINDOW_CHARS).trimStart()}`,
      wasObfuscated: true
    };
  }

  return { text: cleaned, wasObfuscated: redacted };
}

export function formatThoughtDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return "Thought";
  if (seconds < 1) return "Thought briefly";
  if (seconds === 1) return "Thought for 1s";
  return `Thought for ${seconds}s`;
}
